/**
 * FaceDetectorWorkerManager.ts - Orchestrates multiple FaceDetector workers
 *
 * PHASE 2B: Manager class that coordinates:
 * - Multiple FaceDetectorWorker instances (one per camera)
 * - Single shared data.worker for uploads
 * - Configuration broadcast to all workers
 * - Message routing and stats aggregation
 *
 * Architecture:
 *   Camera 1 ──┐
 *   Camera 2 ──┼─> FaceDetectorWorkerManager ──> data.worker (shared)
 *   Camera 3 ──┘
 */

import React from 'react';

// @ts-ignore - worker-loader transforms this into a Worker constructor
import FaceDetectorWorkerModule from './FaceDetector.worker.ts';
import { DetectionResult } from './FaceDetector';
import { DEFAULT_SETTINGS } from '../utils/MP';
import { FpsData } from './FaceDetectorHelpers.js';

// ============================================================================
// Type Definitions
// ============================================================================

export interface WorkerConfig {
  cameraId: string;
  placeId: string;
  userId: string;
  screenId: string;
  maxChunkSize: number;
  accept: boolean;
  isPaused: boolean;
  sendingFPS: number;
}

// Base config for manager (without cameraId and placeId - added per camera when creating workers)
export interface ManagerConfig extends Omit<Omit<WorkerConfig, 'cameraId'>, 'placeId'> {}

export interface WorkerStats {
  cameraId: string;
  processingFps: number;           // Detection/processing FPS from worker
  inputFps: number;     // Input/capture FPS from camera stream
  samplesTotal: number;
}

export type AggregatedStats = Map<string, WorkerStats>;

interface WorkerInstance {
  worker: Worker;
  stats: WorkerStats | null;
}

// ============================================================================
// FaceDetectorWorkerManager
// ============================================================================

type ManagerMessageHandler = (this: FaceDetectorWorkerManager, cameraId: string, data: any) => void;

export class FaceDetectorWorkerManager {
  private workers: Map<string, WorkerInstance> = new Map();
  private config: ManagerConfig;
  private uploadEndpoint: string;
  private dataWorker: Worker | null = null;
  private fpsRef: React.RefObject<Map<string, FpsData>> | null = null;

  // Callbacks for stats and events
  onDetect: ((result: DetectionResult) => void) | null = null;
  onStatsUpdate: ((stats: AggregatedStats) => void) | null = null;
  onError: ((error: string) => void) | null = null;

  constructor(
    config: ManagerConfig,
    uploadEndpoint: string = '/handle_upload.php'
  ) {
    this.config = { ...config };
    this.uploadEndpoint = uploadEndpoint;
  }

  /**
   * Set the data worker for upload communication
   */
  setDataWorker(worker: Worker): void {
    this.dataWorker = worker;
  }

  /**
   * Add a camera worker
   */
  addCamera(cameraId: string): Worker {
    // Don't add duplicate cameras
    if (this.workers.has(cameraId)) {
      return this.workers.get(cameraId)!.worker;
    }

    // Create worker instance
    const worker = new FaceDetectorWorkerModule();
    const instance: WorkerInstance = {
      worker,
      stats: null
    };

    this.workers.set(cameraId, instance);

    // Setup message handler
    worker.onmessage = (event: MessageEvent) => {
      this.onWorkerMessage(cameraId, event);
    };

    // Initialize worker with config
    worker.postMessage({
      type: 'init',
      id: cameraId,
      config: { ...this.config, cameraId }
    });

    return worker;
  }

  /**
   * Remove a camera worker
   */
  removeCamera(cameraId: string): void {
    const instance = this.workers.get(cameraId);
    if (instance) {
      instance.worker.postMessage({ type: 'stop' });
      instance.worker.terminate();
      this.workers.delete(cameraId);
    }
  }

  /**
   * Send frame to specific camera worker for processing
   */
  sendFrameToCamera(
    cameraId: string,
    frame: ImageBitmap | VideoFrame,
    time: number,
    goal: any
  ): void {
    const instance = this.workers.get(cameraId);
    if (!instance) {
      console.warn(`Camera ${cameraId} not found`);
      return;
    }

    instance.worker.postMessage(
      {
        type: 'frame',
        frame,
        time,
        goal
      },
      [frame] // Transfer VideoFrame ownership
    );
  }

  /**
   * Update configuration for all workers
   */
  updateConfig(partial: Partial<WorkerConfig>): void {
    this.config = { ...this.config, ...partial };

    // Broadcast to all workers
    for (const instance of this.workers.values()) {
      instance.worker.postMessage({
        type: 'updateConfig',
        partial
      });
    }
  }

  /**
   * Update per-camera placeId configurations
   * Allows different cameras to use different placeId (userId is always global)
   */
  updateCameraConfigs(cameraConfigMap: Record<string, { placeId: string }>): void {
    // Send per-camera config updates to each worker
    for (const [cameraId, cameraConfig] of Object.entries(cameraConfigMap)) {
      const instance = this.workers.get(cameraId);
      if (instance) {
        instance.worker.postMessage({
          type: 'updateConfig',
          partial: { placeId: cameraConfig.placeId }
        });
      }
    }
  }

  /**
   * Set the FPS ref from the component
   * Allows manager to read input FPS data directly from the ref
   */
  setFpsRef(fpsRef: React.RefObject<Map<string, FpsData>> | null): void {
    this.fpsRef = fpsRef;
  }

  /**
   * Set callbacks (manager-only, not sent to workers)
   */
  setCallbacks(
    onDetect?: ((result: DetectionResult) => void) | null,
    onStatsUpdate?: ((stats: AggregatedStats) => void) | null,
    onError?: ((error: string) => void) | null
  ): void {
    if (onDetect !== undefined) {
      this.onDetect = onDetect || null;
    }
    if (onStatsUpdate !== undefined) {
      this.onStatsUpdate = onStatsUpdate || null;
    }
    if (onError !== undefined) {
      this.onError = onError || null;
    }
  }

  /**
   * Get current stats from all workers
   * Includes both processing FPS (from worker) and input FPS (from ref)
   */
  getStats(): AggregatedStats {
    const byCamera = new Map<string, WorkerStats>();

    for (const [cameraId, instance] of this.workers) {
      if (instance.stats) {
        // Merge in inputFps from fpsRef if available
        if (this.fpsRef?.current) {
          const fpsData = this.fpsRef.current.get(cameraId);
          if (fpsData) {
            instance.stats.inputFps = fpsData.fps;
          }
        }
        byCamera.set(cameraId, instance.stats);
      }
    }

    return byCamera;
  }

  /**
   * Terminate all workers and cleanup
   */
  terminate(): void {
    for (const [, instance] of this.workers) {
      instance.worker.postMessage({ type: 'stop' });
      instance.worker.terminate();
    }
    this.workers.clear();
  }

  /**
   * Handle messages from worker
   */
  private onWorkerMessage(cameraId: string, event: MessageEvent): void {
    if (!event.data || typeof event.data !== 'object') {
      this.onError?.(`Invalid message from worker ${cameraId}: data is not an object`);
      return;
    }

    const { type } = event.data;

    // Validate message type
    if (!type || typeof type !== 'string') {
      this.onError?.(`Invalid message from worker ${cameraId}: missing or invalid type`);
      return;
    }

    const handler = this.messageHandlers.get(type);
    if (handler) {
      try {
        handler.call(this, cameraId, event.data);
      } catch (err) {
        this.onError?.(
          `Error handling message type '${type}' from ${cameraId}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    } else {
      this.onError?.(`Unknown message type from worker ${cameraId}: ${type}`);
    }
  }

  /**
   * Message handlers Map for dispatch
   */
  private messageHandlers = new Map<string, ManagerMessageHandler>(
    Object.entries({
      detected: function(cameraId: string, data: any) {
        const { sample } = data;
        if (this.onDetect && sample !== null) {
          this.onDetect({
            cameraId,
            sample,
            settings: DEFAULT_SETTINGS
          });
        }
      },
      sendToDataWorker: function(_cameraId: string, data: any) {
        const { serializedBuffer, userId, placeId, count } = data;

        if (!this.dataWorker) {
          throw new Error('Data worker not set - cannot send samples to data worker');
        }

        // Validate required fields for upload
        if (!(serializedBuffer instanceof ArrayBuffer)) {
          throw new Error(`Invalid serializedBuffer: expected ArrayBuffer, got ${typeof serializedBuffer}`);
        }
        if (!userId || typeof userId !== 'string') {
          throw new Error('Invalid userId in message');
        }
        if (!placeId || typeof placeId !== 'string') {
          throw new Error('Invalid placeId in message');
        }
        if (typeof count !== 'number' || count < 0) {
          throw new Error('Invalid count in message');
        }

        this.dataWorker.postMessage({
          samples: serializedBuffer,
          userId,
          placeId,
          endpoint: this.uploadEndpoint,
          count
        }, [serializedBuffer]); // Transfer ownership
      },
      stats: function(cameraId: string, data: any) {
        const { stats } = data;
        const instance = this.workers.get(cameraId);
        if (instance && stats && typeof stats === 'object') {
          instance.stats = stats;
          // Report aggregated stats
          const aggregated = this.getStats();
          this.onStatsUpdate?.(aggregated);
        }
      },
      log: function(cameraId: string, data: any) {
        const { level, args } = data;
        const message = `[Worker ${cameraId}] ${args?.join(' ') || ''}`;
        if (level === 'error') {
          console.error(message);
        } else {
          console.log(message);
        }
      },
      error: function(cameraId: string, data: any) {
        const { error } = data;
        this.onError?.(`Worker error from ${cameraId}: ${String(error)}`);
      }
    } as Record<string, ManagerMessageHandler>)
  );
}

export default FaceDetectorWorkerManager;
