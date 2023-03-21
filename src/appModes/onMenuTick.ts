import { decodeLandmarks, grayscale2image } from "../utils/MP";

// TODO: make it work
export function onMenuTick({ viewport: { width, height }, canvasCtx, frame }) {
  if (frame.landmarks) {
    const { visibilityThreshold, presenceThreshold } = frame.settings;
    const decodedLandmarks = decodeLandmarks(frame.landmarks, {
      height, width,
      visibilityThreshold, presenceThreshold,
    });
    canvasCtx.strokeStyle = "red";
    canvasCtx.lineWidth = 2;
    // draw landmarks points
    for (const { x, y } of decodedLandmarks) {
      canvasCtx.beginPath();
      canvasCtx.arc(x, y, 2, 0, 3 * Math.PI);
      canvasCtx.stroke();
      canvasCtx.closePath();
    }
    const { SIZE } = frame.settings;
    const leftEyeImage = grayscale2image(frame.leftEye, SIZE);
    const rightEyeImage = grayscale2image(frame.rightEye, SIZE);
    canvasCtx.putImageData(leftEyeImage, 0, 0);
    canvasCtx.putImageData(rightEyeImage, leftEyeImage.width, 0);
  }
  return null;
}
