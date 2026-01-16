import { add, distance, multiplyScalar, normalize, subtract } from '../utils/pointOperations';
import { AppMode, type AppModeRenderData } from './AppMode';
import type { IGameController } from '../types/ControllerInterface';
import type { Viewport } from './AppMode';
import type { Position } from '../shared/Sample';

export class MoveToGoal extends AppMode {
  _speed: number = 55 * 2 * 2;
  _goal: Position = { x: 0.5, y: 0.5 };
  _currentTime: number = 0;
  _active: boolean = true;

  constructor(controller: IGameController) {
    super(controller);
    this._speed = 55 * 2 * 2;
    this._pos = this._goal = { x: 0.5, y: 0.5 };
    this._currentTime = 0;
    this._active = true;
  }

  doTick(deltaT: number, viewport: Viewport): void {
    if (!this._active) {
      return;
    }

    this._currentTime += deltaT;

    const pos = AppMode.makeAbsolute({ position: this._pos, viewport });
    const goal = AppMode.makeAbsolute({ position: this._goal, viewport });

    const vec = normalize(subtract(goal, pos));
    const res = add(pos, multiplyScalar(vec, this._speed * deltaT));
    this._pos = AppMode.makeRelative({
      position: res,
      viewport,
    });

    const dist = distance(subtract(goal, pos));
    if (dist < 3.0) {
      this._goal = this._nextGoal(this._goal);
      this._currentTime = 0; // reset timer on goal change
    }
  }

  onRender(data: AppModeRenderData): void {
    super.onRender(data);
    const { viewport, canvasCtx } = data;
    this.drawTarget({
      viewport,
      canvasCtx,
      state: this._active ? 'active' : 'paused',
    });
  }

  protected _nextGoal(current: Position): Position {
    // Placeholder - subclasses should implement
    return current;
  }
}
