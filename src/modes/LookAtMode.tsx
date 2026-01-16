import { AppMode, type AppModeRenderData } from './AppMode';
import type { IGameController } from '../types/ControllerInterface';
import type { Viewport } from './AppMode';

export class LookAtMode extends AppMode {
  _visibleT: number = 5.0;
  _currentTime: number = 0;
  _active: boolean = false;

  constructor(controller: IGameController) {
    super(controller);
    this._visibleT = 5.0;
    this._pos = { x: 0.5, y: 0.5 };
    this._currentTime = 0;
  }

  _next(): void {
    this._pos = { x: Math.random(), y: Math.random() };
    this._active = false;
    this._currentTime = 0;
    this._controller.reset();
  }

  onKeyDown(event: KeyboardEvent): void {
    super.onKeyDown(event);
    this._active = this._controller.isActivated();
  }

  doTick(deltaT: number, _viewport: Viewport): void {
    if (this._active) {
      this._currentTime += deltaT;
      if (this._visibleT < this._currentTime) {
        this._next();
      }
    } else {
      this._currentTime = 0;
    }
  }

  onRender(data: AppModeRenderData): void {
    super.onRender(data);
    const { viewport, canvasCtx } = data;

    this.drawTarget({
      viewport,
      canvasCtx,
      state: this._active ? 'active' : 'inactive',
    });
  }

  accept(): boolean {
    if (this._active) {
      return super.accept();
    }
    return false;
  }

  getScore(): number | null {
    return this._controller.getScore();
  }
}
