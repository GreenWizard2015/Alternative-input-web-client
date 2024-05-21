import { Position } from "../components/SamplesDef";
import { drawTarget } from "../utils/target";
import CBackground from "./CBackground";
import CRandomIllumination from "./CRandomIllumination";

type Viewport = { width: number, height: number }
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
  onPause: () => void = () => {};
  _background: CBackground = new CBackground();
  _illumination: CRandomIllumination = new CRandomIllumination();
  _overflowed: boolean = false;

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

  onRender() {
    // Does nothing
  }

  onOverlay(
    { canvasCtx, viewport, activeUploads, meanUploadDuration }: 
    { 
      canvasCtx: CanvasRenderingContext2D, viewport: Viewport, 
      activeUploads: number, meanUploadDuration: number
    }
  ) {
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
      const text = `There is ${activeUploads} uploads in progress. Please wait. ` + 
        `Estimated time: ${minutes}:${seconds}`;
      this.drawText({
        text,
        viewport, canvasCtx, color: 'white',
        style: '16px Roboto'
      });
      return;
    }

    // Transition for pausing
    const transition = clamp((Date.now() - this._timeToggledPaused) / TRANSITION_TIME, 0, 1);
    const realTransition = this._paused ? transition : 1 - transition;
    const easedTransition = realTransition; // Maybe add some easing

    if (easedTransition > 0) {
      canvasCtx.fillStyle = `rgba(0, 0, 0, ${0.5 * easedTransition})`
      canvasCtx.fillRect(0, 0, viewport.width, viewport.height)
      this.drawText({
        text: 'Paused', viewport, canvasCtx, color: 'white',
        style: (48 + (1 - easedTransition) * 12).toString() + 'px Roboto'
      });
    }
  }

  accept() {
    return !this._paused;
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

  timeSincePaused() {
    const now = Date.now();
    return now - this._timeToggledPaused;
  }
  
  getGoal() {
    return this._pos;
  }

  getScore() {
    return null;
  }
}