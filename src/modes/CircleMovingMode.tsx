import { add, addScalar, multiplyScalar, subtract } from "../utils/pointOperations";
import { AppMode } from "./AppMode";
import { calcDistance, uniform } from "./utils";
import type { IGameController } from "../types/ControllerInterface";
import type { Viewport } from "./AppMode";

export class CircleMovingMode extends AppMode {
  _maxLevel: number = 25;
  _level: number = 5;
  _currentTime: number = 0;
  _active: boolean = false;
  _maxT: number = 0;
  _path: Array<{ x: number; y: number }> = [];
  _distances: number[] = [];

  constructor(controller: IGameController) {
    super(controller);
    this._reset(false);
  }

  doTick(deltaT: number, _viewport: Viewport): void {
    // update goal
    if (this._active) {
      this._currentTime += deltaT;
    }
    const dt = this._active ? Math.max(
      0,
      Math.min(1, this._currentTime / this._maxT)
    ) : 0;
    if ((1 === dt) && this._active) { // if we reached the end, randomly set level for next iteration
      this._level = Math.floor(Math.random() * this._maxLevel);
      this._reset(false);
    }
    if(0 === dt) { // if we are at the start
      this._pos = this._path[0];
    }
    if ((0 < dt) && (dt < 1)) { // if we are in the middle
      // find the segment
      let i = 0;
      while (i < this._distances.length - 1 && this._distances[i] < dt) {
        i++;
      }
      const relT = (dt - this._distances[i - 1]) / (this._distances[i] - this._distances[i - 1]);
      const A = this._path[i - 1];
      const B = this._path[i];
      this._pos = add(
        A,
        multiplyScalar(
          subtract(B, A), // B - A
          relT
        ) // A + (B - A) * relT
      );
    }
  }

  onRender(data: any): void {
    super.onRender(data);
    const { viewport, canvasCtx } = data;

    // draw it with controller (respects user's goal settings)
    this.drawTarget({
      viewport, canvasCtx,
      state: this._controller.isActivated() ? 'active' : 'inactive'
    });
  }

  onKeyDown(event: KeyboardEvent): void {
    super.onKeyDown(event);
    if (!this._active && this._controller.isActivated()) {
      this._reset(true);
      return;
    }

    // Numpad Enter to activate
    if (event.code === 'NumpadEnter') {
      this._reset(true);
      return;
    }

    // Level control with numpad +/- keys only
    if (event.code === 'NumpadAdd') {
      this._level = Math.min(this._maxLevel, this._level + 1);
      this._reset(false);
      return;
    }

    if (event.code === 'NumpadSubtract') {
      this._level = Math.max(0, this._level - 1);
      this._reset(false);
      return;
    }
  }

  _reset(start: boolean): void {
    const path = [
      { x: -1, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: -1 },
      { x: -1, y: -1 },
      { x: -1, y: 1 }
    ];
    const lvl = (this._maxLevel - this._level) / (2 * this._maxLevel);
    this._path = path.map(
      point => addScalar(multiplyScalar(point, lvl), 0.5)
    );
    // calculate an array of distances between points
    this._distances = calcDistance(this._path);
    const totalDistance = this._distances[this._distances.length - 1];
    const speed = uniform(0.05, 0.15);
    // normalize distances
    this._distances = this._distances.map(d => d / totalDistance);
    this._maxT = totalDistance / speed; // in seconds (since we use deltaT in seconds)

    // Always reset timer
    this._currentTime = 0;
    this._active = start;
  }

  accept(): boolean {
    if (this._active && this._controller.isActivated()) {
      return super.accept();
    }
    return false;
  }

  getScore(): number | null {
    return this._controller.getScore();
  }
}
