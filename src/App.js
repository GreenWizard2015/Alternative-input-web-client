import { FaceMesh } from "@mediapipe/face_mesh";
import React, { useRef, useEffect } from "react";
import * as cameraUtils from "@mediapipe/camera_utils";
import Webcam from "react-webcam";
import { MPParts } from "MP";

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
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
      // draw decoded landmarks, loop through each landmark key
      for (const key in decodedLandmarks) {
        if (decodedLandmarks.hasOwnProperty(key)) {
          const { x, y } = decodedLandmarks[key];
          canvasCtx.beginPath();
          canvasCtx.arc(x, y, 2, 0, 3 * Math.PI);
          canvasCtx.stroke();
          canvasCtx.closePath();
        }
      }
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
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
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
        ></canvas>
      </div>
    </center>
  );
}

export default App;