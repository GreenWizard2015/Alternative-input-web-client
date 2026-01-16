import i18n from '../i18n';
import { grayscale2image } from '../utils/mediaPipe';
import CBackground from './CBackground';
import CRandomIllumination from './CRandomIllumination';
import { DetectionResult } from '../components/FaceDetector';
import type { Position } from '../shared/Sample';
import type { FPSData } from '../types/fps';
import type { IGameController } from '../types/ControllerInterface';
export type { FPSData };
export type Viewport = { width: number; height: number };

export type AppModeOverlayData = {
  canvasCtx: CanvasRenderingContext2D;
  viewport: Viewport;
  activeUploads: number;
  meanUploadDuration: number;
  eyesDetected: boolean;
  fps?: FPSData;
  collectedSampleCounts?: Record<string, number>;
  detections?: Map<string, DetectionResult>;
};

export type AppModeRenderData = {
  canvas: HTMLCanvasElement;
  canvasCtx: CanvasRenderingContext2D;
  viewport: Viewport;
  goal: Position | null;
  user: string;
  screenId: string;
  gameMode: AppMode;
  activeUploads: number;
  meanUploadDuration: number;
  eyesDetected: boolean;
  fps?: FPSData;
  collectedSampleCounts?: Record<string, number>;
  detections: Map<string, DetectionResult>;
};
const TRANSITION_TIME = 100;

function clamp(val: number, min: number, max: number) {
  if (val < min) return min;
  if (val > max) return max;
  return val;
}

const MAX_UPLOADS = 10;
export class AppMode {
  _pos: Position = { x: 0, y: 0 };
  _paused: boolean;
  _timeToggledPaused: number = 0;
  _lastTickTime: number = Date.now();
  _background: CBackground = new CBackground();
  _illumination: CRandomIllumination = new CRandomIllumination();
  _overflowed: boolean = false;
  _eyesDetected: boolean = false;
  _controller: IGameController;

  constructor(controller: IGameController) {
    this._controller = controller;
    this._paused = true;
  }

  _setPaused(paused: boolean) {
    this._paused = paused;
    this._timeToggledPaused = Date.now();
    if (this._paused) {
      this.onPause();
    }
  }

  onKeyDown(event: KeyboardEvent) {
    if (['KeyP', 'Enter', 'Space'].includes(event.code)) {
      this._setPaused(!this._paused);
    }
    this._background.onEvent(event);
    this._illumination.onEvent(event);
    this._controller.onKeyDown(event);
  }

  doTick(_deltaT: number, _viewport: Viewport) {
    // Does nothing - subclasses should override this to update game state
    // AppMode controls when this is called based on pause state
  }

  process(data: AppModeRenderData): Position | null {
    this.onRender(data);
    this.onOverlay(data);
    return this.accept() ? this.getGoal() : null;
  }

  onRender(data: AppModeRenderData) {
    // Call doTick and visual effects only when not paused - AppMode manages timing
    const { canvasCtx, viewport, detections, eyesDetected } = data;
    this._eyesDetected = eyesDetected;
    const now = Date.now();
    const deltaT = this._paused ? 0 : (now - this._lastTickTime) / 1000; // in seconds
    this._lastTickTime = now;
    this.doTick(deltaT, data.viewport);
    this._background.onTick(deltaT);
    this._illumination.onTick(deltaT);
    this._controller.doTick(deltaT); // ← CRITICAL: Sync controller with frame time
    this._background.onRender(canvasCtx, viewport);
    this._illumination.onRender(canvasCtx, viewport.width, viewport.height);

    // Draw metrics (FPS, eyes, goals) on top
    const fps = data.fps || {};
    const collectedSampleCounts = data.collectedSampleCounts || {};
    this.drawMetrics(canvasCtx, fps, collectedSampleCounts, detections);
  }

  onOverlay(data: AppModeOverlayData) {
    const {
      canvasCtx,
      viewport,
      activeUploads,
      meanUploadDuration,
      fps = {},
      collectedSampleCounts = {},
      detections,
    } = data;

    const isOverflowed = MAX_UPLOADS < activeUploads;
    if (this._overflowed && 0 === activeUploads) {
      // Reset
      this._overflowed = false;
    }

    if (isOverflowed) {
      this._overflowed = true;
      this._setPaused(true);
    }

    if (this._overflowed) {
      // Show overlay when overflowed
      canvasCtx.fillStyle = `rgba(0, 0, 0, 0.5)`;
      canvasCtx.fillRect(0, 0, viewport.width, viewport.height);
      const estimatedTime = (activeUploads * meanUploadDuration) / 1000;
      const minutes = Math.floor(estimatedTime / 60)
        .toString()
        .padStart(2, '0');
      const seconds = Math.floor(estimatedTime % 60)
        .toString()
        .padStart(2, '0');
      const { t } = i18n;
      const text = t('canvas.uploadsInProgress', { count: activeUploads, minutes, seconds });
      this.drawText({
        text,
        viewport,
        canvasCtx,
        color: 'white',
        style: '16px Roboto',
      });
      return;
    }

    // Transition for pausing
    const transition = clamp((Date.now() - this._timeToggledPaused) / TRANSITION_TIME, 0, 1);
    const realTransition = this.isPaused() ? transition : 1 - transition;
    const easedTransition = realTransition; // Maybe add some easing

    if (easedTransition > 0) {
      canvasCtx.fillStyle = `rgba(0, 0, 0, ${0.5 * easedTransition})`;
      canvasCtx.fillRect(0, 0, viewport.width, viewport.height);

      // Show appropriate message based on why we're paused
      const { t } = i18n;
      const pauseText = t('canvas.paused');
      this.drawText({
        text: pauseText,
        viewport,
        canvasCtx,
        color: 'white',
        style: (48 + (1 - easedTransition) * 12).toString() + 'px Roboto',
      });
    } else {
      if (!this._eyesDetected) {
        const { t } = i18n;
        this.drawText({
          text: t('canvas.eyesNotVisible'),
          viewport,
          canvasCtx,
          color: 'white',
          style: (48 + (1 - easedTransition) * 12).toString() + 'px Roboto',
        });
      }
    }

    this.drawMetrics(canvasCtx, fps, collectedSampleCounts, detections);
  }

  private drawMetrics(
    canvasCtx: CanvasRenderingContext2D,
    fps: FPSData,
    collectedSampleCounts: Record<string, number>,
    detections: Map<string, DetectionResult> | undefined
  ) {
    // Draw FPS in top-left corner
    canvasCtx.fillStyle = 'black';
    canvasCtx.font = '14px monospace';

    // Show FPS for each camera by index
    const { t } = i18n;
    let yOffset = 20;
    let cameraIndex = 0;
    for (const [cameraId, fpsData] of Object.entries(fps)) {
      // cameraId is already normalized (hashed), don't hash again
      const collectedCount = collectedSampleCounts[cameraId] || 0;
      const fpsText = t('canvas.fpsMetric', {
        index: cameraIndex,
        fps: fpsData.camera.toFixed(1),
        collected: collectedCount,
      });
      canvasCtx.fillText(fpsText, 10, yOffset);
      yOffset += 18;
      cameraIndex++;
    }

    // Draw eye crops for all cameras
    if (detections && detections.size > 0) {
      let eyeIndex = 0;
      const eyeX = 10;
      const eyeStartY = yOffset + 20; // Below FPS display

      detections.forEach((detection: DetectionResult) => {
        if (detection.sample && detection.settings) {
          const { SIZE } = detection.settings;
          const eyeY = eyeStartY + (SIZE + 10) * eyeIndex;

          // Draw left eye
          if (detection.sample.leftEye) {
            const leftEyeImage = grayscale2image(detection.sample.leftEye, SIZE);
            canvasCtx.putImageData(leftEyeImage, eyeX, eyeY);
          }

          // Draw right eye next to left eye
          if (detection.sample.rightEye) {
            const rightEyeImage = grayscale2image(detection.sample.rightEye, SIZE);
            canvasCtx.putImageData(rightEyeImage, eyeX + SIZE + 5, eyeY);
          }

          // Draw camera label above eyes
          if (detection.sample.leftEye || detection.sample.rightEye) {
            canvasCtx.fillStyle = '#ffffff';
            canvasCtx.font = '12px monospace';
            canvasCtx.fillText(`Camera ${eyeIndex}`, eyeX, eyeY - 5);
          }

          if (detection.sample.goal) {
            const goal = detection.sample.goal;
            // Draw goal label
            canvasCtx.fillStyle = '#ffff00';
            canvasCtx.font = '12px monospace';
            canvasCtx.fillText(`Goal: ${goal.x}, ${goal.y}`, eyeX, eyeY);
          }

          eyeIndex++;
        }
      });
    }
  }

  accept() {
    // Accept if game is running AND eyes are detected
    // Frame could be null, if so then eyes not detected
    return !this._paused && this._eyesDetected;
  }

  static makeAbsolute({ position, viewport }: { position: Position; viewport: Viewport }) {
    return {
      x: position.x * viewport.width,
      y: position.y * viewport.height,
    };
  }

  static makeRelative({ position, viewport }: { position: Position; viewport: Viewport }) {
    return {
      x: position.x / viewport.width,
      y: position.y / viewport.height,
    };
  }

  drawTarget({
    viewport,
    canvasCtx,
    state = 'active',
  }: {
    viewport: Viewport;
    canvasCtx: CanvasRenderingContext2D;
    state?: 'active' | 'inactive' | 'paused';
  }) {
    const absolutePosition = AppMode.makeAbsolute({ position: this._pos, viewport });
    // Delegate to controller for goal rendering with user's symbols and colors
    this._controller.drawTarget(canvasCtx, absolutePosition, state);
  }

  drawText({
    text,
    viewport,
    canvasCtx,
    color,
    style,
  }: {
    text: string;
    viewport: Viewport;
    canvasCtx: CanvasRenderingContext2D;
    color?: string;
    style?: string;
  }) {
    canvasCtx.font = style || '48px Roboto';
    canvasCtx.fillStyle = color || 'red';
    canvasCtx.textBaseline = 'middle';
    const size = canvasCtx.measureText(text);
    canvasCtx.fillText(text, (viewport.width - size.width) / 2, viewport.height / 2);
  }

  isPaused() {
    return this._paused;
  }

  lastPausedTime() {
    return this._timeToggledPaused;
  }

  getGoal() {
    return { ...this._pos };
  }

  getScore() {
    return null;
  }

  onPause() {
    this._paused = true;
  }
}
