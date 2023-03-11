export class AppMode {
    constructor({ canvasCtx }) {
        this._canvasCtx = canvasCtx;
        this._paused = true;
    }

    onKeyDown(event) {
        if(['KeyP', 'Enter'].includes(event.code)) {
            this._paused = !this._paused;
        }
    }

    onRender() {
        this._canvasCtx.drawText('Paused');
    }

    accept() {
        // TODO
    }
}