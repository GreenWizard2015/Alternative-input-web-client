import { AppMode } from "./AppMode";

export class LookAtMode extends AppMode {
  constructor(controller) {
    super();
    this._visibleT = 5.0;
    this._pos = { x: 0.5, y: 0.5 };
    this._controller = controller;
    this._currentTime = 0;
  }

  _next() {
    this._pos = { x: Math.random(), y: Math.random() };
    this._active = false;
    this._currentTime = 0;
    this._controller.reset();
  }

  onKeyDown(event) {
    super.onKeyDown(event);
    this._controller.onKeyDown(event);
    this._active = this._controller.isActivated();
  }

  doTick(deltaT, viewport) {
    if (this._active) {
      this._currentTime += deltaT;
      if (this._visibleT < this._currentTime) {
        this._next();
      }
    } else {
      this._currentTime = 0;
    }
  }

  onRender(data) {
    super.onRender(data);
    const { viewport, canvasCtx } = data;

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