// TODO: move to separate file AND make it work
export function onMenuTick({ canvas, canvasCtx, frame, goal }) {
  /*
  fix old code
  // draw image from video stream
  // canvasCtx.drawImage(
  //   image,
  //   0, 0,
  //   canvasElement.width, canvasElement.height
  // );
 
  if (landmarks) {
    const { visibilityThreshold, presenceThreshold } = settings;
    const decodedLandmarks = decodeLandmarks(landmarks, {
      height: canvasElement.height, width: canvasElement.width,
      visibilityThreshold, presenceThreshold,
    });
    canvasCtx.strokeStyle = "red";
    canvasCtx.lineWidth = 2;
    // draw landmarks points
    for (const key in decodedLandmarks) {
      if (decodedLandmarks.hasOwnProperty(key)) {
        const element = decodedLandmarks[key];
        const { x, y } = element;
        canvasCtx.beginPath();
        canvasCtx.arc(x, y, 2, 0, 3 * Math.PI);
        canvasCtx.stroke();
        canvasCtx.closePath();
      }
    }
    const { SIZE } = settings;
    const leftEyeImage = grayscale2image(sample.leftEye, SIZE);
    const rightEyeImage = grayscale2image(sample.rightEye, SIZE);
    canvasCtx.putImageData(leftEyeImage, 0, 0);
    canvasCtx.putImageData(rightEyeImage, leftEyeImage.width, 0);
  }
   */
  return null;
}
