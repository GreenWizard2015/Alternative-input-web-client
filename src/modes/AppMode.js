export class AppMode {
    constructor() {
        this._paused = true;
    }

    onKeyDown(event) {
        if (['KeyP', 'Enter'].includes(event.code)) {
            this._paused = !this._paused;
        }
    }

    onRender({ canvasCtx, viewport }) {
        // Drawing properly centered text is hard T-T
        if (this._paused) {
            this.drawText({ text: 'Paused', viewport, canvasCtx });
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

    drawText({ text, viewport, canvasCtx }) {
        canvasCtx.save();
        canvasCtx.font = '48px serif';
        canvasCtx.fillStyle = 'red';
        const size = canvasCtx.measureText(text);
        canvasCtx.fillText(
            text,
            (viewport.width - size.width) / 2,
            (viewport.height - 48) / 2
        );
        canvasCtx.restore();
    }
}