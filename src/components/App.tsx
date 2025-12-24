import React, { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toggleFullscreen } from "../utils/canvas";
import UI from "./UI";
import { onMenuTick } from "../modes/onMenuTick";
import { AppMode } from "../modes/AppMode";
import { DetectionResult } from "./FaceDetector";
import FaceDetector from "./FaceDetector";
import { sampleManager, Sample } from "./Samples";
import { Intro } from "./Intro";
// redux related imports
import { connect } from "react-redux";
import { setMode } from "../store/slices/App";
import { RootState } from "../store";
import UploadsNotification from "./uploadsNotification";
import ErrorNotification from "./errorNotification";
import { hash128Hex } from "../utils";
import GoalsProgress from "./GoalsProgress";
import DataWorker from "./DataWorker";

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
  fps: Record<string, { camera: number; samples: number }>;
  detections: Map<string, DetectionResult>;
  collectedSampleCounts: Record<string, number>;
};

function onGameTick(data: TickData) {
  const { gameMode } = data;
  return gameMode.process(data);
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
      // Store detection result for this camera (including frames with null sample)
      // Null sample indicates face detected but no eyes - treat as eyes not detected
      detectionsByCamera.current.set(frame.cameraId, frame);

      // Update global flag based on whether any camera has eyes detected
      const anyEyesDetected = Array.from(detectionsByCamera.current.values()).some(
        detection => detection.sample != null && (detection.sample.leftEye != null || detection.sample.rightEye != null)
      );
      setEyesVisible(anyEyesDetected);

      // If frame.sample is null, eyes not detected - stop processing this frame
      if (frame.sample == null) return;

      if (gameMode == null || gameMode.isPaused()) return;
      if (goalPosition.current == null) return;

      // Only process sample if eyes are detected (at least one eye)
      if (!(frame.sample.leftEye != null || frame.sample.rightEye != null)) return;

      const { time, leftEye, rightEye, points, goal } = frame.sample;

      const sample = new Sample({
        time, leftEye, rightEye, points, goal,
        userId, placeId, screenId,
        cameraId: hash128Hex(frame.cameraId)
      });
      if(gameMode.accept()) {
        // Store samples in time window: from (paused + 3s) to (now - 3s)
        // This gives 3-second buffers at start and end of game
        const minTime = gameMode.lastPausedTime() + 3000;
        const maxTime = Date.now() - 3000;
        sampleManager.store(sample, { minTime, maxTime });
      }
    }, [gameMode, placeId, screenId, userId]
  );

  // Memoize onWebcamChange callback to prevent infinite loops
  const onWebcamChange = useCallback((ids: string[]) => {
    setWebcamIds(ids);
  }, []);

  // Request camera permissions on app start
  useEffect(() => {
    const requestCameraPermissions = async () => {
      try {
        // Request camera access - this will prompt user for permission
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        // Stop the stream immediately since we just need to request permission
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.error('Failed to request camera permissions:', error);
      }
    };
    requestCameraPermissions();
  }, []);

  // Log camera changes for debugging
  useEffect(() => {
    if (webcamIds.length > 0) {
      console.log('[App] Camera IDs updated:', webcamIds);
    }
  }, [webcamIds]);

  // Clean up detections for disabled cameras
  useEffect(() => {
    // Remove detections from cameras that are no longer selected
    detectionsByCamera.current.forEach((_, cameraId) => {
      if (!webcamIds.includes(cameraId)) {
        detectionsByCamera.current.delete(cameraId);
      }
    });
  }, [webcamIds]);

  function onKeyDown(exit: () => void) {
    return (event: React.KeyboardEvent<HTMLCanvasElement>) => {
      const isExit = event.code === 'Escape';

      if (isExit) {
        if (gameMode) {
          onPause(); // save all samples
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
          return onGameTick(data);
        case "intro":
          return null; // ignore
        default:
          throw new Error("Unknown mode: " + mode);
      }
    },
    [mode]
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
      // Treat null frame as eyes not detected
      let eyesDetected = Array.from(detectionsByCamera.current.values()).some(
        detection => detection.sample != null && (detection.sample.leftEye != null || detection.sample.rightEye != null)
      );

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
        fps,
        detections: detectionsByCamera.current,
        collectedSampleCounts: sampleManager.getPerCameraSampleCounts(),
      });
      animationFrameId.current = requestAnimationFrame(f);
    };
    animationFrameId.current = requestAnimationFrame(f);

    return () => { cancelAnimationFrame(animationFrameId.current); };
  }, [onTick, gameMode, userId, placeId, activeUploads, meanUploadDuration, fps, screenId]);

  const onPause = useCallback(() => {
    const now = Date.now();
    // Flush samples in time window: from 0 to (now - 3s)
    // This matches the store() window for consistency
    const minTime = 0;
    const maxTime = now - 3000;
    sampleManager.flushAndClear({ minTime, maxTime });
  }, []);

  const startGame = useCallback((mode: AppMode) => {
    setMode("game");
    setGameMode(mode);
    mode.onPause = onPause;
  }, [onPause, setMode]);

  let content = null;
  if (mode === 'intro') {
    content = <Intro onConfirm={() => setMode('menu')} />;
  } else if (mode === 'menu') {
    content = (
      <UI
        onWebcamChange={onWebcamChange}
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
      <DataWorker />
      {content}
      <FaceDetector
        cameraIdsStrList={webcamIds.length > 0 ? webcamIds.sort().join(',') : ''}
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