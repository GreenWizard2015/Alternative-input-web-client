import React, { useCallback, useRef } from "react";
import FaceDetector from "components/FaceDetector";
import "./app.css";
import { toggleFullscreen } from "utils/canvas";
import UI from "components/UI";
import { cyrb53 } from "utils/cyrb53";

const MAX_SAMPLES = 100;
let samples = [];

async function storeSample(sample) {
  samples.push(sample)
  if (sample >= MAX_SAMPLES) {
    const oldSamples = samples;
    samples = [];
    // await send to server
  }
}

function onGameTick({
  canvasCtx, viewport, goal, gameMode
}) {
  gameMode.onRender({ viewport, canvasCtx, goal });
  return gameMode.accept() ? gameMode.getGoal() : null;
}

// TODO: move to separate file AND make it work
function onMenuTick({ canvas, canvasCtx, frame, goal }) { // move to separate file. "AppModes" folder?
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

function App() {
  const canvasRef = useRef(null);
  const lastFrame = useRef(null);
  const goalPosition = useRef(null);
  const [mode, setMode] = React.useState("menu"); // replace with enum/constant
  const [gameMode, setGameMode] = React.useState(null);
  const userRef = useRef(null);
  const placeIdRef = useRef(null);

  function setUserRef(user) {
    userRef.current = user;
  }

  function setPlaceIdRef(placeId) {
    placeIdRef.current = placeId
  }

  const onFrame = useCallback(
    function (frame) {
      lastFrame.current = frame;
      if (goalPosition.current !== null) {
        const canvasElement = canvasRef.current;
        const canvasRect = canvasElement.getBoundingClientRect(); // could we get more info about the screen?
        const screenId = cyrb53(JSON.stringify(canvasRect));
        const sample = {
          time: frame.time,
          leftEye: frame.leftEye,
          rightEye: frame.rightEye,
          points: frame.points,
          goal: goalPosition.current,
          userId: userRef.current,
          placeId: placeIdRef.current,
          screenId
        };
        storeSample(sample);
      }
    }, [canvasRef, lastFrame, goalPosition, userRef, placeIdRef]
  );

  function onKeyDown(exit) {
    return (event) => {
      if (event.code === 'Escape') {
        exit();
        return;
      }
      if (gameMode) {
        gameMode.onKeyDown(event);
      }
    }
  }

  const onTick = useCallback(
    (data) => {
      // call on mode change? check it
      switch (mode) {
        case "menu":
          return onMenuTick(data);
        case "game":
          return onGameTick(data);
        default:
          throw new Error("Unknown mode: " + mode);
      }
    },
    [mode]
  );

  const animationFrameId = useRef(null);
  React.useEffect(() => {
    const f = () => {
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
        gameMode,
      });
      canvasCtx.restore();
      animationFrameId.current = requestAnimationFrame(f);
    };
    animationFrameId.current = requestAnimationFrame(f);

    return () => { cancelAnimationFrame(animationFrameId.current); };
  }, [onTick, gameMode]);

  function startGame(mode) {
    setMode("game");
    setGameMode(mode);
  }

  const [webcamId, setWebcamId] = React.useState(null);
  return (
    <>
      {('menu' === mode) && (
        <UI
          onWebcamChange={setWebcamId}
          onStart={startGame}
          goFullscreen={() => toggleFullscreen(
            document.getElementById("root") // app root element
          )}

          userId={userRef} onUserChange={setUserRef}
          placeId={placeIdRef} onPlaceChange={setPlaceIdRef}
        />
      )}
      <FaceDetector deviceId={webcamId} onFrame={onFrame} />
      <canvas tabIndex={0} ref={canvasRef} id="canvas" onKeyDown={onKeyDown(() => setMode('menu'))} />
    </>
  );
}

export default App;