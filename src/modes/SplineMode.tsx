import Spline from "cubic-spline";
import { AppMode } from "./AppMode";
import { calcDistance, clip, generatePoints, uniform } from "./utils";
import type { IGameController } from "../types/ControllerInterface";
import type { Viewport } from "./AppMode";

export class SplineMode extends AppMode {
  _currentTime: number = 0;
  _maxT: number = 0;
  _points: Array<{ x: number; y: number }> | null = null;
  _getPoint: (t: number) => { x: number; y: number } = () => ({ x: 0, y: 0 });

  constructor(controller: IGameController) {
    super(controller);
    this._pos = { x: 0.5, y: 0.5 }
    this._points = null;
    this._currentTime = 0;
    this._newSpline({ extend: false });
  }

  _newSpline({ extend = true }: { extend?: boolean } = {}): void {
    this._currentTime = 0;
    const N = 3;
    let points = generatePoints(4);
    if (extend && this._points) {
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

  doTick(deltaT: number, _viewport: Viewport): void {
    this._currentTime += deltaT;
    if (this._maxT < this._currentTime) this._newSpline();

    let pos = this._getPoint(this._currentTime / this._maxT);
    pos = {
      x: clip(pos.x, 0.0, 1.0),
      y: clip(pos.y, 0.0, 1.0)
    };

    if (!isNaN(pos.x) && !isNaN(pos.y)) { // sometimes it's NaN, ignore it
      this._pos = pos;
    }
  }

  onRender(data: any): void {
    super.onRender(data);
    const { viewport, canvasCtx } = data;

    this.drawTarget({
      viewport, canvasCtx,
      state: this._controller.isActivated() ? 'active' : 'inactive'
    });
  }

  onKeyDown(event: KeyboardEvent): void {
    super.onKeyDown(event);
  }

  getScore(): number | null {
    return this._controller.getScore();
  }

  accept(): boolean {
    if(!this._controller.isActivated()) {
      return false;
    }
    return super.accept();
  }
}
