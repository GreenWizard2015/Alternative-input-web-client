import { AppMode } from "./AppMode";

function mod(x, y) {
    return ((x % y) + y) % y;
}

function clip(value, min, max) {
    if(value < min) return min;
    if(value > max) return max;
    return value;
}

export class CornerMode extends AppMode {
    constructor() {
        super();
        this._pos = { x: 0.5, y: 0.5 };
        this._startT = Date.now();
        this._radius = 0.25;
        this._CORNERS = [
            [0.0, 0.0],
            [0.0, 1.0],
            [1.0, 0.0],
            [1.0, 1.1]
        ]
        this._cornerId = 0;
    }

    onRender({ viewport, canvasCtx }) {
        super.onRender({ viewport, canvasCtx });
        const dT = (Date.now() - this._startT) / 1000;
        const R = Math.abs(Math.sin(dT * 2)) * this._radius;
        const currentCorner = this._CORNERS[this._cornerId];
        this._pos = {
            x: clip(currentCorner[0] + Math.cos(dT) * R, 0.0, 1.0),
            y: clip(currentCorner[1] + Math.sin(dT) * R, 0.0, 1.0)
        }
        this.drawTarget({ position: this._pos, canvasCtx, viewport });
    }

    onKeyDown(event) {
        super.onKeyDown(event);

        if (event.code === 'ArrowLeft') {
            this._paused = true;
            this._cornerId = mod(this._cornerId - 1, this._CORNERS.length);
        }

        if (event.code === 'ArrowRight') {
            this._paused = true;
            this._cornerId = mod(this._cornerId + 1, this._CORNERS.length);
        }
    }

    getGoal() {
        return this._pos;
    }
}