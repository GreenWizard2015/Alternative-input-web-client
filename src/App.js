import React, { useRef } from "react";
import { grayscale2image } from "MP";
import FaceDetector from "components/FaceDetector";
import "./app.css";

function App() {
  const canvasRef = useRef(null);

  function onFrame({
    results, sample, image,
    landmarks, settings,
  }) {
    const canvasElement = canvasRef.current;
    const canvasCtx = canvasElement.getContext("2d");
    canvasCtx.save();
    // clear canvas by filling it with white color
    canvasCtx.fillStyle = "white";
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);

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
    canvasCtx.restore();
  }

  return (
    <>
      <FaceDetector onFrame={onFrame} />
      <canvas
        ref={canvasRef}
        id="canvas"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          zindex: 9,
        }}
        onClick={(e) => {
          e.preventDefault();
          // toggle fullscreen
          const canvas = canvasRef.current;
          if (canvas.requestFullscreen) {
            canvas.requestFullscreen();
          } else if (canvas.mozRequestFullScreen) { /* Firefox */
            canvas.mozRequestFullScreen();
          } else if (canvas.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
            canvas.webkitRequestFullscreen();
          } else if (canvas.msRequestFullscreen) { /* IE/Edge */
            canvas.msRequestFullscreen();
          }
        }}
      />
    </>
  );
}

export default App;