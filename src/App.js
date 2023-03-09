import React, { useRef } from "react";
import { decodeLandmarks, grayscale2image } from "utils/MP";
import FaceDetector from "components/FaceDetector";
import "./app.css";
import { toggleFullscreen } from "utils/canvas";
import UI from "components/UI";

function onMenuTick() { // move to separate file. "AppModes" folder?
  return ({ canvas, canvasCtx, frame, goal }) => {
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
  };
}

function App() {
  const canvasRef = useRef(null);
  const lastFrame = useRef(null);
  const goalPosition = useRef(null);
  const [mode, setMode] = React.useState("menu"); // replace with enum/constant

  // { results, sample, image, landmarks, settings, }
  function onFrame(frame) {
    lastFrame.current = frame;
    if (goalPosition.current !== null) {
      onTick({
        canvas: canvasRef.current,
        canvasCtx: canvasRef.current.getContext("2d"),
        frame,
        goal: goalPosition.current,
        mode,
      });
    }
  }

  const onTick = useCallback(
    () => {
      // call on mode change? check it
      switch (mode) {
        case "menu":
          return onMenuTick();
        // case "game":
        //   return onGameTick();
        default:
          throw new Error("Unknown mode: " + mode);
      }
    },
    [mode]
  );

  const animationFrameId = useRef(null);
  React.useEffect(() => {
    animationFrameId.current = requestAnimationFrame(
      () => {
        const canvasElement = canvasRef.current;
        canvasElement.width = canvasElement.clientWidth;
        canvasElement.height = canvasElement.clientHeight;
        const canvasCtx = canvasElement.getContext("2d"); // move to ref
        canvasCtx.save();
        // clear canvas by filling it with white color
        canvasCtx.fillStyle = "white";
        canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);

        goalPosition.current = onTick({
          canvas: canvasElement,
          canvasCtx: canvasCtx,
          viewport: {
            // check if it's correct to use offsetLeft/Top
            left: canvasElement.offsetLeft,
            top: canvasElement.offsetTop,
            width: canvasElement.width,
            height: canvasElement.height,
          },
          frame: lastFrame.current,
          goal: goalPosition.current,
        });

        canvasCtx.restore();
      });
    return () => { cancelAnimationFrame(animationFrameId.current); };
  }, [onTick]);

  const [webcamId, setWebcamId] = React.useState(null);
  return (
    <>
      {('menu' === mode) && (
        <UI
          onWebcamChange={setWebcamId}
          onStart={() => setMode("game")}
          goFullscreen={() => toggleFullscreen(
            document.getElementById("root") // app root element
          )}
        />
      )}
      <FaceDetector deviceId={webcamId} onFrame={onFrame} />
      <canvas ref={canvasRef} id="canvas" />
    </>
  );
}

export default App;