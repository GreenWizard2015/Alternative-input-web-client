import { Position } from "../components/SamplesDef";

export function drawTarget(
  { position, radius=10, canvasCtx, style }:
  { 
    position: Position,
    radius: number,
    canvasCtx: CanvasRenderingContext2D, style?: string 
  }
) {
    // draw just border of red circle, not filled
  canvasCtx.beginPath();
  canvasCtx.ellipse(position.x, position.y, radius * 2, radius * 2, 0, 0, Math.PI * 2);
  canvasCtx.strokeStyle = 'red';
  canvasCtx.lineWidth = 2;
  canvasCtx.setLineDash([5, 5]);
  canvasCtx.stroke();

  // draw "border" circle
  canvasCtx.beginPath();
  canvasCtx.ellipse(position.x, position.y, radius * 1.5, radius * 1.5, 0, 0, Math.PI * 2);
  canvasCtx.fillStyle = 'black';
  canvasCtx.fill();

  // draw main circle
  canvasCtx.beginPath();
  canvasCtx.ellipse(position.x, position.y, radius, radius, 0, 0, Math.PI * 2);
  canvasCtx.fillStyle = style || 'red';
  canvasCtx.fill();
};