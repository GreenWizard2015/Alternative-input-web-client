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

    onRender(viewport) {
        // Drawing properly centered text is hard T-T
        this._canvasCtx.drawText('Paused', 100, 100);
    }

    accept() {
        // TODO
    }

    drawTarget(pos, viewport) {
        const ctx = this._canvasCtx;
        const x = pos[0] * viewport.width;
        const y = pos[1] * viewport.height;
        
        ctx.save();
        ctx.beginPath(x, y, 100, 100, 0, Math.PI * 2);
        ctx.fillStyle = "red";
        ctx.fill();
        ctx.restore();
    }
}