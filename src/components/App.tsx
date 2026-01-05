import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { connect } from "react-redux";
import { toggleFullscreen } from "../utils/canvas";
import { hash128Hex } from "../utils";
import UI from "./UI";
import { onMenuTick } from "../modes/onMenuTick";
import { AppMode } from "../modes/AppMode";
import FaceDetector, { DetectionResult } from "./FaceDetector";
import { Intro } from "./Intro";
import { AggregatedStats } from "./FaceDetectorWorkerManager";
import UploadsNotification from "./uploadsNotification";
import ErrorNotification from "./errorNotification";
import GoalsProgress from "./GoalsProgress";
import FPSDisplay from "./FPSDisplay";
import { setMode } from "../store/slices/App";
import { selectAppProps, selectSortedDeviceIds } from "../store/selectors";
import type { RootState } from "../store";
import type { Position } from "../shared/Sample";
import type { CameraEntity } from "../types/camera";

type TickData = {
  canvas: HTMLCanvasElement;
  canvasCtx: CanvasRenderingContext2D;
  viewport: { left: number; top: number; width: number; height: number };
  goal: Position | null;
  user: string;
  screenId: string;
  gameMode: AppMode | null;
  activeUploads: number;
  meanUploadDuration: number;
  eyesDetected: boolean;
  detections: Map<string, DetectionResult>;
  collectedSampleCounts: Record<string, number>;
};

function onGameTick(data: TickData) {
  return data.gameMode!.process(data);
}

type AppSettings = {
  mode: string,
  setMode: (mode: string) => void,
  userId: string,
  monitorId: string,
  activeUploads: number,
  meanUploadDuration: number,
  selectedCameras: CameraEntity[], // Memoized selected cameras from Redux
  sortedDeviceIds: string[], // Sorted device IDs of selected cameras
  currentUser?: any, // Current user object
  users?: any[], // Users array
};

function AppComponent(
  { mode, setMode, userId, monitorId, activeUploads, meanUploadDuration, selectedCameras, sortedDeviceIds }: AppSettings
) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionsByCamera = useRef<Map<string, DetectionResult>>(new Map());
  const goalPosition = useRef<Position | null>(null);
  const prevViewportRef = useRef<{ width: number; height: number; left: number; top: number } | null>(null);
  const collectedSampleCountsRef = useRef<Record<string, number>>({});
  const tickStateRef = useRef({ userId, activeUploads, meanUploadDuration, screenId: '' });
  const [gameMode, setGameMode] = React.useState<AppMode | null>(null);
  // flag to indicate if eyes are detected at least once
  const [eyesVisible, setEyesVisible] = React.useState<boolean>(false);
  const [score, setScore] = React.useState<number | null>(null);
  const [workerStats, setWorkerStats] = React.useState<AggregatedStats | null>(null);

  const [screenId, setScreenId] = React.useState<string>("");

  const onDetect = useCallback(
    function (frame: DetectionResult) {
      // Store detection result for this camera (including frames with null sample)
      // Null sample indicates face detected but no eyes - treat as eyes not detected
      detectionsByCamera.current.set(frame.cameraId, frame);
    }, []
  );

  // Update tick state ref when any tick-related prop changes
  useEffect(() => {
    tickStateRef.current = { userId, activeUploads, meanUploadDuration, screenId };
  }, [userId, activeUploads, meanUploadDuration, screenId]);

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
    const selectedCameraIds = selectedCameras.map(c => c.deviceId);
    console.log('[App] Camera list effect ran - selectedCameraIds:', selectedCameraIds);
    if (selectedCameraIds.length > 0) {
      console.log('[App] Selected cameras updated:', selectedCameraIds);
    }
  }, [selectedCameras]);

  // Clean up detections for disabled cameras
  useEffect(() => {
    console.log('[App] Camera cleanup effect ran - removing detections for:', sortedDeviceIds);
    // Remove detections from cameras that are no longer selected
    detectionsByCamera.current.forEach((_, cameraId) => {
      if (!sortedDeviceIds.includes(cameraId)) {
        console.log('[App] Removing detection for disabled camera:', cameraId);
        detectionsByCamera.current.delete(cameraId);
      }
    });
  }, [sortedDeviceIds]);

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
    (data: TickData): Position | null => {
      switch (mode) {
        case "menu":
          return onMenuTick(data);
        case "game":
          canvasRef.current?.focus();
          return onGameTick(data);
        case "intro":
          return null;
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
      const eyesDetected = Array.from(detectionsByCamera.current.values()).some(
        detection => detection.sample != null && (detection.sample.leftEye != null || detection.sample.rightEye != null)
      );

      goalPosition.current = onTick({
        canvas: canvasElement,
        canvasCtx: canvasCtx,
        viewport,
        gameMode,
        eyesDetected,
        goal: goalPosition.current,
        user: tickStateRef.current.userId,
        screenId: tickStateRef.current.screenId,
        activeUploads: tickStateRef.current.activeUploads,
        meanUploadDuration: tickStateRef.current.meanUploadDuration,
        detections: detectionsByCamera.current,
        collectedSampleCounts: collectedSampleCountsRef.current,
      });
      animationFrameId.current = requestAnimationFrame(f);
    };
    animationFrameId.current = requestAnimationFrame(f);

    return () => { cancelAnimationFrame(animationFrameId.current); };
  }, [onTick, gameMode]);

  // Track eye detection from detection results
  useEffect(() => {
    // Check if any detection has eyes visible
    const anyEyesDetected = Array.from(detectionsByCamera.current.values()).some(
      detection => detection.sample != null && (detection.sample.leftEye != null || detection.sample.rightEye != null)
    );
    setEyesVisible(anyEyesDetected);
  }, [workerStats, onDetect]);

  // Update collected sample counts from worker stats
  useEffect(() => {
    collectedSampleCountsRef.current = {};
    if (workerStats && workerStats.size > 0) {
      for (const [cameraId, stats] of workerStats.entries()) {
        collectedSampleCountsRef.current[cameraId] = stats.samplesTotal;
      }
    }
  }, [workerStats]);

  const startGame = useCallback((mode: AppMode) => {
    setMode("game");
    setGameMode(mode);
  }, [setMode]);

  // Start button enabled: eyes detected, user selected, monitor selected, and all cameras have places
  const canStart = useMemo(() => {
    const hasUser = userId.length > 0;
    const hasMonitor = monitorId.length > 0;
    const hasCameras = selectedCameras.length > 0;
    const allCamerasReady = selectedCameras.every(cam => cam.placeId && cam.placeId.length > 0);
    return eyesVisible && hasUser && hasMonitor && hasCameras && allCamerasReady;
  }, [eyesVisible, userId, monitorId, selectedCameras]);

  let content = null;
  if (mode === 'intro') {
    content = (
      <div id="UI">
        <div className="UI-wrapper">
          <Intro onConfirm={() => setMode('menu')} />
        </div>
      </div>
    );
  } else if (mode === 'menu') {
    content = (
      <div id="UI">
        <div className="UI-wrapper">
          {(0 < activeUploads) ? (
            <div className="w-100 mx-auto text-center error-message-red">
              {t('notifications.activeUploads', { count: activeUploads })}<br />
              {t('notifications.waitUploads')}
            </div>
          ) : null}
          {eyesVisible ? null : (
            <div className="w-100 mx-auto text-center error-message-red">
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
          <UI
            onStart={startGame}
            canStart={canStart}
            goFullscreen={() => toggleFullscreen(
              document.getElementById("root") ?? document.body // app root element
            )}
            screenId={screenId}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <UploadsNotification />
      <ErrorNotification />
      {content}
      <FPSDisplay fps={workerStats} />
      <FaceDetector
        goal={goalPosition}
        screenId={screenId}
        onDetect={onDetect}
        onStatsUpdate={setWorkerStats}
        isPaused={gameMode?.isPaused() ?? true}
        accept={gameMode?.accept() ?? false}
        sendingFPS={mode === 'game' ? 5 : -1}
      />
      <canvas tabIndex={0} ref={canvasRef} id="canvas" onKeyDown={onKeyDown(() => {
        setMode('menu');
      })} />
    </>
  );
}

export default connect(
  (state: RootState) => ({
    ...selectAppProps(state),
    sortedDeviceIds: selectSortedDeviceIds(state),
  }),
  { setMode }
)(AppComponent);