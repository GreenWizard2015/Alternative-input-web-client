import { FaceMesh } from "@mediapipe/face_mesh";
import React, { useRef, useEffect } from "react";
import * as cameraUtils from "@mediapipe/camera_utils";
import Webcam from "react-webcam";
import { decodeLandmarks, MPParts } from "MP";

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
    // canvasCtx.drawImage(
    //   results.image,
    //   0, 0,
    //   canvasElement.width, canvasElement.height
    // );
    if (results.multiFaceLandmarks && (0 < results.multiFaceLandmarks.length)) {
      const landmarks = results.multiFaceLandmarks[0];
      const decodedLandmarks = decodeLandmarks(landmarks, {
        height: videoHeight, width: videoWidth,
      }); // { idx: { x, y}}
      // canvasCtx.strokeStyle = "red";
      // canvasCtx.lineWidth = 2;
      // // draw landmarks points
      // for (const key in decodedLandmarks) {
      //   if (decodedLandmarks.hasOwnProperty(key)) {
      //     const element = decodedLandmarks[key];
      //     const { x, y } = element;
      //     canvasCtx.beginPath();
      //     canvasCtx.arc(x, y, 2, 0, 3 * Math.PI);
      //     canvasCtx.stroke();
      //     canvasCtx.closePath();
      //   }
      // }

      function extract(pts) {
        const SIZE = 32;
        // find min and max x and y
        const minmm = pts.reduce((acc, pt) => {
          return {
            x: Math.min(acc.x, pt.x),
            y: Math.min(acc.y, pt.y),
          };
        }, { x: videoWidth, y: videoHeight });
        const maxmm = pts.reduce((acc, pt) => {
          return {
            x: Math.max(acc.x, pt.x),
            y: Math.max(acc.y, pt.y),
          };
        }, { x: 0, y: 0 });
        const width = maxmm.x - minmm.x;
        const height = maxmm.y - minmm.y;

        if ((width < 5) || (height < 5)) {
          // empty image (SIZE x SIZE) black
          return new ImageData(SIZE, SIZE);
        }

        // cut out the part and resize to SIZE x SIZE
        const rgba = results.image
          .getContext("2d")
          .getImageData(minmm.x, minmm.y, width, height,)
          .data;

        const gray = new Uint8ClampedArray(SIZE * SIZE * 4);
        for (let i = 0; i < SIZE * SIZE; i += 4) {
          const r = rgba[i];
          const g = rgba[i + 1];
          const b = rgba[i + 2];
          const grayValue = Math.floor(0.2989 * r + 0.5870 * g + 0.1140 * b);
          gray[i] = grayValue;
          gray[i + 1] = grayValue;
          gray[i + 2] = grayValue;
          gray[i + 3] = 255;
        }
        return new ImageData(gray, SIZE, SIZE);
      }

      const leftEye = extract(
        MPParts.leftEye.map((idx) => decodedLandmarks[idx])
      );
      const rightEye = extract(
        MPParts.rightEye.map((idx) => decodedLandmarks[idx])
      );

      canvasCtx.putImageData(leftEye, 0, 0);
      canvasCtx.putImageData(rightEye, 32, 0);
      // // get the image data as a Uint8ClampedArray of grayscale values
      const data = canvasCtx.getImageData(0, 0, 64, 32).data;
      // draw text
      canvasCtx.fillStyle = "red";
      canvasCtx.font = "20px Arial";
      canvasCtx.fillText(data.length + " bytes.", 10, 50);
      // console.log(data);
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