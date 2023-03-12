import { AppMode } from "modes/AppMode";

function uniformRandom(min, max) {
    return min + Math.random() * max;
}

function rotate({ x, y }, rads) {
    return {
        x: Math.cos(rads) * x - Math.sin(rads) * y,
        y: Math.sin(rads) * x + Math.cos(rads) * y
    }
}

function add({ x: x1, y: y1 }, { x: x2, y: y2 }) {
    return {
        x: x1 + x2,
        y: y1 + y2
    }
}

function clip(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function allclose(a, b, rtol = 1e-05, atol = 1e-08) {
    return Math.abs(a - b) <= (atol + rtol * Math.abs(b));
}

export class SpinningTarget {
    constructor() {
        this._angle = uniformRandom(0, 2 * Math.PI);
        this._radius = 0.01;
        this._pos = { x: 0.5, y: 0.5 };
        this._startT = Date.now();
        this._TScale = 10;
    }

    onRender({ viewport, canvasCtx, goal }) {
        this._T = (Date.now() - this._startT) / 1000;
        // this._pos = goal;
        const T = (this._T / this._TScale) % (2 * Math.PI);
        this._radius = 0.001 + Math.cos(T) * 0.015;
        this._angle = (this._angle + .1) % (2 * Math.PI);
        const mainPos = AppMode.makeAbsolute({ position: goal, viewport });
        const vec = { x: viewport.width * this._radius, y: 0 };
        const rotatedVec = rotate(vec, this._angle);
        this._pos = {
            x: (mainPos.x + rotatedVec.x) / viewport.width,
            y: (mainPos.y + rotatedVec.y) / viewport.height
        }

        canvasCtx.save()
        canvasCtx.fillStyle = 'purple';

        const N = 5;
        for (let i = 0; i < N; i++) {
            const angle = i * 2 * Math.PI / N;
            const pos = add(mainPos, rotate(vec, this._angle + angle));
            const R = N + 3 - i;

            canvasCtx.beginPath();
            canvasCtx.ellipse(pos.x, pos.y, R, R, 0, 0, 2 * Math.PI);
            canvasCtx.fill();
        }

        const pos = add(mainPos, rotate(vec, this._angle));
        const R = N + 4;
        canvasCtx.fillStyle = 'gray';
        canvasCtx.beginPath();
        canvasCtx.ellipse(pos.x, pos.y, R, R, 0, 0, 2 * Math.PI);
        canvasCtx.fill();

        const clp = {
            x: clip(pos.x, 0, viewport.width),
            y: clip(pos.y, 0, viewport.height)
        }
        if (!(allclose(clp.x, pos.x) && allclose(clp.y, pos.y))) {
            canvasCtx.beginPath();
            canvasCtx.ellipse(clp.x, clp.y, R, R, 0, 0, 2 * Math.PI);
            canvasCtx.fill();
        }

        canvasCtx.restore();
    }

    getGoal() {
        return this._pos;
    }
}