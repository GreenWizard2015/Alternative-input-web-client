import React, { useCallback, useRef } from "react";
import { toggleFullscreen } from "../utils/canvas";
import UI from "./UI";
import { onMenuTick } from "../modes/onMenuTick";
import { AppMode } from "../modes/AppMode";
import { Frame } from "./FaceDetector";
import { Sample, storeSample, sendSamples } from "./Samples";
import { Intro } from "./Intro";
// redux related imports
import { connect } from "react-redux";
import { setMode } from "../store/slices/App";
import { RootState } from "../store";
import dynamic from "next/dynamic";
import UploadsNotification from "./uploadsNotification";
import { hash128Hex } from "../Utils";

// DYNAMIC IMPORT of FaceDetector
const FaceDetector = dynamic(() => import('./FaceDetector'), { ssr: false });

function onGameTick(data) {
  const { gameMode } = data;
  gameMode.onOverlay(data);
  gameMode.onRender(data);
  return gameMode.accept() ? gameMode.getGoal() : null;
}

type AppSettings = {
  mode: string,
  setMode: (mode: string) => void,
  userId: string,
  placeId: string,
  activeUploads: number,
  meanUploadDuration: number,
};

function AppComponent(
  { mode, setMode, userId, placeId, activeUploads, meanUploadDuration }: AppSettings
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastFrame = useRef<Frame | null>(null);
  const goalPosition = useRef(null);
  const [gameMode, setGameMode] = React.useState<AppMode | null>(null);
  const [webcamId, setWebcamId] = React.useState<string>("");

  const onFrame = useCallback(
    function (frame: Frame) {
      lastFrame.current = frame;
      if ((gameMode == null) || gameMode.isPaused()) return;

      if (goalPosition.current != null && canvasRef.current != null && frame.sample != null) {
        const canvasElement = canvasRef.current;
        const canvasRect = canvasElement.getBoundingClientRect(); // could we get more info about the screen?
        const screenId = hash128Hex(JSON.stringify(canvasRect));
        // placeId should be a combination of placeId and webcamId
        const newPlaceId = hash128Hex(placeId + webcamId);
        const { time, leftEye, rightEye, points, goal } = frame.sample;
        const sample: Sample = {
          time, leftEye, rightEye, points, goal, // sample data
          userId: userId,
          placeId: newPlaceId,
          screenId
        };
        if(3000 < gameMode.timeSincePaused()) { // 3 seconds delay before starting to collect samples
          const now = Date.now();
          storeSample({ sample: sample, limit: now - 3000, placeId, userId });
        }
      }
    }, [canvasRef, lastFrame, goalPosition, userId, placeId, gameMode]
  );

  function onKeyDown(exit) {
    return (event) => {
      const isExit = event.code === 'Escape';
      if (gameMode) {
        if (isExit) {
          gameMode.onPause();
          exit();
          return;
        }

        gameMode.onKeyDown(event);
      }
      if (isExit) {
        exit();
        return;
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
        case "intro":
          return null; // ignore
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
      if (!canvasElement) return;
      canvasElement.width = canvasElement.clientWidth;
      canvasElement.height = canvasElement.clientHeight;
      const canvasCtx = canvasElement.getContext("2d");
      if (!canvasCtx) return;
      canvasCtx.save();
      // clear canvas by filling it with white color
      canvasCtx.fillStyle = "white";
      canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);

      const viewport = {
        left: canvasElement.offsetLeft,
        top: canvasElement.offsetTop,
        width: canvasElement.width,
        height: canvasElement.height,
      };
      const screenStr = JSON.stringify(viewport);
      // placeId should be a combination of placeId and webcamId
      // cut off the last N characters of the webcamId and append it to the placeId
      const newPlaceId = hash128Hex(placeId + webcamId);

      goalPosition.current = onTick({
        canvas: canvasElement,
        canvasCtx: canvasCtx,
        viewport,
        frame: lastFrame.current,
        goal: goalPosition.current,
        user: userId,
        place: newPlaceId,
        screenId: hash128Hex(screenStr),
        gameMode,
        activeUploads,
        meanUploadDuration
      });
      canvasCtx.restore();
      animationFrameId.current = requestAnimationFrame(f);
    };
    animationFrameId.current = requestAnimationFrame(f);

    return () => { cancelAnimationFrame(animationFrameId.current); };
  }, [onTick, gameMode, userId, placeId]);

  function onPause() {
    const now = Date.now();
    sendSamples({
      limit: now - 3000,
      clear: true,
      placeId: placeId,
      userId: userId
    }); // send collected samples before exit
  }

  function startGame(mode: AppMode) {
    setMode("game");
    setGameMode(mode);
    mode.onPause = onPause;
  }

  let content = null;
  if('intro' === mode) {
    content = <Intro onConfirm={() => setMode('menu')} />;
  }
  if('menu' === mode) {
    content = (
      <UI
        onWebcamChange={setWebcamId}
        onStart={startGame}
        goFullscreen={() => toggleFullscreen(
          document.getElementById("root") ?? document.body // app root element
        )}
      />
    );
  }
  if(content != null) { // wrap content in UI
    content = (
      <div id="UI">
        <div className="UI-wrapper">
          {(0 < activeUploads) ? (
            <div className="w-100 mx-auto text-center" style={{color: 'red'}}>
              Currently there are {activeUploads} active uploads.<br />
              Please wait until they are finished.
            </div>
          ) : null}         
          {content}
        </div>
      </div>
    );
  }

  return (
    <>
      <UploadsNotification />
      {content}
      <FaceDetector deviceId={webcamId} onFrame={onFrame} goal={goalPosition} />
      <canvas tabIndex={0} ref={canvasRef} id="canvas" onKeyDown={onKeyDown(() => {
        setMode('menu');
      })} />
    </>
  );
}

export default connect(
  (state: RootState) => ({
    mode: state.App.mode,
    userId: state.UI.userId,
    placeId: state.UI.placeId,
    activeUploads: state.App.activeUploads,
    meanUploadDuration: state.App.meanUploadDuration,
  }),
  { setMode }
)(AppComponent);