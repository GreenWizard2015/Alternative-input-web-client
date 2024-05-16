import Spline from "cubic-spline";
import { AppMode } from "./AppMode";
import { calcDistance, clip, generatePoints, uniform } from "./utils";

export class SplineMode extends AppMode {
  constructor() {
    super();
    this._pos = { x: 0.5, y: 0.5 }
    this._points = null;
    this._newSpline({ extend: false })
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
    this.drawTarget({ canvasCtx, viewport });
  }
}