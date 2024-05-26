import { AppMode } from "./AppMode";
import MiniGameController from "./MiniGameController";

export class LookAtMode extends AppMode {
  constructor() {
    super();
    this._visibleT = 5.0;
    this._pos = { x: 0.5, y: 0.5 };
    this._controller = new MiniGameController();
  }

  _next() {
    this._pos = { x: Math.random(), y: Math.random() };
    this._active = false;
    this._startT = null;
    this._controller.reset();
  }

  onKeyDown(event) {
    super.onKeyDown(event);
    this._controller.onKeyDown(event);
    this._active = this._controller.isActivated();
  }

  onRender({ viewport, canvasCtx }) {
    super.onRender({ viewport, canvasCtx });

    if (this._active) {
      const dT = Date.now() / 1000 - this._startT;
      if (this._visibleT < dT) {
        this._next();
      }
    } else {
      this._startT = Date.now() / 1000;
    }

    this.drawTarget({ 
      viewport, canvasCtx, 
      style: this._active ? 'red' : 'yellow',
      sign: this._controller.sign()
    });
  }

  accept() {
    if (this._active) {
      return super.accept();
    }
    return false;
  }

  getScore() {
    return this._controller.getScore();
  }
}