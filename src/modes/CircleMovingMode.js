import { addScalar, multipleScalar } from "helpers/pointOperations";
import { MoveToGoal } from "./MoveToGoal";

export class CircleMovingMode extends MoveToGoal {
    constructor() {
        super();

        this._transitionT = 2;
        this._maxLevel = 25;
        this._level = 0;
        this._reset();
    }

    _nextGoal(old) {
        if (this._transitionStart === null) {
            this._transitionStart = Date.now();
        }

        if (Date.now() - this._transitionStart < this._transitionT * 1000) {
            return old;
        }

        this._transitionStart = null;
        if (self._path.length <= 0) {
            this._reset();
            return this._goal;
        }

        const goal = this._path.shift();
        return goal;
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
        [this._pos, this._goal, ..._path] = path.map(point => addScalar(multipleScalar(point, lvl), 0.5));
        this._active = false;
        this._transitionStart = null;
    }

    // We already have getGoal
}