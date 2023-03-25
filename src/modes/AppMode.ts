type Viewport = { width: number, height: number }
type Position = { x: number, y: number }

export class AppMode {
    _paused: boolean;

    constructor() {
        this._paused = true;
    }

    onKeyDown(event: KeyboardEvent) {
        if (['KeyP', 'Enter'].includes(event.code)) {
            this._paused = !this._paused;
        }
    }

    onRender({ canvasCtx, viewport }: { canvasCtx: CanvasRenderingContext2D, viewport: Viewport }) {
        // Drawing properly centered text is hard T-T
        if (this._paused) {
            this.drawText({ text: 'Paused', viewport, canvasCtx });
        }
    }

    accept() {
        return !this._paused;
    }

    static makeAbsolute({ position, viewport }: { position: Position, viewport: Viewport }) {
        return {
            x: position.x * viewport.width,
            y: position.y * viewport.height
        }
    }

    static makeRelative({ position, viewport }: { position: Position, viewport: Viewport }) {
        return {
            x: position.x / viewport.width,
            y: position.y / viewport.height
        }
    }


    drawTarget({ position, viewport, canvasCtx, style }: { position: Position, viewport: Viewport, canvasCtx: CanvasRenderingContext2D, style: string }) {
        const absolutePosition = AppMode.makeAbsolute({ position, viewport });

        canvasCtx.save();
        canvasCtx.beginPath();
        canvasCtx.ellipse(absolutePosition.x, absolutePosition.y, 10, 10, 0, 0, Math.PI * 2);
        canvasCtx.fillStyle = style || 'red';
        canvasCtx.fill();
        canvasCtx.restore();
    }

    drawText({ text, viewport, canvasCtx }: { text: string, viewport: Viewport, canvasCtx: CanvasRenderingContext2D }) {
        canvasCtx.save();
        canvasCtx.font = '48px Roboto';
        canvasCtx.fillStyle = 'red';
        canvasCtx.textBaseline = 'middle';
        const size = canvasCtx.measureText(text);
        canvasCtx.fillText(
            text,
            (viewport.width - size.width) / 2,
            (viewport.height) / 2
        );
        canvasCtx.restore();
    }
}