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
import type { CaptureRateController } from './CameraFrameCaptureController';

// ============================================================================
// Type Definitions
// ============================================================================

export interface WorkerConfig {
  cameraId: string;
  placeId: string;
  userId: string;
  monitorId: string;
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
  inputFps: number;                // Input/capture FPS from camera stream
  samplesTotal: number;
}

export type AggregatedStats = Map<string, WorkerStats>;

interface CameraState {
  worker: Worker;
  stats: WorkerStats | null;
  smoothedFps: number;
  controller: CaptureRateController | null;
}

// ============================================================================
// FaceDetectorWorkerManager
// ============================================================================

type ManagerMessageHandler = (this: FaceDetectorWorkerManager, cameraId: string, data: any) => void;

// EMA smoothing for processing FPS
const SMOOTHING_FACTOR = 0.1;

// Dynamic FPS adjustment
export const HEADROOM_FACTOR = 1.1; // Multiply interval by 1.1 (capture at ~91% of avg processing)

export class FaceDetectorWorkerManager {
  private cameras: Map<string, CameraState> = new Map(); // All per-camera state grouped by cameraId
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
    if (this.cameras.has(cameraId)) {
      return this.cameras.get(cameraId)!.worker;
    }

    // Create worker instance
    const worker = new FaceDetectorWorkerModule();
    const state: CameraState = {
      worker,
      stats: null,
      smoothedFps: 0,
      controller: null
    };

    this.cameras.set(cameraId, state);

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
    const state = this.cameras.get(cameraId);
    if (state) {
      state.worker.postMessage({ type: 'stop' });
      state.worker.terminate();
      state.controller?.cleanup();
      this.cameras.delete(cameraId);
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
    const state = this.cameras.get(cameraId);
    if (!state) {
      console.warn(`Camera ${cameraId} not found`);
      return;
    }

    state.worker.postMessage(
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
    for (const state of this.cameras.values()) {
      state.worker.postMessage({
        type: 'updateConfig',
        partial
      });
    }
  }

  /**
   * Update per-camera placeId configurations
   * Allows different cameras to use different placeId (userId is always global)
   * Also cleans up workers for cameras no longer in the config map
   */
  updateCameraConfigs(cameraConfigMap: Record<string, { placeId: string }>): void {
    // Send per-camera config updates to each camera state
    for (const [cameraId, cameraConfig] of Object.entries(cameraConfigMap)) {
      const state = this.cameras.get(cameraId);
      if (state) {
        state.worker.postMessage({
          type: 'updateConfig',
          partial: { placeId: cameraConfig.placeId }
        });
      }
    }

    // Cleanup: Remove cameras no longer in the config
    const configuredCameras = new Set(Object.keys(cameraConfigMap));
    for (const cameraId of this.cameras.keys()) {
      if (!configuredCameras.has(cameraId)) {
        console.log('[FaceDetectorWorkerManager] Removing orphaned camera:', cameraId);
        this.removeCamera(cameraId);
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
   * Register capture rate controllers for all cameras
   * Manager will update these with the average processing FPS
   */
  setCaptureControllers(controllers: Map<string, CaptureRateController>): void {
    // Assign each controller to its corresponding camera state
    for (const [cameraId, controller] of controllers) {
      const state = this.cameras.get(cameraId);
      if (state) {
        state.controller = controller;
      }
    }
  }

  /**
   * Update all capture rate controllers with calculated target interval
   * Formula: targetInterval = (1000 / avgProcessingFps) * HEADROOM_FACTOR
   */
  private updateCaptureRates(): void {
    if (this.cameras.size === 0) return;

    const targetFps = this.getTargetFps() * HEADROOM_FACTOR;

    // Guard against invalid FPS values that would result in invalid intervals
    if (targetFps === 0 || !isFinite(1000 / targetFps)) {
      console.warn('[FaceDetectorWorkerManager] Skipping capture rate update: invalid FPS', { targetFps });
      return;
    }

    // Calculate target interval with headroom factor
    const targetInterval = 1000 / targetFps;

    for (const state of this.cameras.values()) {
      if (state.controller) {
        state.controller.updateRate(targetInterval);
      }
    }
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
   * Get current camera IDs (for cleanup and monitoring)
   */
  getWorkerIds(): string[] {
    return Array.from(this.cameras.keys());
  }

  /**
   * Get current stats from all cameras
   * Includes both processing FPS (from worker) and input FPS (from ref)
   * Returns copies of stats objects to prevent external mutations
   */
  getStats(): AggregatedStats {
    const byCamera = new Map<string, WorkerStats>();

    for (const [cameraId, state] of this.cameras) {
      if (state.stats) {
        // Create copy instead of returning reference to prevent state mutations
        // fpsRef.current is always set when used in production
        const inputFps = this.fpsRef?.current.get(cameraId)?.fps ?? state.stats.inputFps;

        const statsCopy: WorkerStats = {
          cameraId: state.stats.cameraId,
          processingFps: state.stats.processingFps,
          inputFps,
          samplesTotal: state.stats.samplesTotal
        };

        byCamera.set(cameraId, statsCopy);
      }
    }

    return byCamera;
  }

  /**
   * Get minimum processing FPS across all cameras (using smoothed values)
   */
  getTargetFps(): number {
    const stats = this.getStats();
    if (stats.size === 0) return 0;

    let minFps = Infinity;
    for (const [cameraId, workerStats] of stats) {
      const state = this.cameras.get(cameraId);
      if (!state) continue;

      const rawFps = workerStats.processingFps;
      const smoothedFps = SMOOTHING_FACTOR * rawFps + (1 - SMOOTHING_FACTOR) * state.smoothedFps;
      state.smoothedFps = smoothedFps;
      minFps = Math.min(minFps, smoothedFps);
    }
    return minFps === Infinity ? 0 : minFps;
  }


  /**
   * Terminate all cameras and cleanup
   */
  terminate(): void {
    // Use removeCamera() to ensure complete cleanup of all resources:
    // workers, controllers, stats, and smoothed FPS data
    const cameraIds = Array.from(this.cameras.keys());
    for (const cameraId of cameraIds) {
      this.removeCamera(cameraId);
    }
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
        const state = this.cameras.get(cameraId);
        if (state && stats && typeof stats === 'object') {
          state.stats = stats;
          // Report aggregated stats
          const aggregated = this.getStats();
          this.onStatsUpdate?.(aggregated);
          // Update capture rates based on average processing FPS
          this.updateCaptureRates();
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
