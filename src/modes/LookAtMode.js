import { AppMode } from "./AppMode"

export class LookAtMode extends AppMode {
    constructor({ canvasCtx }) {
        super({ canvasCtx });
        // Maybe constant is better?
        this._visibleT = 5.0;
        this._pos = [0.5, 0.5];
    }

    _next() {
        this._pos = [Math.random(), Math.random()];
        this._active = false;
        this._startT = null;
    }

    onKeyDown(event) {
        super.onKeyDown(event);
        // Notice: Numpad keys won't work. If this's unwanted behaviour
        // use event.key instead.
        if(event.code = 'ArrowRight') {
            this._active = true;
        }
    }

    onRender(viewport) {
        super.onRender(viewport);

        // onRender = on_tick + on_render
        if(this._active) {
            const dT = Date.now() - this._startT;
            if(this._visibleT < dT) {
                this._next();
            }
        } else {
            this._startT = Date.now();
        }

        this.drawTarget(this._pos, viewport);
    }

    accept() {
        if(this._active) {
            super.accept();
        }
    }
}