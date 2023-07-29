type Viewport = { width: number, height: number }
type Position = { x: number, y: number }

const TRANSITION_TIME = 100;

function clamp(val: number, min: number, max: number) {
    if(val < min) return min
    if(val > max) return max
    return val
}

export class AppMode {
    _paused: boolean;
    _timeToggledPaused: number = 0;

    constructor() {
        this._paused = true;
    }

    onKeyDown(event: KeyboardEvent) {
        if (['KeyP', 'Enter'].includes(event.code)) {
            this._paused = !this._paused;
            this._timeToggledPaused = Date.now()
        }
    }

    onRender() {
        // Does nothing
    }

    onOverlay({ canvasCtx, viewport }: { canvasCtx: CanvasRenderingContext2D, viewport: Viewport }) {
        // Transition
        const transition = clamp((Date.now() - this._timeToggledPaused) / TRANSITION_TIME, 0, 1)
        const realTransition = this._paused ? transition : 1 - transition
        const easedTransition = realTransition // Maybe add some easing

        if (easedTransition > 0) {
            canvasCtx.save()
            canvasCtx.fillStyle = `rgba(0, 0, 0, ${0.5 * easedTransition})`
            canvasCtx.fillRect(0, 0, viewport.width, viewport.height)
            this.drawText({
                text: 'Paused', viewport, canvasCtx, color: 'white',
                style: (48 + (1 - easedTransition) * 12).toString() + 'px Roboto'
            });
            canvasCtx.restore()
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


    drawTarget({ position, viewport, canvasCtx, style }: { position: Position, viewport: Viewport, canvasCtx: CanvasRenderingContext2D, style?: string }) {
        const absolutePosition = AppMode.makeAbsolute({ position, viewport });

        canvasCtx.save();
        canvasCtx.beginPath();
        canvasCtx.ellipse(absolutePosition.x, absolutePosition.y, 10, 10, 0, 0, Math.PI * 2);
        canvasCtx.fillStyle = style || 'red';
        canvasCtx.fill();
        canvasCtx.restore();
    }

    drawText({ text, viewport, canvasCtx, color, style }: { text: string, viewport: Viewport, canvasCtx: CanvasRenderingContext2D, color?: string, style?:string }) {
        canvasCtx.save();
        canvasCtx.font = style || '48px Roboto';
        canvasCtx.fillStyle = color || 'red';
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