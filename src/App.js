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

      function extract(pts) {
        const SIZE = 32;
        // find min and max x and y
        const minmm = pts.reduce((acc, pt) => {
          return {
            x: Math.min(acc.x, pt.x),
            y: Math.min(acc.y, pt.y),
          };
        }, { x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER });
        const maxmm = pts.reduce((acc, pt) => {
          return {
            x: Math.max(acc.x, pt.x),
            y: Math.max(acc.y, pt.y),
          };
        }, { x: Number.MIN_SAFE_INTEGER, y: Number.MIN_SAFE_INTEGER });
        const width = maxmm.x - minmm.x;
        const height = maxmm.y - minmm.y;

        if ((width < 5) || (height < 5)) {
          // empty image (SIZE x SIZE) black
          return new ImageData(SIZE, SIZE);
        }

        // cut out the part and resize to SIZE x SIZE
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(
          webcamRef.current.video,
          minmm.x, minmm.y, width, height,
          0, 0, SIZE, SIZE
        );

        const rgba = ctx.getImageData(0, 0, SIZE, SIZE).data;
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
        return ctx.getImageData(0, 0, SIZE, SIZE);
      }

      const leftEye = extract(
        MPParts.leftEye.map((idx) => decodedLandmarks[idx])
      );
      const rightEye = extract(
        MPParts.rightEye.map((idx) => decodedLandmarks[idx])
      );

      canvasCtx.putImageData(leftEye, 0, 0);
      canvasCtx.putImageData(rightEye, 32, 0);
      // get the image data as a Uint8ClampedArray of grayscale values
      const data = canvasCtx.getImageData(0, 0, 64, 32).data;
      console.log(data);
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