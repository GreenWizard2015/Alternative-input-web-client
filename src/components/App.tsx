import React, { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toggleFullscreen } from "../utils/canvas";
import UI from "./UI";
import { onMenuTick } from "../modes/onMenuTick";
import { AppMode } from "../modes/AppMode";
import { DetectionResult } from "./FaceDetector";
import { sampleManager, Sample } from "./Samples";
import { Intro } from "./Intro";
// redux related imports
import { connect } from "react-redux";
import { setMode } from "../store/slices/App";
import { RootState } from "../store";
import dynamic from "next/dynamic";
import UploadsNotification from "./uploadsNotification";
import ErrorNotification from "./errorNotification";
import { hash128Hex } from "../utils";
import GoalsProgress from "./GoalsProgress";

// Utility function to check if eyes are detected in a sample
function areEyesDetected(sample: any): boolean {
  if (!sample) return false;
  const { leftEye, rightEye } = sample;
  return (leftEye != null) || (rightEye != null);
}

// DYNAMIC IMPORT of FaceDetector
const FaceDetector = dynamic(() => import('./FaceDetector'), { ssr: false });

type TickData = {
  canvas: HTMLCanvasElement;
  canvasCtx: CanvasRenderingContext2D;
  viewport: { left: number; top: number; width: number; height: number };
  goal: any;
  user: string;
  place: string;
  screenId: string;
  gameMode: AppMode;
  activeUploads: number;
  meanUploadDuration: number;
  eyesDetected: boolean;
  eyesByCamera: Map<string, boolean>;
  fps: Record<string, { camera: number; samples: number }>;
  detections: Map<string, DetectionResult>;
};

function onGameTick(data: TickData) {
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
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionsByCamera = useRef<Map<string, DetectionResult>>(new Map());
  const eyesByCamera = useRef<Map<string, boolean>>(new Map()); // Per-camera eye detection
  const goalPosition = useRef(null);
  const prevViewportRef = useRef<{ width: number; height: number; left: number; top: number } | null>(null);
  const [gameMode, setGameMode] = React.useState<AppMode | null>(null);
  const [webcamIds, setWebcamIds] = React.useState<string[]>([]);
  // flag to indicate if eyes are detected at least once
  const [eyesVisible, setEyesVisible] = React.useState<boolean>(false);
  const [score, setScore] = React.useState<number|null>(null);
  const [fps, setFps] = React.useState<Record<string, { camera: number, samples: number }>>({});

  const [screenId, setScreenId] = React.useState<string>("");

  const onDetect = useCallback(
    function (frame: DetectionResult) {
      if (!frame) return;

      // Store detection result for this camera
      detectionsByCamera.current.set(frame.cameraId, frame);

      // Track per-camera eye detection
      if (frame.sample != null) {
        const eyesDetected = areEyesDetected(frame.sample);
        eyesByCamera.current.set(frame.cameraId, eyesDetected);

        // Update global flag if any camera has eyes detected at least once
        setEyesVisible(eyesVisible || eyesDetected);
      }
    }, [eyesVisible]
  );

  // Process samples from all cameras in game mode
  const processCameraSamples = useCallback(() => {
    if (gameMode == null || gameMode.isPaused()) return;
    if (goalPosition.current == null) return;

    detectionsByCamera.current.forEach((frame, cameraId) => {
      if (!frame.sample) return;

      if (!areEyesDetected(frame.sample)) return;

      const { time, leftEye, rightEye, points, goal } = frame.sample;

      const sample = new Sample({
        time, leftEye, rightEye, points, goal,
        userId, placeId, screenId,
        cameraId: hash128Hex(cameraId)
      });
      if(gameMode.accept()) {
        // Store samples in time window: from (paused + 3s) to (now - 3s)
        // This gives 3-second buffers at start and end of game
        const minTime = gameMode.lastPausedTime() + 3000;
        const maxTime = Date.now() - 3000;
        sampleManager.store(sample, { minTime, maxTime });
      }
    });
    detectionsByCamera.current.clear();
  }, [gameMode, userId, placeId, screenId]);

  function onKeyDown(exit: () => void) {
    return (event: React.KeyboardEvent<HTMLCanvasElement>) => {
      const isExit = event.code === 'Escape';

      if (isExit) {
        if (gameMode) {
          setScore(gameMode.getScore());
          gameMode.onPause();
        }
        exit();
        return;
      }

      if (gameMode) {
        gameMode.onKeyDown(event as any);
      }
    }
  }

  const onTick = useCallback(
    (data: any) => {
      // call on mode change? check it
      switch (mode) {
        case "menu":
          return onMenuTick(data);
        case "game":
          canvasRef.current.focus();
          processCameraSamples();
          return onGameTick(data);
        case "intro":
          return null; // ignore
        default:
          throw new Error("Unknown mode: " + mode);
      }
    },
    [mode, processCameraSamples, onMenuTick, onGameTick]
  );

  // Separate effect for viewport tracking and screen ID generation
  React.useEffect(() => {
    const trackViewport = () => {
      const canvasElement = canvasRef.current;
      if (!canvasElement) return;

      const viewport = {
        left: canvasElement.offsetLeft,
        top: canvasElement.offsetTop,
        width: canvasElement.width,
        height: canvasElement.height,
      };

      // Only hash if viewport dimensions changed (avoid unnecessary hashing every frame)
      const viewportChanged = !prevViewportRef.current ||
        prevViewportRef.current.width !== viewport.width ||
        prevViewportRef.current.height !== viewport.height ||
        prevViewportRef.current.left !== viewport.left ||
        prevViewportRef.current.top !== viewport.top;

      if (viewportChanged) {
        prevViewportRef.current = viewport;
        const newScreenId = hash128Hex(JSON.stringify(viewport));
        setScreenId(newScreenId);
      }
    };

    // Track viewport changes
    trackViewport();
    window.addEventListener('resize', trackViewport);
    return () => window.removeEventListener('resize', trackViewport);
  }, []);

  const animationFrameId = useRef<number>(0);
  React.useEffect(() => {
    const f = () => {
      const canvasElement = canvasRef.current;
      if (!canvasElement) return;
      // Only resize if dimensions actually changed
      if (canvasElement.width !== canvasElement.clientWidth ||
          canvasElement.height !== canvasElement.clientHeight) {
        canvasElement.width = canvasElement.clientWidth;
        canvasElement.height = canvasElement.clientHeight;
      }
      const canvasCtx = canvasElement.getContext("2d");
      if (!canvasCtx) return;
      // Use clearRect for faster clearing
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

      const viewport = {
        left: canvasElement.offsetLeft,
        top: canvasElement.offsetTop,
        width: canvasElement.width,
        height: canvasElement.height,
      };

      // Eyes detected: check if any camera currently has eyes visible
      // Strategy: if ANY camera has eyes, game proceeds (for multi-camera robustness)
      let eyesDetected = Array.from(eyesByCamera.current.values()).some(hasEyes => hasEyes);

      goalPosition.current = onTick({
        canvas: canvasElement,
        canvasCtx: canvasCtx,
        viewport,
        goal: goalPosition.current,
        user: userId,
        place: placeId,
        screenId,
        gameMode,
        activeUploads,
        meanUploadDuration,
        eyesDetected,
        eyesByCamera: eyesByCamera.current,
        fps,
        detections: detectionsByCamera.current,
      });
      animationFrameId.current = requestAnimationFrame(f);
    };
    animationFrameId.current = requestAnimationFrame(f);

    return () => { cancelAnimationFrame(animationFrameId.current); };
  }, [onTick, gameMode, userId, placeId, activeUploads, meanUploadDuration, fps, screenId]);

  function onPause() {
    const now = Date.now();
    // Flush samples in time window: from (paused + 3s) to (now - 3s)
    // This matches the store() window for consistency
    const minTime = gameMode ? gameMode.lastPausedTime() + 3000 : now - 3000;
    const maxTime = now - 3000;
    sampleManager.flushAndClear({ minTime, maxTime });
  }

  function startGame(mode: AppMode) {
    setMode("game");
    setGameMode(mode);
    mode.onPause = onPause;
  }

  let content = null;
  if (mode === 'intro') {
    content = <Intro onConfirm={() => setMode('menu')} />;
  } else if (mode === 'menu') {
    content = (
      <UI
        onWebcamChange={setWebcamIds}
        onStart={startGame}
        canStart={eyesVisible}
        fps={fps}
        cameraIds={webcamIds}
        goFullscreen={() => toggleFullscreen(
          document.getElementById("root") ?? document.body // app root element
        )}
      />
    );
  }

  // Wrap content in UI container with notifications
  if (content != null) {
    content = (
      <div id="UI">
        <div className="UI-wrapper">
          {(0 < activeUploads) ? (
            <div className="w-100 mx-auto text-center" style={{color: 'red'}}>
              {t('notifications.activeUploads', { count: activeUploads })}<br />
              {t('notifications.waitUploads')}
            </div>
          ) : null}
          {eyesVisible ? null : (
            <div className="w-100 mx-auto text-center" style={{color: 'red'}}>
              {t('notifications.webcamProblem')}<br />
              {t('notifications.eyesNotDetected')}
            </div>
          )}
          {score != null ? (
            <div className="w-100 mx-auto text-center">
              {t('notifications.lastScore', { score: score.toFixed(2) })}
            </div>
          ) : null}
          <GoalsProgress />
          {content}
        </div>
      </div>
    );
  }

  return (
    <>
      <UploadsNotification />
      <ErrorNotification />
      {content}
      <FaceDetector
        cameraIdsStrList={webcamIds.sort().join(',')}
        onDetect={onDetect}
        goal={goalPosition}
        onFPS={setFps}
      />
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