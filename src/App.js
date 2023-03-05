import React, { useRef } from "react";
import { decodeLandmarks, grayscale2image } from "utils/MP";
import FaceDetector from "components/FaceDetector";
import "./app.css";
import { toggleFullscreen } from "utils/canvas";
import WebcamSelector from "components/WebcamSelector";

function App() {
  const canvasRef = useRef(null);

  function onFrame({
    results, sample, image,
    landmarks, settings,
  }) {
    const canvasElement = canvasRef.current;
    canvasElement.width = canvasElement.clientWidth;
    canvasElement.height = canvasElement.clientHeight;
    const canvasCtx = canvasElement.getContext("2d");
    canvasCtx.save();
    // clear canvas by filling it with white color
    canvasCtx.fillStyle = "white";
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);

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
    canvasCtx.restore();
  }

  const [webcamId, setWebcamId] = React.useState(null);

  return (
    <>
      <div id="UI">
        <div className="UI-wrapper">
          <WebcamSelector onWebcamChange={(deviceId) => setWebcamId(deviceId)} />
        </div>
      </div>
      <FaceDetector deviceId={webcamId} onFrame={onFrame} />
      <canvas
        ref={canvasRef}
        id="canvas"
        onClick={(e) => {
          e.preventDefault();
          toggleFullscreen(canvasRef.current);
        }}
      />
    </>
  );
}

export default App;