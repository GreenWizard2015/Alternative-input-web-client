import React, { useCallback, useEffect, useRef } from "react";
import { toggleFullscreen } from "../utils/canvas";
import UI from "./UI";
import { cyrb53 } from "../utils/cyrb53";
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

// DYNAMIC IMPORT of FaceDetector
const FaceDetector = dynamic(() => import('./FaceDetector'), { ssr: false });

function onGameTick({
  canvasCtx, viewport, goal, gameMode
}) {
  gameMode.onOverlay({ viewport, canvasCtx, goal });
  gameMode.onRender({ viewport, canvasCtx, goal });
  return gameMode.accept() ? gameMode.getGoal() : null;
}

function AppComponent(
  { mode, setMode, userId, placeId, activeUploads }: 
  { mode: any, setMode: any, userId: string, placeId: string, activeUploads: number },
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastFrame = useRef<Frame | null>(null);
  const goalPosition = useRef(null);
  const [gameMode, setGameMode] = React.useState<AppMode | null>(null);

  // show confirmation dialog before leaving the page if there are active uploads
  const activeUploadsRef = useRef(activeUploads);
  useEffect(() => {
    activeUploadsRef.current = activeUploads;
  }, [activeUploads]);

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (activeUploadsRef.current > 0) {
        const answer = window.confirm(
          `There are ${activeUploadsRef.current} active uploads. Are you sure you want to leave the page?`,
        );

        if (!answer) {
          event.preventDefault();
          event.returnValue = '';
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
  
  const onFrame = useCallback(
    function (frame: Frame) {
      lastFrame.current = frame;
      if (gameMode == null) return;
      if (gameMode.isPaused()) return;

      if (goalPosition.current != null && canvasRef.current != null && frame.sample != null) {
        const canvasElement = canvasRef.current;
        const canvasRect = canvasElement.getBoundingClientRect(); // could we get more info about the screen?
        const screenId = cyrb53(JSON.stringify(canvasRect));
        const sample: Sample = {
          time: frame.sample.time,
          leftEye: frame.sample.leftEye,
          rightEye: frame.sample.rightEye,
          points: frame.sample.points,
          goal: frame.sample.goal,
          userId: userId,
          placeId: placeId,
          screenId
        };
        if(3000 < gameMode.timeSincePaused()) { // 3 seconds delay before starting to collect samples
          const now = Date.now();
          storeSample(sample, now - 3000);
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
      if (!canvasElement) return; // TODO: Make smth more appropriate
      canvasElement.width = canvasElement.clientWidth;
      canvasElement.height = canvasElement.clientHeight;
      const canvasCtx = canvasElement.getContext("2d"); // move to ref
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

      goalPosition.current = onTick({
        canvas: canvasElement,
        canvasCtx: canvasCtx,
        viewport,
        frame: lastFrame.current,
        goal: goalPosition.current,
        user: userId,
        place: placeId,
        screenId: cyrb53(screenStr),
        gameMode,
      });
      canvasCtx.restore();
      animationFrameId.current = requestAnimationFrame(f);
    };
    animationFrameId.current = requestAnimationFrame(f);

    return () => { cancelAnimationFrame(animationFrameId.current); };
  }, [onTick, gameMode, userId, placeId]);

  function onPause() {
    const now = Date.now();
    sendSamples({limit: now - 3000, clear: true}); // send collected samples before exit
  }

  function startGame(mode: AppMode) {
    setMode("game");
    setGameMode(mode);
    mode.onPause = onPause;
  }

  const [webcamId, setWebcamId] = React.useState(null);
  return (
    <>    
      {('intro' === mode) && (
        <Intro onConfirm={() => setMode('menu')} />
      )}
      {('menu' === mode) && (
        <UI
          onWebcamChange={setWebcamId}
          onStart={startGame}
          goFullscreen={() => toggleFullscreen(
            document.getElementById("root") ?? document.body // app root element
          )}
        />
      )}
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
  }),
  { setMode }
)(AppComponent);