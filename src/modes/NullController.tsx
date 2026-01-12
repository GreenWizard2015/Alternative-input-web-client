import type { IGameController } from "../types/ControllerInterface";
import type { Goal, GoalColors } from "../types/Goal";
import { DEFAULT_GOAL } from "../types/Goal";

export default class NullController implements IGameController {
  private _goalColors: GoalColors;

  constructor(goalSettings: Goal = DEFAULT_GOAL) {
    // Accept goalSettings for compatibility, but no-op for NullController
    this._goalColors = goalSettings.colors;
  }

  onKeyDown(event: KeyboardEvent): void {
    // No-op
  }

  reset(): void {
    // No-op
  }

  getScore(): number {
    return 0;
  }

  isActivated(): boolean {
    return true;
  }

  sign(): string {
    return '';
  }

  isDummy(): boolean {
    return true;
  }

  doTick(deltaT: number): void {
    // No-op for NullController - doesn't track time
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
    // Draw default goal for NullController with user's colors
    const style = this._goalColors[state];

    // draw dashed border circle (outer)
    canvasCtx.beginPath();
    canvasCtx.ellipse(position.x, position.y, 20, 20, 0, 0, Math.PI * 2);
    canvasCtx.strokeStyle = 'red';
    canvasCtx.lineWidth = 2;
    canvasCtx.setLineDash([5, 5]);
    canvasCtx.stroke();

    // draw black border circle
    canvasCtx.beginPath();
    canvasCtx.ellipse(position.x, position.y, 15, 15, 0, 0, Math.PI * 2);
    canvasCtx.fillStyle = 'black';
    canvasCtx.fill();

    // draw main circle with user's color
    canvasCtx.beginPath();
    canvasCtx.ellipse(position.x, position.y, 10, 10, 0, 0, Math.PI * 2);
    canvasCtx.fillStyle = style || this._goalColors.active;
    canvasCtx.fill();

    // draw center dot
    canvasCtx.beginPath();
    canvasCtx.ellipse(position.x, position.y, 2, 2, 0, 0, Math.PI * 2);
    canvasCtx.fillStyle = this._goalColors.text;
    canvasCtx.fill();
  }
}
