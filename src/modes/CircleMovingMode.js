import { add, addScalar, multipleScalar, subtract } from "../utils/pointOperations";
import { AppMode } from "./AppMode";
import { calcDistance, uniform } from "./utils";

export class CircleMovingMode extends AppMode {
  constructor() {
    super();

    this._maxLevel = 25;
    this._level = 5;
    this._reset();
  }

  onRender({ viewport, canvasCtx }) {
    super.onRender({ viewport, canvasCtx });
    // update goal
    const now = Date.now();
    const dt = this._active ? Math.max(
      0,
      Math.min(1, (now - this._startT) / this._maxT)
    ) : 0;
    if ((1 === dt) && this._active) { // if we reached the end
      this._active = false;
      this._pos = this._path[0];
    }
    if(0 === dt) { // if we are at the start
      this._pos = this._path[0];
    }
    if ((0 < dt) && (dt < 1)) { // if we are in the middle
      // find the segment
      let i = 0;
      while (this._distances[i] < dt) {
        i++;
      }
      const relT = (dt - this._distances[i - 1]) / (this._distances[i] - this._distances[i - 1]);
      const A = this._path[i - 1];
      const B = this._path[i];
      this._pos = add(
        A,
        multipleScalar(
          subtract(B, A), // B - A
          relT
        ) // A + (B - A) * relT
      );
    }

    // draw it
    this.drawTarget({ canvasCtx, viewport, style: this._active ? 'red' : 'silver' });
  }

  onKeyDown(event) {
    super.onKeyDown(event);
    if (event.code === 'ArrowUp') {
      this._level = Math.min(this._maxLevel, this._level + 1);
      this._reset();
    }

    if (event.code === 'ArrowDown') {
      this._level = Math.max(0, this._level - 1);
      this._reset();
    }
    
    if (event.code === 'ArrowRight') {
      this._active = true;
      this._startT = Date.now(); // start time
    }
  }

  accept() {
    if (this._active) {
      return super.accept();
    }
    return false;
  }

  _reset() {
    const path = [
      { x: -1, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: -1 },
      { x: -1, y: -1 },
      { x: -1, y: 1 }
    ];
    const lvl = (this._maxLevel - this._level) / (2 * this._maxLevel);
    this._path = path.map(
      point => addScalar(multipleScalar(point, lvl), 0.5)
    );
    // calculate an array of distances between points
    this._distances = calcDistance(this._path);
    const totalDistance = this._distances[this._distances.length - 1];
    const speed = uniform(0.1, 0.4);
    // normalize distances
    this._distances = this._distances.map(d => d / totalDistance);
    this._maxT = (totalDistance / speed) * 1000; // in milliseconds

    this._active = false;
    this._startT = null;
  }
}