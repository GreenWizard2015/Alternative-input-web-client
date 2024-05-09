import Spline from "cubic-spline";
import { SpinningTarget } from "../utils/SpinningTarget";
import { AppMode } from "./AppMode";

function gaussian(mean = 0, stdev = 1) {
    let u = 1 - Math.random(); // Converting [0,1) to (0,1]
    let v = Math.random();
    let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    // Transform to the desired mean and standard deviation:
    return z * stdev + mean;
}

function uniform(min, max) {
    return min + Math.random() * (max - min);
}

function generatePoints(count) {
    const res = new Array(count);
    for (let i = 0; i < count; i++) {
        res[i] = {
            x: gaussian(0.5, 0.5),
            y: gaussian(0.5, 0.5)
        };
    }
    return res;
}

function clip(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function distance({ x: x1, y: y1 }, { x: x2, y: y2 }) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function calcDistance(points) {
    // I don't care about performance
    return points.slice(1).reduce(({ acc, lp }, point) => {
        return {
            acc: acc.concat([distance(lp, point) + acc[acc.length - 1]]),
            lp: point
        }
    }, { acc: [0], lp: points[0] }).acc;
}

export class SplineMode extends AppMode {
    constructor() {
        super();
        this._pos = { x: 0.5, y: 0.5 }
        this._target = new SpinningTarget();
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
        }
        this._getPoint = t => ({
            x: splines.x.at(t * (1 - shift) + shift),
            y: splines.y.at(t * (1 - shift) + shift)
        })
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
        this._target.onRender({ viewport, canvasCtx, goal: pos });
        this._pos = this._target.getGoal();
    }

    getGoal() {
        return this._pos;
    }
}