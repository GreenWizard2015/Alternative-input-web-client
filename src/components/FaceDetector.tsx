import { useCallback, useEffect, useRef } from 'react';
import { connect } from 'react-redux';
import { DEFAULT_SETTINGS } from '../utils/MP';
import { Sample, type Position } from "../shared/Sample";
import FaceDetectorWorkerManager, { ManagerConfig } from './FaceDetectorWorkerManager';
import { hash128Hex } from '../utils';
import DataWorker from './DataWorker';
import { selectUserId, selectMonitorId, selectSelectedCameras, selectSortedDeviceIds } from '../store/selectors';
import type { CameraEntity } from '../types/camera';
import {
  initializeStreams,
  useFpsTracking,
  createCameraFrameCapture,
  type CameraCaptureDeps,
} from './FaceDetectorHelpers';
import type { CaptureRateController } from './CameraFrameCaptureController';

// ============================================================================
// Constants
// ============================================================================

const DETECTOR_SETTINGS = {
  ...DEFAULT_SETTINGS,
  maxNumFaces: 1,
  minDetectionConfidence: 0.2,
  minTrackingConfidence: 0.2,
};

// ============================================================================
// Types
// ============================================================================

export type DetectionResult = {
  cameraId: string;
  sample: Sample | null;
  settings: typeof DEFAULT_SETTINGS;
};

export type Frame = DetectionResult;

type FaceDetectorProps = {
  selectedCameras: CameraEntity[];
  sortedDeviceIds: string[];
  goal: { current: Position | null };
  userId: string;
  monitorId: string;
  screenId: string;
  onDetect?: (result: DetectionResult) => void;
  onStatsUpdate?: (stats: any) => void;
  isPaused?: boolean;
  accept?: boolean;
  sendingFPS?: number;
} & Partial<typeof DETECTOR_SETTINGS>;

function FaceDetectorComponent({
  selectedCameras,
  sortedDeviceIds,
  goal,
  userId,
  monitorId,
  screenId,
  onDetect,
  onStatsUpdate,
  isPaused = false,
  accept = true,
  sendingFPS = 30,
}: FaceDetectorProps) {
  const videosRef = useRef(new Map<string, HTMLVideoElement | null>());
  const managerRef = useRef<FaceDetectorWorkerManager | null>(null);
  const captureControllersRef = useRef(new Map<string, CaptureRateController>());

  // Track FPS locally for input devices
  const { fpsRef, finalFpsRef } = useFpsTracking(sortedDeviceIds);

  // Initialize manager (runs once)
  useEffect(() => {
    console.log('[FaceDetector] Initialize manager effect');
    if (!managerRef.current) {
      const config: ManagerConfig = {
        userId,
        monitorId,
        screenId,
        maxChunkSize: 4 * 1024 * 1024,
        accept,
        isPaused,
        sendingFPS,
      };

      console.log('[FaceDetector] Creating new FaceDetectorWorkerManager with config:', { userId, monitorId, screenId, isPaused, accept, sendingFPS });
      managerRef.current = new FaceDetectorWorkerManager(config);
      managerRef.current.setCallbacks(onDetect, onStatsUpdate);
      managerRef.current.setFpsRef(finalFpsRef);
    }
  }, [userId, monitorId, screenId, isPaused, accept, sendingFPS, onDetect, onStatsUpdate, finalFpsRef]);

  // Keep fpsRef in sync with manager
  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.setFpsRef(finalFpsRef);
    }
  }, [finalFpsRef]);

  // Update config when settings change
  useEffect(() => {
    console.log('[FaceDetector] Config update effect - userId:', userId, 'monitorId:', monitorId, 'screenId:', screenId, 'selectedCameras:', selectedCameras);
    if (!managerRef.current) return;

    // Update global config first
    managerRef.current.updateConfig({
      userId,
      monitorId,
      screenId,
      accept,
      isPaused,
      sendingFPS,
    });

    // Update per-camera configs if they exist
    if (selectedCameras.length > 0) {
      const cameraConfigMap: Record<string, { placeId: string }> = {};
      for (const camera of selectedCameras) {
        const hashedCameraId = hash128Hex(camera.deviceId);
        cameraConfigMap[hashedCameraId] = {
          placeId: camera.placeId || '',
        };
      }
      managerRef.current.updateCameraConfigs(cameraConfigMap);
    }

    console.log('[FaceDetector] Config updated for manager');
    managerRef.current.setCallbacks(onDetect, onStatsUpdate);
  }, [userId, monitorId, screenId, isPaused, accept, sendingFPS, onDetect, onStatsUpdate, selectedCameras]);

  // Set up streams and frame capture
  useEffect(() => {
    console.log('[FaceDetector] Stream setup effect - cameraIds:', sortedDeviceIds);
    if (sortedDeviceIds.length === 0 || !managerRef.current) {
      console.log('[FaceDetector] Skipping stream setup: no cameras or manager not ready');
      return;
    }

    const manager = managerRef.current;
    let streams: Map<string, MediaStream> = new Map<string, MediaStream>();

    const controllers = captureControllersRef.current;

    (async () => {
      console.log('[FaceDetector] Initializing streams for cameras:', sortedDeviceIds);
      streams = await initializeStreams(sortedDeviceIds, videosRef.current, manager);
      console.log('[FaceDetector] Streams initialized, starting capture for', streams.size, 'cameras');
      // Start per-camera frame capture
      for (const [normalizedCameraId] of streams) {
        const fpsData = fpsRef.current.get(normalizedCameraId) || { frames: 0, lastTime: Date.now() };
        fpsRef.current.set(normalizedCameraId, fpsData);

        const cameraDeps: CameraCaptureDeps = {
          video: videosRef.current.get(normalizedCameraId),
          fpsData: fpsRef.current.get(normalizedCameraId),
          manager,
        };

        console.log('[FaceDetector] Starting frame capture for camera:', normalizedCameraId);
        const controller = createCameraFrameCapture(normalizedCameraId, cameraDeps, goal);
        controllers.set(normalizedCameraId, controller);
      }
    })();

    return () => {
      console.log('[FaceDetector] Cleaning up streams and capture controllers');
      controllers.forEach((controller) => controller.cleanup());
      controllers.clear();
      streams.forEach((stream: MediaStream) => stream.getTracks().forEach((t: MediaStreamTrack) => t.stop()));
    };
  }, [sortedDeviceIds, goal, fpsRef]);

  // Register capture controllers with manager
  useEffect(() => {
    if (!managerRef.current) return;

    // Pass capture controllers to manager for automatic rate adjustment
    managerRef.current.setCaptureControllers(captureControllersRef.current);

    // Set the original stats update callback
    managerRef.current.onStatsUpdate = onStatsUpdate || null;
  }, [onStatsUpdate]);

  const handleDataWorkerReady = useCallback((worker: Worker) => {
    if (managerRef.current) {
      managerRef.current.setDataWorker(worker);
    }
  }, []);

  if (sortedDeviceIds.length === 0) {
    return null;
  }

  return (
    <>
      <DataWorker onWorkerReady={handleDataWorkerReady} />
      {sortedDeviceIds.map((cameraId: string) => (
        <video
          key={cameraId}
          ref={(el) => {
            if (el) {
              videosRef.current.set(hash128Hex(cameraId), el);
            }
          }}
          className="hidden-video"
          autoPlay
          playsInline
          muted
        />
      ))}
    </>
  );
}

// Redux mapStateToProps: Extract userId, monitorId, selectedCameras, and sortedDeviceIds from Redux store
// Uses memoized selectors for optimal performance
const mapStateToProps = (state: any) => {
  const userId = selectUserId(state);
  const monitorId = selectMonitorId(state);
  const selectedCameras = selectSelectedCameras(state);
  const sortedDeviceIds = selectSortedDeviceIds(state);

  return {
    userId,
    monitorId,
    selectedCameras,
    sortedDeviceIds,
  };
};

// Export the Redux-connected component
export default connect(mapStateToProps)(FaceDetectorComponent);
