import { decodeLandmarks, grayscale2image } from "../utils/MP";

export function onMenuTick({ 
  viewport, canvasCtx, frame, user, place, screen, screenId
}) {
  if(frame == null) {
    // Cam not working probably
    return null;
  }
  if (frame.landmarks) {
    const { visibilityThreshold, presenceThreshold } = frame.settings;
    const decodedLandmarks = decodeLandmarks(frame.landmarks, {
      width: viewport.width, height: viewport.height,
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
    const leftEyeImage = grayscale2image(frame.sample.leftEye, SIZE);
    const rightEyeImage = grayscale2image(frame.sample.rightEye, SIZE);
// Define the scale factor
let scaleFactor = 2;

// Create a temporary canvas for the left eye image
let leftCanvas = document.createElement('canvas');
leftCanvas.width = leftEyeImage.width;
leftCanvas.height = leftEyeImage.height;
let leftCtx = leftCanvas.getContext('2d');
leftCtx.putImageData(leftEyeImage, 0, 0);

// Draw the left eye image onto the main canvas with scaling
canvasCtx.drawImage(leftCanvas, 0, 0, leftEyeImage.width * scaleFactor, leftEyeImage.height * scaleFactor);

// Create a temporary canvas for the right eye image
let rightCanvas = document.createElement('canvas');
rightCanvas.width = rightEyeImage.width;
rightCanvas.height = rightEyeImage.height;
let rightCtx = rightCanvas.getContext('2d');
rightCtx.putImageData(rightEyeImage, 0, 0);

// Draw the right eye image onto the main canvas with scaling
canvasCtx.drawImage(rightCanvas, leftEyeImage.width * scaleFactor, 0, rightEyeImage.width * scaleFactor, rightEyeImage.height * scaleFactor);


    // print other info
    canvasCtx.fillStyle = "black";
    canvasCtx.font = "16px Arial";
    const texts = [
      `User: ${user}`,
      `Place: ${place}`,
      `ScreenId: ${screenId}`,
      `Screen: ${JSON.stringify(viewport)}`,
    ];
    if (viewport.left === 0 && viewport.top === 0) {
      texts.push("");
      texts.push("Can't get absolute screen position");
      texts.push("Consider creating a new \"place\" per each window position");
      texts.push("or use only maximized windows and fullscreen mode");
    }

    const startY = 60;
    for (let i = 0; i < texts.length; i++) {
      canvasCtx.fillText(texts[i], 10, startY + i * 20);
    }
  }
  return null;
}
