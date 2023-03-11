import { AppMode } from "./AppMode";

function mod(x, y) {
    return ((x % y) + y) % y;
}

export class CornerMode extends AppMode {
    constructor() {
        super();
        this._pos = { x: 0.5, y: 0.5 };
        // this._target = ... TODO
        this._startT = Date.now();
        this._radius = 0.05;
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
        const dT = Date.now() - this._startT;
        const R = Math.abs(Math.sin(dT * 4)) * this._radius;
        const currentCorner = this._CORNERS[this._cornerId];
        const goal = {
            x: currentCorner[0] + Math.cos(dT) * R,
            y: currentCorner[1] + Math.sin(dT) * R
        }
        this._target.onRender({ viewport, canvasCtx, goal })
        this._pos = this._target.getGoal();
    }

    onKeyDown(event) {
        super.onKeyDown(event);

        if (event.code == 'ArrowLeft') {
            this._paused = true;
            this._cornerId = mod(this._cornerId - 1, this._CORNERS.length);
        }

        if (event.code == 'ArrowRight') {
            this._paused = true;
            this._cornerId = mod(this._cornerId + 1, this._CORNERS.length);
        }
    }

    getGoal() {
        return this._pos;
    }
}