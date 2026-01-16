/**
 * CameraFrameCaptureController.ts - Manages frame capture and interval adjustment
 */

export const CAPTURE_INTERVAL = 1000 / 30; // 33.33ms - default 30 FPS (can be overridden dynamically)
export const MIN_CAPTURE_INTERVAL = 1000 / 100; // Never faster than 100 FPS (10ms)
export const MAX_CAPTURE_INTERVAL = 1000 / 15; // Never slower than 15 FPS (~66.67ms)

/**
 * Controller for dynamically adjusting capture rate per camera
 */
export interface CaptureRateController {
  updateRate(targetInterval: number): void;
  cleanup(): void;
}

/**
 * CameraFrameCaptureController - Manages frame capture and interval adjustment for a single camera
 */
export class CameraFrameCaptureController implements CaptureRateController {
  private currentCaptureInterval: number;
  private intervalId: NodeJS.Timeout;
  private captureFrame: () => Promise<void>;

  constructor(captureFrame: () => Promise<void>) {
    this.captureFrame = captureFrame;
    this.currentCaptureInterval = CAPTURE_INTERVAL;
    // Start the interval after construction
    this.intervalId = setInterval(() => this.captureFrame(), this.currentCaptureInterval);
  }

  /**
   * Update capture interval with target interval from manager
   * Manager calculates: targetInterval = (1000 / processingFps) * HEADROOM_FACTOR
   */
  updateRate(targetInterval: number): void {
    if (targetInterval <= 0) return;

    // Clamp to min/max bounds
    const newInterval = Math.max(
      MIN_CAPTURE_INTERVAL,
      Math.min(MAX_CAPTURE_INTERVAL, targetInterval)
    );

    // Only update if interval changed significantly (>5% difference)
    const percentChange =
      Math.abs(newInterval - this.currentCaptureInterval) / this.currentCaptureInterval;
    if (percentChange < 0.05) {
      return;
    }

    this.currentCaptureInterval = newInterval;

    // Restart interval with new timing
    clearInterval(this.intervalId);
    this.intervalId = setInterval(() => this.captureFrame(), this.currentCaptureInterval);
  }

  cleanup(): void {
    clearInterval(this.intervalId);
  }
}
