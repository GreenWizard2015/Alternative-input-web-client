import type { IGameController } from "../types/ControllerInterface";
import type { Goal, GoalColors } from "../types/Goal";
import { DEFAULT_GOAL, renderSymbol, ARROW_DISPLAY } from "../types/Goal";
import { drawArrow } from "../utils/target";

export default class MiniGameController implements IGameController {
  private _Signs: string[];
  private _mapping: string[] = ['z', 'a', 's', 'x'];
  private _arrowMapping: Map<string, number> = new Map(); // Map arrow key code to symbol index
  private _currentSign: number = 0;
  private _activeTime: number = 3; // 3 seconds (now in seconds, not ms)
  private _elapsedSinceActivation: number = 0; // Frame-based accumulation
  private _elapsedSinceStarted: number = 0; // Frame-based accumulation
  private _isActivated: boolean = false;
  private _score: number = 0;
  private _goalColors: GoalColors;
  private _scaleFactor: number = 1; // Size scale factor (size / 100)

  constructor(goalSettings: Goal = DEFAULT_GOAL) {
    // Use provided symbols instead of hardcoded Z/A/S/X
    this._Signs = goalSettings.symbols;
    // Map keyboard keys to user's symbols (normalized to lowercase for comparison)
    this._mapping = goalSettings.symbols.map(symbol => symbol.toLowerCase());
    this._currentSign = 0;
    this._activeTime = 3; // 3 seconds (frame-based)
    this._elapsedSinceActivation = 0;
    this._elapsedSinceStarted = 0;
    this._isActivated = false;
    this._score = 0;
    // Store colors for state-based rendering
    this._goalColors = goalSettings.colors;
    // Calculate scale factor from size percentage (backward compatible with default 100)
    this._scaleFactor = (goalSettings.size ?? 100) / 100;

    // Build arrow key mapping - maps arrow key codes to symbol indices
    this._arrowMapping = new Map<string, number>();
    const arrowCodeMap: Record<string, string> = {
      'ArrowUp': 'UpArrow',
      'ArrowDown': 'DownArrow',
      'ArrowLeft': 'LeftArrow',
      'ArrowRight': 'RightArrow',
    };

    goalSettings.symbols.forEach((symbol, index) => {
      // Find which arrow code triggers this symbol
      Object.entries(arrowCodeMap).forEach(([keyCode, arrowName]) => {
        if (symbol === arrowName) {
          this._arrowMapping.set(keyCode, index);
        }
      });
    });
  }

  onKeyDown(event: KeyboardEvent): void {
    // Check if it's an assigned arrow key
    const arrowIndex = this._arrowMapping.get(event.code);
    if (arrowIndex !== undefined) {
      const correct = arrowIndex === this._currentSign;

      if (correct) {
        this.reset();
        this._elapsedSinceActivation = 0; // Reset frame-based timer
        this._isActivated = true;
        this._score += 2 * this._timeBonus();
      } else {
        this._score -= 1 * this._timeBonus();
      }
      return;
    }

    // Original character key handling
    const key = event.key.toLowerCase();
    if(this._mapping.includes(key)) {
      const correct = this._mapping[this._currentSign] === key;
      if (correct) {
        this.reset();
        this._elapsedSinceActivation = 0; // Reset frame-based timer
        this._isActivated = true;
        this._score += 2 * this._timeBonus();
      } else {
        this._score -= 1 * this._timeBonus();
      }
    }
  }

  reset(): void {
    // randomly change the key, but not same as the current one
    const oldSign = this._currentSign;
    while (this._Signs.length > 1 && this._currentSign === oldSign) {
      this._currentSign = Math.floor(Math.random() * this._Signs.length);
    }
    // reset the active time, if it's not activated
    if (!this._isActivated) {
      this._elapsedSinceStarted = 0; // Frame-based reset
    }
    this._isActivated = false;
  }

  private _timeBonus(): number {
    const sec = Math.floor(this._elapsedSinceStarted);
    return Math.sqrt(1 + sec);
  }

  getScore(): number {
    return this._score;
  }

  isActivated(): boolean {
    const activated = this._isActivated && (this._elapsedSinceActivation < this._activeTime);
    return activated;
  }

  sign(): string {
    return this._Signs[this._currentSign];
  }

  isDummy(): boolean {
    return false;
  }

  doTick(deltaT: number): void {
    // Accumulate time with frame-based deltaT
    if (this._isActivated) {
      this._elapsedSinceActivation += deltaT;
    }
    this._elapsedSinceStarted += deltaT;
  }

  getGoalColor(state: 'active' | 'inactive' | 'paused'): string {
    // Return color for the given state (active/inactive/paused)
    return this._goalColors[state];
  }

  getGoalTextColor(): string {
    // Return text symbol color
    return this._goalColors.text;
  }

  drawTarget(canvasCtx: CanvasRenderingContext2D, position: { x: number; y: number }, state: 'active' | 'inactive' | 'paused' = 'active'): void {
    const height = canvasCtx.canvas.height;
    const width = canvasCtx.canvas.width;

    // Apply scale factor to all radii
    const outerRadius = 20 * this._scaleFactor;
    const borderRadius = 15 * this._scaleFactor;
    const mainRadius = 10 * this._scaleFactor;
    const centerRadius = 2 * this._scaleFactor;

    // draw dashed border circle (outer)
    canvasCtx.beginPath();
    canvasCtx.ellipse(position.x, position.y, outerRadius, outerRadius, 0, 0, Math.PI * 2);
    canvasCtx.strokeStyle = 'red';
    canvasCtx.lineWidth = 2;
    canvasCtx.setLineDash([5, 5]);
    canvasCtx.stroke();

    // draw black border circle
    canvasCtx.beginPath();
    canvasCtx.ellipse(position.x, position.y, borderRadius, borderRadius, 0, 0, Math.PI * 2);
    canvasCtx.fillStyle = 'black';
    canvasCtx.fill();

    // draw main circle with user's color
    canvasCtx.beginPath();
    canvasCtx.ellipse(position.x, position.y, mainRadius, mainRadius, 0, 0, Math.PI * 2);
    const style = this._goalColors[state];
    canvasCtx.fillStyle = style || this._goalColors.active;
    canvasCtx.fill();

    // draw center dot
    canvasCtx.beginPath();
    canvasCtx.ellipse(position.x, position.y, centerRadius, centerRadius, 0, 0, Math.PI * 2);
    canvasCtx.fillStyle = this._goalColors.text;
    canvasCtx.fill();

    const sign = renderSymbol(this.sign());

    const d = 10 * this._scaleFactor;
    const x = Math.max(d, Math.min(width - d, position.x));
    const y = Math.max(d, Math.min(height - d, position.y));

    // Scale symbol/arrow size
    const symbolSize = 16 * this._scaleFactor;

    if (ARROW_DISPLAY[this.sign() as keyof typeof ARROW_DISPLAY]) {
      // Draw arrow for arrow keys
      const directions: Record<string, number> = {
        'UpArrow': -Math.PI / 2,
        'RightArrow': 0,
        'DownArrow': Math.PI / 2,
        'LeftArrow': Math.PI
      };
      const position = {x, y};
      drawArrow({
        position,
        canvasCtx,
        direction: directions[this.sign()] || 0,
        size: symbolSize,
        color: this._goalColors.text
      });
    } else {
      // Draw text for other symbols
      canvasCtx.fillStyle = this._goalColors.text;
      canvasCtx.font = `bold ${symbolSize}px Arial`;
      canvasCtx.textAlign = 'center';
      canvasCtx.textBaseline = 'middle';
      canvasCtx.fillText(sign, x, y);
      // reset text alignment
      canvasCtx.textAlign = 'start';
      canvasCtx.textBaseline = 'alphabetic';
    }
  }
}
