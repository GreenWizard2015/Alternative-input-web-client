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

import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import { results2sample, DEFAULT_SETTINGS } from "../utils/MP";

// Import shared modules for worker use
import { Sample, sampleSize } from "../shared/Sample";
import { SampleBuffer } from "../shared/SampleBuffer";
import { serialize } from "../shared/Serialization";
import type { WorkerConfig, WorkerStats } from "./FaceDetectorWorkerManager";

// ============================================================================
// Worker State
// ============================================================================

let frameQueue: Array<{ frame: VideoFrame; time: number; goal: any }> = [];
let isProcessing = false;
let faceLandmarker: any = null;
let offscreenCanvas: OffscreenCanvas | null = null;

// NEW: Configuration and buffer management
let config: WorkerConfig | null = null;
let buffer: SampleBuffer | null = null;

// Stats tracking
let frameCount = 0;
let lastStatsTime = Date.now();

// Pause state tracking
let minTime: number | null = null; // Samples before this time won't be sent

const PAUSE_BUFFER = 3000; // 3 seconds
// ============================================================================
// Face Detection (Existing Logic)
// ============================================================================

const initFaceLandmarker = async () => {
  if (faceLandmarker) return;

  offscreenCanvas = new OffscreenCanvas(1, 1);

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );
  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: "GPU"
    },
    outputFaceBlendshapes: false,
    runningMode: "VIDEO",
    numFaces: 1
  });
};

const processQueue = async () => {
  isProcessing = frameQueue.length > 0;
  if (!isProcessing) return;

  const { frame, time, goal } = frameQueue.shift()!;

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
        leftEye: (sampleData as any).leftEye || null,
        rightEye: (sampleData as any).rightEye || null,
        points: (sampleData as any).points || new Float32Array(478 * 2),
        goal: goal,
        userId: config.userId,
        placeId: config.placeId,
        screenId: config.screenId,
        cameraId: config.cameraId,
      });

       // Buffer sample only if accepting AND not paused AND goal is valid AND passes minTime filter
      if (config.accept && !config.isPaused && buffer && sample.goal && (minTime < sample.time)) {
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
  } catch (error) {
    workerError('Face detection error:', error);
    frame.close();
  }

  processQueue();
};

const maxSamples = () => Math.floor(config.maxChunkSize / sampleSize());
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
      while (minSamples < bucket.getCount()) {
        const { sent } = buffer.extractFromBucket(bucket, minTime, maxTime, maxSamples());
        if (sent.length === 0) break;

        try {
          const serialized = serialize(sent);
          const first = sent[0];
          self.postMessage({
            type: 'sendToDataWorker',
            serializedBuffer: serialized,
            userId: first.userId,
            placeId: first.placeId,
            count: sent.length
          }, [serialized]);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          workerError('Flush error:', errorMsg);
        }
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
};

// Periodic stats reporting (~1.5 seconds)
let statsInterval: ReturnType<typeof setInterval> | null = null;

// Detection reporting throttling
let lastDetectionReportTime = 0;
let detectionReportInterval = 1000 / 30; // default 30 FPS

// ============================================================================
// Worker Logger (sends to main thread console)
// ============================================================================

const workerError = (...args: any[]) => {
  self.postMessage({
    type: 'log',
    level: 'error',
    args: args.map(arg => {
      if (typeof arg === 'object') {
        return JSON.stringify(arg, null, 2);
      }
      return String(arg);
    })
  });
};

// ============================================================================
// Message Handlers
// ============================================================================

const handleFrame = ({ frame, time, goal }: any) => {
  frameQueue.push({ frame, time, goal });
  if (!isProcessing) processQueue();
};

const handleInit = async ({ id, config: incomingConfig }: any) => {
  config = { ...incomingConfig, cameraId: id };
  buffer = new SampleBuffer();
  await initFaceLandmarker();

  // Start periodic stats reporting (clear old interval first if it exists)
  if (statsInterval) {
    clearInterval(statsInterval);
  }
  statsInterval = setInterval(reportStats, 1500);
  handleUpdateConfig({partial: config});
};

const handleUpdateConfig = ({ partial }: any) => {
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
};

const handleStop = () => {
  frameQueue.forEach(({ frame }) => frame.close());
  frameQueue = [];

  if (faceLandmarker) {
    faceLandmarker.close();
    faceLandmarker = null;
  }

  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }

  buffer?.clear();
  buffer = null;
  config = null;
};

type MessageHandler = (data: any) => void;

const messageHandlers: Record<string, MessageHandler> = {
  frame: handleFrame,
  init: handleInit,
  updateConfig: handleUpdateConfig,
  stop: handleStop,
};

self.onmessage = function({ data }) {
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
};
