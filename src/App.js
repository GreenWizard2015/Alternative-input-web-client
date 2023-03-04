import React, { useRef } from "react";
import { grayscale2image } from "MP";
import FaceDetector from "components/FaceDetector";

function App() {
  const canvasRef = useRef(null);

  function onFrame({
    results, sample, image,
    landmarks, decodedLandmarks,
  }) {
    const canvasElement = canvasRef.current;
    // Set canvas width
    canvasElement.width = image.width;
    canvasElement.height = image.height;
    const canvasCtx = canvasElement.getContext("2d");
    canvasCtx.save();
    //canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    canvasCtx.drawImage(
      image,
      0, 0,
      canvasElement.width, canvasElement.height
    );

    if (decodedLandmarks) {
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
      const leftEyeImage = grayscale2image(sample.leftEye, SIZE);
      const rightEyeImage = grayscale2image(sample.rightEye, SIZE);
      canvasCtx.putImageData(leftEyeImage, 0, 0);
      canvasCtx.putImageData(rightEyeImage, leftEyeImage.width, 0);
    }
    canvasCtx.restore();
  }

  return (
    <center>
      <div className="App">
        <FaceDetector onFrame={onFrame} />
        <canvas
          ref={canvasRef}
          className="output_canvas"
          style={{
            position: "absolute",
            marginLeft: "auto",
            marginRight: "auto",
            left: 0,
            right: 0,
            textAlign: "center",
            zindex: 9,
          }}
        />
      </div>
    </center>
  );
}

export default App;