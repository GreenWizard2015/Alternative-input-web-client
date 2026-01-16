/* eslint-disable no-restricted-globals */
/**
 * FaceDetector.worker.ts - Enhanced with sample buffering and serialization
 *
 * PHASE 2A Enhancement: Worker now manages its own sample buffer, implements time-window
 * validation, auto-flushing, and serialization before sending to data worker.
 *
 * MESSAGES RECEIVED:
 * - { type: 'init', id: string, config: WorkerConfig }
 *   Initializes worker with camera ID and configuration
 *
 * - { type: 'frame', frame: VideoFrame, time: number, goal: Position }
 *   Queues frame for detection. Sample is buffered with time-window validation
 *
 * - { type: 'updateConfig', partial: Partial<WorkerConfig> }
 *   Updates configuration (userId, placeId, screenId, sendingFPS, etc.)
 *
 * - { type: 'toggleStoring', enabled: boolean }
 *   Enable/disable storing samples in buffer
 *
 * - { type: 'flush', options: { minTime?, maxTime? } }
 *   Manual flush with time-window options
 *
 * - { type: 'flushAndClear', options: { minTime?, maxTime? } }
 *   Flush all samples and clear buffer
 *
 * - { type: 'stop' }
 *   Cleanup and terminate
 *
 * MESSAGES SENT:
 * - { type: 'detected', sample: Sample | null }
 *   Frame detection result (null if no face detected)
 *
 * - { type: 'sendToDataWorker', serializedBuffer: ArrayBuffer, userId: string, ... }
 *   Pre-serialized samples ready for upload
 *
 * - { type: 'stats', stats: WorkerStats }
 *   Periodic statistics report (~1.5s intervals)
 */

import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { results2sample, DEFAULT_SETTINGS } from '../utils/mediaPipe';

// Import shared modules for worker use
import { Sample, sampleSize, type Position } from '../shared/Sample';
import { SampleBuffer } from '../shared/SampleBuffer';
import { serialize } from '../shared/Serialization';
import type { WorkerConfig, WorkerStats } from './FaceDetectorWorkerManager';

// ============================================================================
// Message Types
// ============================================================================

type FrameMessage = {
  frame: VideoFrame;
  time: number;
  goal: Position | null;
};

type InitMessage = {
  id: string;
  config: WorkerConfig;
};

type UpdateConfigMessage = {
  partial: Partial<WorkerConfig>;
};

// ============================================================================
// Worker State
// ============================================================================

let frameQueue: FrameMessage[] = [];
let isProcessing = false;
let faceLandmarker: FaceLandmarker | null = null;
let offscreenCanvas: OffscreenCanvas | null = null;

// NEW: Configuration and buffer management
let config: WorkerConfig | null = null;
let buffer: SampleBuffer | null = null;

// Stats tracking
let frameCount = 0;
let lastStatsTime = Date.now();

// Pause state tracking
let minTime: number = 0; // Samples before this time won't be sent (initialized to 0, not null)

const PAUSE_BUFFER = 3000; // 3 seconds
const SAMPLE_THRESHOLD = 2000; // 2 seconds - drop frames older than this
// ============================================================================
// Face Detection (Existing Logic)
// ============================================================================

const initFaceLandmarker = async () => {
  if (faceLandmarker) return;

  offscreenCanvas = new OffscreenCanvas(1, 1);

  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
  );
  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: 'GPU',
    },
    outputFaceBlendshapes: false,
    runningMode: 'VIDEO',
    numFaces: 1,
  });
};

const processQueue = async () => {
  isProcessing = frameQueue.length > 0;
  if (!isProcessing) return;

  const frameData = frameQueue.shift();
  if (!frameData) return;

  const { frame, time, goal } = frameData;

  if (!faceLandmarker) {
    frame.close();
    processQueue();
    return;
  }

  try {
    frameCount++;
    const detection = await faceLandmarker.detectForVideo(frame, time);

    // Generate sample from detection results
    const sampleData = results2sample(detection, frame, offscreenCanvas, DEFAULT_SETTINGS);

    if (sampleData && config) {
      // Create proper Sample instance with full context
      // Constructor validates goal position
      const sample = new Sample({
        time: time,
        leftEye: sampleData.leftEye || null,
        rightEye: sampleData.rightEye || null,
        points: sampleData.points || new Float32Array(478 * 2),
        goal: goal,
        userId: config.userId,
        placeId: config.placeId,
        screenId: config.screenId,
        cameraId: config.cameraId,
        monitorId: config.monitorId,
      });

      // Buffer sample only if accepting AND not paused AND goal is valid AND passes minTime filter
      if (config.accept && !config.isPaused && buffer && sample.goal && minTime < sample.time) {
        buffer.addSample(sample);

        // Check auto-flush threshold
        const totalSize = buffer.getTotalSampleCount() * sampleSize();
        if (totalSize >= config.maxChunkSize) {
          doFlush();
        }
      }
      // Send detection result (for UI/monitoring) - throttled by sendingFPS
      const now = Date.now();
      if (now - lastDetectionReportTime >= detectionReportInterval) {
        self.postMessage({ type: 'detected', sample });
        lastDetectionReportTime = now;
      }
    }

    // Send stats periodically
    const now = Date.now();
    if (now - lastStatsReportTime >= statsReportInterval) {
      reportStats();
      lastStatsReportTime = now;
    }
  } catch (error) {
    workerError('Face detection error:', error);
    frame.close();
  }

  processQueue();
};

const maxSamples = () => {
  if (!config) {
    workerError('maxSamples called before config initialized');
    return 0;
  }
  return Math.floor(config.maxChunkSize / sampleSize());
};
/**
 * Flush a buckets
 * @param minSamples - Minimum samples to send in one batch (optional, default: send all)
 */
const flushBuckets = (minSamples: number = 0) => {
  if (!buffer || !config) return;
  try {
    const maxTime = Date.now() - PAUSE_BUFFER;
    const allBuckets = buffer.getAllBuckets();
    for (const bucket of allBuckets) {
      let attempts = 0;
      const maxAttempts = 100; // Safety guard against infinite loops

      while (minSamples < bucket.getCount() && attempts < maxAttempts) {
        attempts++;
        const { sent } = buffer.extractFromBucket(bucket, minTime, maxTime, maxSamples());
        if (sent.length === 0) break;

        try {
          const serialized = serialize(sent);
          const first = sent[0];
          self.postMessage(
            {
              type: 'sendToDataWorker',
              serializedBuffer: serialized,
              userId: first.userId,
              placeId: first.placeId,
              monitorId: first.monitorId,
              count: sent.length,
            },
            [serialized]
          );
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          workerError('Flush error:', errorMsg);
        }
      }

      // Log warning if we hit attempt limit (indicates a problem)
      if (attempts >= maxAttempts) {
        workerError(
          `flushBuckets: Hit max attempts (${maxAttempts}) for bucket with count ${bucket.getCount()}`
        );
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    workerError('Flush error:', errorMsg);
  }
};

/**
 * Handle pause state changes
 * When unpaused (false): set minTime to filter out old samples
 * When paused (true): flush all samples with maxTime cutoff
 */
const handlePauseStateChange = (isPaused: boolean) => {
  if (!buffer || !config) return;

  const now = Date.now();

  if (!isPaused) {
    // Becoming unpaused: set minTime to exclude samples collected before this transition
    minTime = now + PAUSE_BUFFER;
  } else {
    // Becoming paused: flush all samples from all buckets with maxTime cutoff 3 seconds ago
    flushBuckets();
    buffer.clear();
  }
};

/**
 * Flush samples from buffer to data worker with serialization
 * Keeps flushing until all samples are sent
 */
const doFlush = () => {
  try {
    flushBuckets(maxSamples());
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    workerError('Flush error:', errorMsg);
  }
};

/**
 * Send periodic statistics to manager
 */
const reportStats = () => {
  try {
    if (!config) return;

    const now = Date.now();
    const elapsed = (now - lastStatsTime) / 1000; // seconds

    const stats: WorkerStats = {
      cameraId: config.cameraId,
      processingFps: elapsed > 0 ? frameCount / elapsed : 0,
      samplesTotal: buffer ? buffer.getTotalSampleCount() : 0,
      inputFps: -1,
    };

    // Reset counters
    frameCount = 0;
    lastStatsTime = now;

    self.postMessage({ type: 'stats', stats });
  } catch (error) {
    workerError('Error in reportStats:', error);
  }
};

// Detection reporting throttling
let lastDetectionReportTime = 0;
let detectionReportInterval = 1000 / 30; // default 30 FPS

// Stats reporting throttling (~1.5 seconds)
let lastStatsReportTime = 0;
const statsReportInterval = 1500;
/**
 * Drop frames from queue that are older than threshold
 * Prevents memory bloat when processing can't keep up with incoming frames
 */
const dropOldFrames = (threshold: number) => {
  const now = Date.now();
  const cutoffTime = now - threshold;

  const keptFrames: FrameMessage[] = [];
  let droppedCount = 0;

  for (const item of frameQueue) {
    if (item.time >= cutoffTime) {
      keptFrames.push(item);
    } else {
      item.frame.close();
      droppedCount++;
    }
  }

  frameQueue = keptFrames;

  if (droppedCount > 0) {
    workerError(`Dropped ${droppedCount} frames older than ${threshold}ms`);
  }
};

// ============================================================================
// Worker Logger (sends to main thread console)
// ============================================================================

const workerError = (...args: unknown[]) => {
  self.postMessage({
    type: 'log',
    level: 'error',
    args: args.map(arg => {
      if (typeof arg === 'object') {
        return JSON.stringify(arg, null, 2);
      }
      return String(arg);
    }),
  });
};

// ============================================================================
// Message Handlers
// ============================================================================

const handleFrame = ({ frame, time, goal }: FrameMessage) => {
  try {
    frameQueue.push({ frame, time, goal });
    dropOldFrames(SAMPLE_THRESHOLD);
    if (!isProcessing) processQueue();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    workerError('Error in handleFrame:', errorMsg);
  }
};

const handleInit = async ({ id, config: incomingConfig }: InitMessage) => {
  try {
    config = { ...incomingConfig, cameraId: id };
    buffer = new SampleBuffer();
    await initFaceLandmarker();

    handleUpdateConfig({ partial: config });
  } catch (error) {
    workerError('Error in handleInit:', error);
  }
};

const handleUpdateConfig = ({ partial }: UpdateConfigMessage) => {
  try {
    if (config && partial) {
      const oldIsPaused = config.isPaused;
      config = { ...config, ...partial };

      // Detect pause state change
      if (partial.isPaused !== undefined && oldIsPaused !== partial.isPaused) {
        handlePauseStateChange(partial.isPaused);
      }

      // Set detection reporting interval based on sendingFPS
      // sendingFPS = -1 means send every detection (no throttling)
      if (config.sendingFPS) {
        if (config.sendingFPS === -1) {
          detectionReportInterval = 0; // Send immediately
        } else if (config.sendingFPS > 0) {
          detectionReportInterval = 1000 / config.sendingFPS;
        }
      }
    }
  } catch (error) {
    workerError('Error in handleUpdateConfig:', error);
  }
};

const handleStop = () => {
  try {
    frameQueue.forEach(({ frame }) => frame.close());
    frameQueue = [];

    if (faceLandmarker) {
      faceLandmarker.close();
      faceLandmarker = null;
    }

    buffer?.clear();
    buffer = null;
    config = null;
  } catch (error) {
    workerError('Error in handleStop:', error);
  }
};

type MessageHandler = (data: FrameMessage | InitMessage | UpdateConfigMessage | undefined) => void;

const messageHandlers: Record<string, MessageHandler> = {
  frame: handleFrame as MessageHandler,
  init: handleInit as MessageHandler,
  updateConfig: handleUpdateConfig as MessageHandler,
  stop: handleStop as MessageHandler,
};

self.onmessage = function ({ data }) {
  try {
    const { type } = data;
    const handler = messageHandlers[type];

    if (handler) {
      try {
        handler(data);
      } catch (error) {
        workerError(`Error handling message type '${type}':`, error);
      }
    } else {
      workerError(`Unknown message type: '${type}'`);
    }
  } catch (error) {
    workerError('Fatal error in message handler:', error);
  }
};

// Export for TypeScript module resolution
export default null;
