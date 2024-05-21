import { Position } from "../components/SamplesDef";

export function drawTarget(
  { position, radius=10, canvasCtx, style, sign }:
  { 
    position: Position,
    radius: number,
    canvasCtx: CanvasRenderingContext2D, style?: string, sign?: string
  }
) {
  const height = canvasCtx.canvas.height;
  const width = canvasCtx.canvas.width;
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

  // draw sign character at the center of the circle
  if (sign) {
    canvasCtx.fillStyle = 'lime';
    canvasCtx.font = 'bold 16px Arial';
    canvasCtx.textAlign = 'center';
    canvasCtx.textBaseline = 'middle';
    // sign x in 5..width-5, y in 5..height-5
    const d = 10;
    const x = Math.max(d, Math.min(width - d, position.x));
    const y = Math.max(d, Math.min(height - d, position.y));
    canvasCtx.fillText(sign, x, y + 2);
    // reset text alignment
    canvasCtx.textAlign = 'start';
    canvasCtx.textBaseline = 'alphabetic';
  }
};