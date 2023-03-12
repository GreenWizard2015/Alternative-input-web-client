export class AppMode {
    constructor() {
        this._paused = true;
    }

    onKeyDown(event) {
        if(['KeyP', 'Enter'].includes(event.code)) {
            this._paused = !this._paused;
        }
    }

    onRender({ canvasCtx }) {
        // Drawing properly centered text is hard T-T
        if(this._paused) {
            canvasCtx.save();
            canvasCtx.fillStyle = "red";
            canvasCtx.fillText('Paused', 100, 100);
            canvasCtx.restore();
        }
    }

    accept() {
        return !this._paused;
    }

    static makeAbsolute({ position, viewport }) {
        return {
            x: position.x * viewport.width,
            y: position.y * viewport.height
        }
    }

    static makeRelative({ position, viewport }) {
        return {
            x: position.x / viewport.width,
            y: position.y / viewport.height
        }
    }


    drawTarget({ position, viewport, canvasCtx, style }) {
        const absolutePosition = AppMode.makeAbsolute({ position, viewport });
        
        canvasCtx.save();
        canvasCtx.beginPath();
        canvasCtx.ellipse(absolutePosition.x, absolutePosition.y, 10, 10, 0, 0, Math.PI * 2);
        canvasCtx.fillStyle = style || 'red';
        canvasCtx.fill();
        canvasCtx.restore();
    }
}