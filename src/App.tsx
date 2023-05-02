import React, { useCallback, useRef } from "react";
import FaceDetector from "./components/FaceDetector";
import "./app.css";
import { toggleFullscreen } from "./utils/canvas";
import UI from "./components/UI";
import { cyrb53 } from "./utils/cyrb53";
import { onMenuTick } from "./modes/onMenuTick";
import { AppMode } from "modes/AppMode";
import { Frame } from "components/FaceDetector";

type UUIDed = {
  name: string,
  uuid: string
}

type Position = {
  x: number,
  y: number
}

type Sample = {
  time: number,
  leftEye: Uint8ClampedArray,
  rightEye: Uint8ClampedArray,
  points: Float32Array,
  goal: Position,
  userId: string,
  placeId: string,
  screenId: number
}

const MAX_SAMPLES = 100;
let samples: Sample[] = [];

function storeSample(sample: Sample) {
  samples.push(sample)
  if (samples.length >= MAX_SAMPLES) {
    const oldSamples = samples;
    samples = [];
    // Async request
    fetch('http://host1768516.hostland.pro/AI/upload.php', {
      body: new URLSearchParams([
        ['chunk', JSON.stringify(oldSamples, function (key, value: unknown) {
          if (value instanceof Uint8ClampedArray || value instanceof Float32Array) {
            return Array.from(value)
          }
          return value
        })]
      ]),
      method: 'POST'
    })
  }
}

function onGameTick({
  canvasCtx, viewport, goal, gameMode
}) {
  gameMode.onRender({ viewport, canvasCtx, goal });
  gameMode.onOverlay({ viewport, canvasCtx, goal });
  return gameMode.accept() ? gameMode.getGoal() : null;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastFrame = useRef<Frame | null>(null);
  const goalPosition = useRef(null);
  const [mode, setMode] = React.useState("menu"); // replace with enum/constant
  const [gameMode, setGameMode] = React.useState<AppMode | null>(null);
  const userRef = useRef<UUIDed | null>(null);
  const placeIdRef = useRef<UUIDed | null>(null);

  function setUserRef(user: UUIDed) {
    userRef.current = user;
  }

  function setPlaceIdRef(placeId: UUIDed) {
    placeIdRef.current = placeId
  }

  const onFrame = useCallback(
    function (frame: Frame) {
      lastFrame.current = frame;
      if (goalPosition.current != null && canvasRef.current != null && frame.sample != null) {
        const canvasElement = canvasRef.current;
        const canvasRect = canvasElement.getBoundingClientRect(); // could we get more info about the screen?
        const screenId = cyrb53(JSON.stringify(canvasRect));
        const sample: Sample = {
          time: frame.sample.time,
          leftEye: frame.sample.leftEye,
          rightEye: frame.sample.rightEye,
          points: frame.sample.points,
          goal: goalPosition.current,
          userId: userRef.current?.uuid ?? '',
          placeId: placeIdRef.current?.uuid ?? '',
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

  const animationFrameId = useRef<number>(0);
  React.useEffect(() => {
    const f = () => {
      const canvasElement = canvasRef.current;
      if (!canvasElement) return; // TODO: Make smth more appropriate
      canvasElement.width = canvasElement.clientWidth;
      canvasElement.height = canvasElement.clientHeight;
      const canvasCtx = canvasElement.getContext("2d"); // move to ref
      if (!canvasCtx) return;
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

  function startGame(mode: AppMode) {
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
            document.getElementById("root") ?? document.body // app root element
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