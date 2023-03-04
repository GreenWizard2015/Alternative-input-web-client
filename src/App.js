import { FaceMesh } from "@mediapipe/face_mesh";
import React, { useRef, useEffect } from "react";
import * as cameraUtils from "@mediapipe/camera_utils";
import Webcam from "react-webcam";
import { decodeLandmarks, grayscale2image, MPParts, rectFromPoints, results2sample } from "MP";

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const intermediateCanvasRef = useRef(null);
  var camera = null;

  function onResults(results) {
    const { videoWidth, videoHeight } = webcamRef.current.video;

    // Set canvas width
    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;

    const canvasElement = canvasRef.current;
    const canvasCtx = canvasElement.getContext("2d");
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(
      results.image,
      0, 0,
      canvasElement.width, canvasElement.height
    );
    if (results.multiFaceLandmarks && (0 < results.multiFaceLandmarks.length)) {
      const landmarks = results.multiFaceLandmarks[0];
      const decodedLandmarks = decodeLandmarks(landmarks, {
        height: videoHeight, width: videoWidth,
      }); // { idx: { x, y}}
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

      const sample = results2sample(results, intermediateCanvasRef.current, {
        padding: 5,
        visibilityThreshold: 0.5,
        presenceThreshold: 0.5,
        SIZE: 32,
      });
      const leftEyeImage = grayscale2image(sample.leftEye, 32);
      const rightEyeImage = grayscale2image(sample.rightEye, 32);
      canvasCtx.putImageData(leftEyeImage, 0, 0);
      canvasCtx.putImageData(rightEyeImage, leftEyeImage.width, 0);
    }
    canvasCtx.restore();
  }

  useEffect(() => {
    const faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      },
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      minDetectionConfidence: 0.2,
      minTrackingConfidence: 0.2,
    });

    faceMesh.onResults(onResults);

    if (
      typeof webcamRef.current !== "undefined" &&
      webcamRef.current !== null
    ) {
      camera = new cameraUtils.Camera(
        webcamRef.current.video,
        {
          onFrame: async () => {
            await faceMesh.send({ image: webcamRef.current.video });
          },
        });
      camera.start();
    }
  }, []);

  return (
    <center>
      <div className="App">
        <Webcam ref={webcamRef} style={{ display: "none" }} />
        <canvas ref={intermediateCanvasRef} style={{ display: "none" }} />
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