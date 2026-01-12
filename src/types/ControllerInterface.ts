export interface IGameController {
  onKeyDown(event: KeyboardEvent): void;
  reset(): void;
  getScore(): number;
  isActivated(): boolean;
  sign(): string;
  isDummy(): boolean;
  getGoalColor(state: 'active' | 'inactive' | 'paused'): string;
  getGoalTextColor(): string;
  drawTarget(
    canvasCtx: CanvasRenderingContext2D,
    position: { x: number; y: number },
    state?: 'active' | 'inactive' | 'paused'
  ): void;
  doTick(deltaT: number): void;
}
