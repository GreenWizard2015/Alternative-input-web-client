import i18n from "../i18n";
import { Position } from "../components/SamplesDef";
import { drawTarget } from "../utils/target";
import CBackground from "./CBackground";
import CRandomIllumination from "./CRandomIllumination";
import { DetectionResult } from "../components/FaceDetector";

export type Viewport = { width: number, height: number }

export type FPSData = Record<string, { camera: number; samples: number }>;

export type AppModeOverlayData = {
  canvasCtx: CanvasRenderingContext2D;
  viewport: Viewport;
  activeUploads: number;
  meanUploadDuration: number;
  eyesDetected: boolean;
  eyesByCamera?: Map<string, boolean>;
  fps?: FPSData;
  collectedSampleCounts?: Record<string, number>;
};

export type AppModeRenderData = {
  canvas: HTMLCanvasElement;
  canvasCtx: CanvasRenderingContext2D;
  viewport: Viewport;
  goal: any;
  user: string;
  place: string;
  screenId: string;
  gameMode: AppMode;
  activeUploads: number;
  meanUploadDuration: number;
  eyesDetected: boolean;
  eyesByCamera: Map<string, boolean>;
  fps: FPSData;
  detections: Map<string, DetectionResult>;
};
const TRANSITION_TIME = 100;

function clamp(val: number, min: number, max: number) {
  if(val < min) return min
  if(val > max) return max
  return val
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
  _eyesByCamera: Map<string, boolean> = new Map(); // Per-camera eye detection

  constructor() {
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
  }

  doTick(_deltaT: number, _viewport: Viewport) {
    // Does nothing - subclasses should override this to update game state
    // AppMode controls when this is called based on pause state
  }

  onRender(data: AppModeRenderData) {
    // Call doTick and visual effects only when not paused - AppMode manages timing
    const now = Date.now();
    const deltaT = this._paused ? 0 : (now - this._lastTickTime) / 1000; // in seconds
    this._lastTickTime = now;
    this.doTick(deltaT, data.viewport);
    this._background.onTick(deltaT);
    this._illumination.onTick(deltaT);
  }

  onOverlay(data: AppModeOverlayData) {
    const { canvasCtx, viewport, activeUploads, meanUploadDuration, eyesByCamera, fps = {}, collectedSampleCounts = {} } = data;
    if (eyesByCamera) {
      this._eyesByCamera = eyesByCamera;
    }
    this._background.onRender(canvasCtx, viewport);
    this._illumination.onRender(canvasCtx, viewport.width, viewport.height);

    const isOverflowed = MAX_UPLOADS < activeUploads;
    if(this._overflowed && (0 === activeUploads)) { // Reset
      this._overflowed = false;
    }

    if (isOverflowed) {
      this._overflowed = true;
      this._setPaused(true);
    }

    if(this._overflowed) { // Show overlay when overflowed
      canvasCtx.fillStyle = `rgba(0, 0, 0, 0.5)`;
      canvasCtx.fillRect(0, 0, viewport.width, viewport.height);
      const estimatedTime = activeUploads * meanUploadDuration / 1000;
      const minutes = Math.floor(estimatedTime / 60).toString().padStart(2, '0');
      const seconds = Math.floor(estimatedTime % 60).toString().padStart(2, '0');
      const { t } = i18n;
      const text = t('canvas.uploadsInProgress', { count: activeUploads, minutes, seconds });
      this.drawText({
        text,
        viewport, canvasCtx, color: 'white',
        style: '16px Roboto'
      });
      return;
    }

    // Transition for pausing
    const transition = clamp((Date.now() - this._timeToggledPaused) / TRANSITION_TIME, 0, 1);
    const realTransition = this.isPaused() ? transition : 1 - transition;
    const easedTransition = realTransition; // Maybe add some easing

    if (easedTransition > 0) {
      canvasCtx.fillStyle = `rgba(0, 0, 0, ${0.5 * easedTransition})`
      canvasCtx.fillRect(0, 0, viewport.width, viewport.height)

      // Show appropriate message based on why we're paused
      const { t } = i18n;
      const pauseText = this._anyEyesDetected() ? t('canvas.paused') : t('canvas.eyesNotVisible');
      this.drawText({
        text: pauseText, viewport, canvasCtx, color: 'white',
        style: (48 + (1 - easedTransition) * 12).toString() + 'px Roboto'
      });
    }

    // Draw FPS in top-left corner
    canvasCtx.fillStyle = 'black';
    canvasCtx.font = '14px monospace';

    // Show FPS for each camera by index
    const { t } = i18n;
    let yOffset = 20;
    let cameraIndex = 0;
    for (const [cameraId, fpsData] of Object.entries(fps)) {
      const collectedCount = collectedSampleCounts[cameraId] || 0;
      const fpsText = t('canvas.fpsMetric', { index: cameraIndex, fps: fpsData.camera.toFixed(1), samples: fpsData.samples.toFixed(1), collected: collectedCount });
      canvasCtx.fillText(fpsText, 10, yOffset);
      yOffset += 18;
      cameraIndex++;
    }
  }

  _anyEyesDetected() {
    return Array.from(this._eyesByCamera.values()).some(hasEyes => hasEyes);
  }

  accept() {
    // Multi-camera: accept if game is running AND any camera has eyes visible
    return !this._paused && this._anyEyesDetected();
  }

  static makeAbsolute({ position, viewport }: { position: Position, viewport: Viewport }) {
    return {
      x: position.x * viewport.width,
      y: position.y * viewport.height
    }
  }

  static makeRelative({ position, viewport }: { position: Position, viewport: Viewport }) {
    return {
      x: position.x / viewport.width,
      y: position.y / viewport.height
    }
  }

  drawTarget(
    { position=null, viewport, radius=10, canvasCtx, style, sign='' }:
    { 
      position: Position | null, viewport: Viewport, 
      radius: number,
      canvasCtx: CanvasRenderingContext2D, style?: string, sign?: string
    }
  ) {
    position = position ?? this._pos;
    const absolutePosition = AppMode.makeAbsolute({ position, viewport });
    drawTarget({ 
      position: absolutePosition, 
      radius, canvasCtx, style, sign
    });
  }

  drawText({ text, viewport, canvasCtx, color, style }: { text: string, viewport: Viewport, canvasCtx: CanvasRenderingContext2D, color?: string, style?:string }) {
    canvasCtx.font = style || '48px Roboto';
    canvasCtx.fillStyle = color || 'red';
    canvasCtx.textBaseline = 'middle';
    const size = canvasCtx.measureText(text);
    canvasCtx.fillText(
      text,
      (viewport.width - size.width) / 2,
      (viewport.height) / 2
    );
  }

  isPaused() {
    return this._paused;
  }

  lastPausedTime() {
    return this._timeToggledPaused;
  }

  getGoal() {
    return this._pos;
  }

  getScore() {
    return null;
  }
  
  onPause() {

  }
}