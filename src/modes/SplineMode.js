import Spline from "cubic-spline";
import { AppMode } from "./AppMode";
import { calcDistance, clip, generatePoints, uniform } from "./utils";

export class SplineMode extends AppMode {
  constructor() {
    super();
    this._pos = { x: 0.5, y: 0.5 }
    this._points = null;
    this._newSpline({ extend: false });

    this._Signs = ['Z', 'A', 'S', 'X'];
    this._mapping = ['z', 'a', 's', 'x'];
    this._currentSign = 0;
    this._activeTime = 3 * 1000; // 3 seconds
    this._lastActiveTime = 0;
    this._started = 0;
    this._isActivated = false; 
    this._score = 0;   
  }

  _newSpline({ extend } = { extend: true }) {
    this._startT = Date.now();
    const N = 3;
    let points = generatePoints(4);
    if (extend) {
        points = this._points.slice(-N).concat(points);
    }
    this._points = points = points.map(({ x, y }) => ({ x: clip(x, -0.5, 1.5), y: clip(y, -0.5, 1.5) }));
    let distance = calcDistance(points);
    // I'm already prepended a zero
    const speed = uniform(0.15, 1.0);
    const fullDistance = distance[distance.length - 1];
    const T = fullDistance / speed;
    this._maxT = clip(T, 20, 40);
    distance = distance.map(dist => dist / fullDistance);

    const shift = extend ? distance[N - 1] : 0.0;
    const splines = {
        x: new Spline(distance, points.map(point => point.x)),
        y: new Spline(distance, points.map(point => point.y))
    };
    this._getPoint = t => ({
        x: splines.x.at(t * (1 - shift) + shift),
        y: splines.y.at(t * (1 - shift) + shift)
    });
  }

  onRender({ viewport, canvasCtx }) {
    super.onRender({ viewport, canvasCtx });
    this._T = (Date.now() - this._startT) / 1000;
    if (this._maxT < this._T) this._newSpline();

    let pos = this._getPoint(this._T / this._maxT);
    pos = {
      x: clip(pos.x, 0.0, 1.0),
      y: clip(pos.y, 0.0, 1.0)
    };

    if (!isNaN(pos.x) && !isNaN(pos.y)) { // sometimes it's NaN, ignore it
      this._pos = pos;
    }
    this._isActivated = (Date.now() - this._lastActiveTime) < this._activeTime;
    this.drawTarget({ 
      canvasCtx, viewport,
      style: this._isActivated ? 'red' : 'yellow',
      sign: this._Signs[this._currentSign],
    });
  }

  onKeyDown(event) {
    const key = event.key.toLowerCase();
    if(this._mapping.includes(key)) {
      const correct = this._mapping[this._currentSign] === key;
      if (correct) {
        // randomly change the key, but not same as the current one
        const oldSign = this._currentSign;
        while (this._currentSign === oldSign) {
          this._currentSign = Math.floor(Math.random() * this._Signs.length);
        }
        // reset the active time, if it's not activated
        if (!this._isActivated) {
          this._started = Date.now();
        }
        this._lastActiveTime = Date.now();
        this._isActivated = true;
        this._score += 2 * this._timeBonus();
      } else {
        this._score -= 1 * this._timeBonus();
      }
    }
    super.onKeyDown(event);
  }

  _timeBonus() {
    const now = Date.now();
    const sec = Math.floor((now - this._started) / 1000);
    return Math.sqrt(1 + sec);
  }

  getScore() {
    return this._score;
  }

  accept() {
    if(!this._isActivated) {
      return false;
    }
    return super.accept();
  }
}