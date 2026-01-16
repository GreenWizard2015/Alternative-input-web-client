/**
 * FaceDetectorHelpers.ts - Helper functions for FaceDetector component
 */

import { useEffect, useRef } from 'react';
import FaceDetectorWorkerManager from './FaceDetectorWorkerManager';
import { hash128Hex } from '../utils';
import { type Position } from '../shared/Sample';
import {
  CameraFrameCaptureController,
  type CaptureRateController,
} from './CameraFrameCaptureController';

// ============================================================================
// Constants
// ============================================================================

export const READINESS_TIMEOUT = 3000;
export const FPS_REPORT_INTERVAL = 1500;

// ============================================================================
// Types
// ============================================================================

export interface RawFpsData {
  frames: number;
  lastTime: number;
}

export interface FpsData {
  fps: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Wait for video element to be ready for frame capture */
export const waitForVideoReady = async (
  video: HTMLVideoElement,
  timeout: number
): Promise<void> => {
  return new Promise<void>(resolve => {
    let done = false;
    const timer = setInterval(() => {
      if (!done && video.readyState >= video.HAVE_ENOUGH_DATA) {
        done = true;
        clearInterval(timer);
        resolve();
      }
    }, 50);
    setTimeout(() => {
      if (!done) {
        done = true;
        clearInterval(timer);
        resolve();
      }
    }, timeout);
  });
};

/** Initialize camera streams and add to manager */
export const initializeStreams = async (
  cameraIds: string[],
  videoRefs: Map<string, HTMLVideoElement | null>,
  manager: FaceDetectorWorkerManager
): Promise<Map<string, MediaStream>> => {
  const streams = new Map<string, MediaStream>();

  for (const cameraId of cameraIds) {
    const normalizedCameraId = hash128Hex(cameraId);
    try {
      const video = videoRefs.get(normalizedCameraId);
      if (!video) continue;

      manager.addCamera(normalizedCameraId);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: cameraId } },
      });

      streams.set(normalizedCameraId, stream);
      video.srcObject = stream;
      await video.play().catch(console.error);
      await waitForVideoReady(video, READINESS_TIMEOUT);
    } catch (error) {
      // Log stream initialization errors with context
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof DOMException ? error.name : 'Unknown';
      console.error(
        `[FaceDetector] Failed to initialize stream for ${normalizedCameraId}: ${errorName}: ${errorMsg}`
      );
      // Continue with next camera
    }
  }

  return streams;
};

// ============================================================================
// Custom Hooks
// ============================================================================

/** Hook for tracking FPS (frames per second) across multiple cameras */
export const useFpsTracking = (cameraIds: string[]) => {
  const fpsRef = useRef(new Map<string, RawFpsData>());
  const finalFpsRef = useRef(new Map<string, FpsData>());

  useEffect(() => {
    if (cameraIds.length === 0) return;

    const fpsTimer = setInterval(() => {
      const now = Date.now();
      cameraIds.forEach(cameraId => {
        const normalizedCameraId = hash128Hex(cameraId);
        const fps = fpsRef.current.get(normalizedCameraId) || { frames: 0, lastTime: now };
        const duration = (now - fps.lastTime) / 1000;
        finalFpsRef.current.set(normalizedCameraId, {
          fps: fps.frames / duration,
        });
        fps.frames = 0;
        fps.lastTime = now;
      });
    }, FPS_REPORT_INTERVAL);

    return () => clearInterval(fpsTimer);
  }, [cameraIds]);

  // Cleanup entries for cameras that are no longer in the list
  useEffect(() => {
    const normalizedCameraIds = new Set(cameraIds.map(id => hash128Hex(id)));

    // Remove entries from fpsRef that are no longer active
    for (const cameraId of fpsRef.current.keys()) {
      if (!normalizedCameraIds.has(cameraId)) {
        fpsRef.current.delete(cameraId);
      }
    }

    // Remove entries from finalFpsRef that are no longer active
    for (const cameraId of finalFpsRef.current.keys()) {
      if (!normalizedCameraIds.has(cameraId)) {
        finalFpsRef.current.delete(cameraId);
      }
    }
  }, [cameraIds]);

  return { fpsRef, finalFpsRef };
};

// ============================================================================
// Frame Capture Helpers
// ============================================================================

export type CameraCaptureDeps = {
  video: HTMLVideoElement | null;
  manager: FaceDetectorWorkerManager;
  fpsData: RawFpsData;
};

/** Creates a frame capture interval for a single camera with dynamic rate adjustment */
export const createCameraFrameCapture = (
  normalizedCameraId: string,
  camera: CameraCaptureDeps,
  goal: React.RefObject<Position | null>
): CaptureRateController => {
  let isCapturing = false;

  const captureFrame = async () => {
    if (isCapturing) {
      return;
    }

    isCapturing = true;

    if (camera.video?.videoWidth && camera.video.readyState >= camera.video.HAVE_ENOUGH_DATA) {
      try {
        const frame = await createImageBitmap(camera.video);
        camera.manager.sendFrameToCamera(normalizedCameraId, frame, Date.now(), goal.current);

        // Update FPS counter
        camera.fpsData.frames++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isMemoryError = errorMsg.includes('QuotaExceeded');
        const level = isMemoryError ? 'warn' : 'error';
        const context = isMemoryError ? ' - GPU memory exhausted' : '';
        console[level as 'warn' | 'error'](
          `[FaceDetector] Frame capture error on ${normalizedCameraId}: ${errorMsg}${context}`
        );
      }
    }

    isCapturing = false;
  };

  return new CameraFrameCaptureController(captureFrame);
};
