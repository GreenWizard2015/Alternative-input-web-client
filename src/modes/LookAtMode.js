import { AppMode } from "./AppMode"

export class LookAtMode extends AppMode {
  constructor() {
    super();
    // Maybe constant is better?
    this._visibleT = 5.0;
    this._pos = { x: 0.5, y: 0.5 };
  }

  _next() {
    this._pos = { x: Math.random(), y: Math.random() };
    this._active = false;
    this._startT = null;
  }

  onKeyDown(event) {
    super.onKeyDown(event);
    // Notice: Numpad keys won't work. If this's unwanted behaviour
    // use event.key instead.
    if (event.code === 'ArrowRight') {
      this._active = true;
    }
  }

  onRender({ viewport, canvasCtx }) {
    super.onRender({ viewport, canvasCtx });

    // onRender = on_tick + on_render
    if (this._active) {
      const dT = Date.now() / 1000 - this._startT;
      if (this._visibleT < dT) {
        this._next();
      }
    } else {
      this._startT = Date.now() / 1000;
    }

    this.drawTarget({ viewport, canvasCtx, style: this._active ? 'red' : 'gray' });
  }

  accept() {
    if (this._active) {
      return super.accept();
    }
    return false;
  }
}