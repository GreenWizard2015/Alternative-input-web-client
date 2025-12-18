import { useEffect, useMemo, useRef } from 'react';
import Webcam from 'react-webcam';
import { DEFAULT_SETTINGS } from '../utils/MP';

const DETECTOR_SETTINGS = {
  ...DEFAULT_SETTINGS,
  maxNumFaces: 1,
  minDetectionConfidence: 0.2,
  minTrackingConfidence: 0.2,
};

export type DetectionResult = {
  cameraId: string;
  sample: any;
  settings: typeof DEFAULT_SETTINGS;
};

export type Frame = DetectionResult;

type FaceDetectorProps = {
  onDetect: (result: DetectionResult) => void;
  onFPS?: (fps: Record<string, { camera: number; samples: number }>) => void;
  cameraIdsStrList: string;
  goal: React.MutableRefObject<any>;
} & Partial<typeof DETECTOR_SETTINGS>;

export default function FaceDetectorComponent({ onDetect, onFPS, cameraIdsStrList, goal }: FaceDetectorProps) {
  // Per-camera FPS tracking
  const framesCount = useRef<Map<string, number>>(new Map());
  const samplesCount = useRef<Map<string, number>>(new Map());
  const lastTime = useRef(Date.now());

  useEffect(() => {
    // Initialize counters for all cameras
    cameraIdsStrList.split(",").forEach(cameraId => {
      if (!framesCount.current.has(cameraId)) {
        framesCount.current.set(cameraId, 0);
      }
      if (!samplesCount.current.has(cameraId)) {
        samplesCount.current.set(cameraId, 0);
      }
    });
  }, [cameraIdsStrList]);

  useEffect(() => {
    if (!onFPS) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const duration = now - lastTime.current;
      const fpsData: Record<string, { camera: number; samples: number }> = {};

      cameraIdsStrList.split(",").forEach(cameraId => {
        const cameraFps = (framesCount.current.get(cameraId) || 0) / duration * 1000;
        const samplesFps = (samplesCount.current.get(cameraId) || 0) / duration * 1000;
        fpsData[cameraId] = { camera: cameraFps, samples: samplesFps };
        console.log(`[FPS] ${cameraId}: ${cameraFps.toFixed(1)} camera fps, ${samplesFps.toFixed(1)} samples fps`);
        framesCount.current.set(cameraId, 0);
        samplesCount.current.set(cameraId, 0);
      });

      onFPS(fpsData);
      lastTime.current = now;
    }, 1500);
    return () => clearInterval(interval);
  }, [onFPS, cameraIdsStrList]);

  const webcamRefs = useRef<Map<string, Webcam | null>>(new Map());
  const callbackRef = useRef<((result: DetectionResult) => void) | null>(null);
  const workersRef = useRef<Map<string, Worker>>(new Map());

  useEffect(() => {
    callbackRef.current = onDetect;
  }, [onDetect]);

  // Set up worker for each camera
  useEffect(() => {
    // Clean up old workers for cameras that are no longer selected
    const oldCameraIds = Array.from(workersRef.current.keys());
    for (const cameraId of oldCameraIds) {
      if (!cameraIdsStrList.includes(cameraId)) {
        const worker = workersRef.current.get(cameraId);
        if (worker) {
          worker.postMessage({ type: 'stop' });
          worker.terminate();
          workersRef.current.delete(cameraId);
        }
      }
    }

    // Set up new workers for newly selected cameras
    cameraIdsStrList.split(",").forEach(cameraId => {
      if (!workersRef.current.has(cameraId)) {
        const worker = new Worker(new URL('./FaceDetector.worker.js', import.meta.url));
        workersRef.current.set(cameraId, worker);

        // Handle detection results from worker
        worker.onmessage = (e) => {
          if (e.data.type === 'detected') {
            const { sample } = e.data;

            if (sample && callbackRef.current) {
              const newFrameCount = (framesCount.current.get(cameraId) || 0) + 1;
              const newSampleCount = (samplesCount.current.get(cameraId) || 0) + 1;
              framesCount.current.set(cameraId, newFrameCount);
              samplesCount.current.set(cameraId, newSampleCount);

              callbackRef.current({
                cameraId,
                sample,
                settings: DETECTOR_SETTINGS,
              });
            } else {
              console.warn(`[${cameraId}] Detected but no sample or no callback`);
            }
          }
        };

        // Initialize worker with camera ID
        console.log(`[Worker] Initializing worker for camera ${cameraId}`);
        worker.postMessage({ type: 'init', id: cameraId });
      }
    });

    return () => {
      // On unmount, clean up all workers
      workersRef.current.forEach((worker) => {
        worker.postMessage({ type: 'stop' });
        worker.terminate();
      });
      workersRef.current.clear();
    };
  }, [cameraIdsStrList]);

  // Set up native MediaDevices streams and batched frame capture
  useEffect(() => {
    const cameraIds = cameraIdsStrList.split(",");
    let timerId: NodeJS.Timeout | null = null;
    let isCapturing = false;
    const streams = new Map<string, MediaStream>(); // cameraId -> MediaStream
    const CAPTURE_INTERVAL = 50; // Frame capture interval

    // Initialize camera streams
    const initializeStreams = async () => {
      for (const cameraId of cameraIds) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: cameraId } }
          });
          streams.set(cameraId, stream);

          // Attach to video element for frame capture
          const video = webcamRefs.current.get(cameraId)?.video;
          if (video) {
            video.srcObject = stream;
            video.play().catch(err => console.error(`[${cameraId}] Play error:`, err));
          }
        } catch (error) {
          console.error(`[${cameraId}] Failed to get media stream:`, error);
        }
      }
    };

    // Batch capture frames from all cameras
    const captureFrames = async () => {
      if (isCapturing) {
        timerId = setTimeout(captureFrames, 0);
        return;
      }

      isCapturing = true;
      const framesToSend: Array<{ cameraId: string; frame: ImageBitmap; time: number }> = [];

      for (const [cameraId, stream] of streams) {
        // Get video track from stream
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack || !videoTrack.readyState || videoTrack.readyState !== 'live') {
          continue;
        }

        try {
          const video = webcamRefs.current.get(cameraId)?.video;
          if (!video || (video.readyState !== video.HAVE_ENOUGH_DATA)) {
            continue;
          }

          const now = Date.now();
          const frame = await createImageBitmap(video);
          framesToSend.push({ cameraId, frame, time: now });
        } catch (error) {
          console.error(`[${cameraId}] Frame capture error:`, error);
        }
      }

      // Send all captured frames to their respective workers
      if (framesToSend.length > 0) {
        console.log(`[Capture] Sending ${framesToSend.length} frames: ${framesToSend.map(f => f.cameraId).join(', ')}`);
      }
      for (const { cameraId, frame, time } of framesToSend) {
        const worker = workersRef.current.get(cameraId);
        if (worker) {
          worker.postMessage({ type: 'frame', frame, time, goal: goal.current }, [frame]);
        }
      }


      isCapturing = false;
      timerId = setTimeout(captureFrames, CAPTURE_INTERVAL);
    };

    // Initialize streams and start capture
    initializeStreams().then(() => {
      console.log(`[Capture] Initialized ${streams.size} camera streams`);
      if (streams.size > 0) {
        captureFrames();
      }
    });

    return () => {
      if (timerId !== null) {
        clearTimeout(timerId);
      }

      // Clean up streams
      streams.forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
      });
      streams.clear();
    };
  }, [cameraIdsStrList]);

  return (
    <>
      {cameraIdsStrList.split(",").map(cameraId => (
        <Webcam
          key={cameraId}
          ref={(ref) => {
            webcamRefs.current.set(cameraId, ref);
          }}
          style={{ display: 'none' }}
          videoConstraints={{ deviceId: { exact: cameraId } }}
        />
      ))}
    </>
  );
}
