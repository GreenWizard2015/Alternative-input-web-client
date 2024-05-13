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
    
    canvasCtx.putImageData(leftEyeImage, 0, 0);
    canvasCtx.putImageData(rightEyeImage, leftEyeImage.width, 0);

    // // Define the scale factor
    // let scaleFactor = 16;
    // // Create a temporary canvas for the images
    // let tempCanvas = document.createElement('canvas');
    // let tempCtx = tempCanvas.getContext('2d');
    // // Function to draw image data onto the main canvas with scaling
    // const drawScaledImage = function(imageData, x, y) {
    //   tempCanvas.width = imageData.width;
    //   tempCanvas.height = imageData.height;
    //   tempCtx.putImageData(imageData, 0, 0);
    //   canvasCtx.drawImage(
    //     tempCanvas,
    //     0,
    //     0,
    //     tempCanvas.width,
    //     tempCanvas.height,
    //     x,
    //     y,
    //     tempCanvas.width * scaleFactor,
    //     tempCanvas.height * scaleFactor
    //   );
    // }
    // // Draw the left eye image onto the main canvas with scaling
    // drawScaledImage(leftEyeImage, 0, 0);
    // // Draw the right eye image onto the main canvas with scaling
    // drawScaledImage(rightEyeImage, leftEyeImage.width * scaleFactor, 0);

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
