import i18n from "../i18n";
import { grayscale2image, decodeLandmarks } from "../utils/MP";
import { DetectionResult } from "../components/FaceDetector";
import type { Position } from "../shared/Sample";
import type { AppMode } from "./AppMode";
import type { IGameController } from "../types/ControllerInterface";

type MenuTickData = {
  canvas: HTMLCanvasElement;
  canvasCtx: CanvasRenderingContext2D;
  viewport: { left: number; top: number; width: number; height: number };
  goal: Position | null;
  user: string;
  screenId: string;
  gameMode: AppMode | null;
  activeUploads: number;
  meanUploadDuration: number;
  eyesDetected: boolean;
  detections: Map<string, DetectionResult>;
  collectedSampleCounts: Record<string, number>;
  controller: IGameController;
};

export function onMenuTick({
  viewport, canvasCtx, detections, controller
}: MenuTickData) {
  const { t } = i18n;
  // Draw all camera frames in grid layout
  if (detections && detections.size > 0) {
    const camerasCount = detections.size;
    const cols = Math.ceil(Math.sqrt(camerasCount));
    const rows = Math.ceil(camerasCount / cols);
    const cellWidth = viewport.width / cols;
    const cellHeight = viewport.height / rows;

    let index = 0;
    detections.forEach((detection: DetectionResult) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = col * cellWidth;
      const y = row * cellHeight;

      // // Draw frame image
      // canvasCtx.drawImage(frameImage, x, y, cellWidth, cellHeight);

      // Draw border and label
      canvasCtx.strokeStyle = '#00ff00';
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeRect(x, y, cellWidth, cellHeight);

      // Draw camera index label
      canvasCtx.fillStyle = '#00ff00';
      canvasCtx.font = '14px monospace';
      canvasCtx.fillText(t('canvas.cameraLabel', { index }), x + 10, y + 25);

      // Draw landmarks for this camera (normalized 0-1 range)
      if (detection.sample && detection.sample.points) {
        canvasCtx.strokeStyle = "red";
        canvasCtx.lineWidth = 1;
        // Convert Float32Array to NormalizedLandmark format for decodeLandmarks
        const landmarks = [];
        for (let i = 0; i < detection.sample.points.length; i += 2) {
          landmarks.push({
            x: detection.sample.points[i],
            y: detection.sample.points[i + 1],
            visibility: detection.sample.points[i] >= 0 && detection.sample.points[i + 1] >= 0 ? 1 : 0
          });
        }

        // Decode using cell dimensions to convert from 0-1 range to pixel coordinates
        const points = decodeLandmarks(landmarks, {
          width: cellWidth,
          height: cellHeight,
          visibilityThreshold: 0.5
        });

        // Draw landmark points
        for (const point of points) {
          canvasCtx.beginPath();
          canvasCtx.arc(x + point.x, y + point.y, 2, 0, 2 * Math.PI);
          canvasCtx.stroke();
          canvasCtx.closePath();
        }
      }

      // Draw eye crops for this camera (already cropped and grayscale)
      // Side by side at top-left
      if (detection.sample && detection.settings) {
        const { SIZE } = detection.settings;
        const eyeY = 40 + (SIZE + 5) * index; // Below the camera label
        const eyeX = 0;

        if (detection.sample.leftEye) {
          const leftEyeImage = grayscale2image(detection.sample.leftEye, SIZE);
          // Draw left eye crop
          canvasCtx.putImageData(
            leftEyeImage,
            eyeX + 5,
            eyeY
          );
        }

        if (detection.sample.rightEye) {
          const rightEyeImage = grayscale2image(detection.sample.rightEye, SIZE);
          // Draw right eye crop next to left eye
          canvasCtx.putImageData(
            rightEyeImage,
            eyeX + 5 + SIZE + 3,
            eyeY
          );
        }
      }

      index++;
    });
  } else {
    // No cameras connected
    canvasCtx.fillStyle = "black";
    canvasCtx.font = "36px Arial";
    canvasCtx.fillText(t('canvas.notConnected'), 10, 50);
    return null;
  }

  // draw example of target using controller
  const targetPos: Position = { x: 0.1 * viewport.width, y: 0.5 * viewport.height };

  // Controller draws goal with its symbols and colors
  controller.drawTarget(canvasCtx, targetPos, 'active');

  // TEXT "This is how target looks like"
  const textColor = controller.getGoalTextColor();
  canvasCtx.fillStyle = textColor;
  canvasCtx.font = "21px Arial";
  canvasCtx.fillText(t('canvas.targetHelp'), targetPos.x - 120, targetPos.y - 70);

  // rectangle around the target
  const activeColor = controller.getGoalColor('active');
  canvasCtx.setLineDash([]);
  canvasCtx.strokeStyle = activeColor;
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeRect(targetPos.x - 50, targetPos.y - 50, 100, 100);
  return null;
}
