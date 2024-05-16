import { add, distance, multipleScalar, normalize, subtract } from "../utils/pointOperations";
import { AppMode } from "./AppMode";

export class MoveToGoal extends AppMode {
  constructor() {
    super();
    this._speed = 55 * 2 * 2;
    this._pos = this._goal = { x: 0.5, y: 0.5 };
    this._startT = Date.now();
    this._active = true;
  }

  onRender({ viewport, canvasCtx }) {
    super.onRender({ viewport, canvasCtx });
    
    const deltaT = (Date.now() - this._startT) / 1000;
    this._startT = Date.now();
    
    if(!this._active) {
      this.drawTarget({ viewport, canvasCtx, style: 'gray' });
      return
    }

    const pos = AppMode.makeAbsolute({ position: this._pos, viewport });
    const goal = AppMode.makeAbsolute({ position: this._goal, viewport });

    const vec = normalize(subtract(goal, pos));
    const res = add(pos, multipleScalar(vec, this._speed * deltaT))
    this._pos = AppMode.makeRelative({
      position: res,
      viewport
    });

    const dist = distance(subtract(pos, goal));
    if(dist < 3.0) {
      this._goal = this._nextGoal(this._goal);
    }

    this.drawTarget({ viewport, canvasCtx });
  }
}