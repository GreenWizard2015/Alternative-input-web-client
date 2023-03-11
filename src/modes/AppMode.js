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
        const ctx = this._canvasCtx;
        
        // Drawing properly centered text is hard T-T
        if(this._paused) {
            ctx.save();
            ctx.fillStyle = "red";
            this._canvasCtx.fillText('Paused', 100, 100);
            ctx.restore();
        }
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