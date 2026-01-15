import type { Position } from "../shared/Sample";

export function drawArrow(
  { position, canvasCtx, direction=0, size=20, color='white' }:
  {
    position: Position,
    canvasCtx: CanvasRenderingContext2D,
    direction?: number, // angle in radians
    size?: number,
    color?: string
  }
) {
  const ctx = canvasCtx;
  ctx.save();

  // Translate to position and rotate
  ctx.translate(position.x, position.y);
  ctx.rotate(direction);

  // Draw arrow shape
  ctx.beginPath();
  ctx.fillStyle = color;

  // Arrow dimensions
  const tipLength = size * 0.6;
  const baseWidth = size * 0.75;
  const stemWidth = size * 0.25;

  // Move to stem base
  ctx.moveTo(-tipLength + stemWidth/2, -stemWidth/2);

  // Draw stem
  ctx.lineTo(tipLength * 0.3, -stemWidth/2);
  ctx.lineTo(tipLength * 0.3, -baseWidth/2);

  // Draw arrow head
  ctx.lineTo(tipLength, 0);
  ctx.lineTo(tipLength * 0.3, baseWidth/2);

  // Complete stem
  ctx.lineTo(tipLength * 0.3, stemWidth/2);
  ctx.lineTo(-tipLength + stemWidth/2, stemWidth/2);

  // Close back to stem base
  ctx.lineTo(-tipLength + stemWidth/2, -stemWidth/2);

  ctx.fill();

  // Add border for better visibility
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

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

  // draw circle in center
  canvasCtx.beginPath();
  canvasCtx.ellipse(position.x, position.y, 2, 2, 0, 0, Math.PI * 2);
  canvasCtx.fillStyle = 'lime';
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