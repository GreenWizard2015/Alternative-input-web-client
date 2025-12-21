import { useEffect, useRef } from 'react';
import { DEFAULT_SETTINGS } from '../utils/MP';

const DETECTOR_SETTINGS = {
  ...DEFAULT_SETTINGS,
  maxNumFaces: 1,
  minDetectionConfidence: 0.2,
  minTrackingConfidence: 0.2,
};

const CAPTURE_INTERVAL = 20;
const READINESS_TIMEOUT = 3000;

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
  const videoRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map());
  const workersRef = useRef<Map<string, Worker>>(new Map());
  const fpsRef = useRef<Map<string, { frames: number; samples: number; lastTime: number }>>(new Map());

  // Set up workers and stream capture
  useEffect(() => {
    const cameraIds = cameraIdsStrList.split(",").filter(id => id.length > 0);
    if (cameraIds.length === 0) return;

    const workers = workersRef.current;
    const streams = new Map<string, MediaStream>();
    let timerId: NodeJS.Timeout | null = null;
    let isCapturing = false;

    // Clean up removed cameras' workers
    Array.from(workers.keys())
      .filter(id => !cameraIds.includes(id))
      .forEach(id => {
        workers.get(id)?.postMessage({ type: 'stop' });
        workers.get(id)?.terminate();
        workers.delete(id);
      });

    // Initialize new workers
    cameraIds.forEach(cameraId => {
      if (!workers.has(cameraId)) {
        const worker = new Worker(new URL('./FaceDetector.worker.js', import.meta.url));
        workers.set(cameraId, worker);

        worker.onmessage = (e) => {
          if (e.data.type === 'detected' && onDetect) {
            const fps = fpsRef.current.get(cameraId) || { frames: 0, samples: 0, lastTime: Date.now() };
            fps.samples++;
            fpsRef.current.set(cameraId, fps);

            onDetect({
              cameraId,
              sample: e.data.sample,
              settings: DETECTOR_SETTINGS,
            });
          }
        };

        worker.postMessage({ type: 'init', id: cameraId });
      }
    });

    // Initialize camera streams
    const initializeStreams = async () => {
      for (const cameraId of cameraIds) {
        try {
          const video = videoRefs.current.get(cameraId);
          if (!video) continue;

          const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: cameraId } }
          });

          streams.set(cameraId, stream);
          video.srcObject = stream;
          await video.play().catch(() => {});

          // Wait for video to be ready
          await new Promise<void>((resolve) => {
            let done = false;
            const timer = setInterval(() => {
              if (!done && video.readyState >= video.HAVE_ENOUGH_DATA) {
                done = true;
                clearInterval(timer);
                resolve();
              }
            }, 50);
            setTimeout(() => {
              if (!done) {
                done = true;
                clearInterval(timer);
                resolve();
              }
            }, READINESS_TIMEOUT);
          });
        } catch (error) {
          console.error(`[${cameraId}] Failed to initialize stream`);
        }
      }
    };

    // Capture frames from cameras
    const captureFrames = async () => {
      if (isCapturing) {
        timerId = setTimeout(captureFrames, CAPTURE_INTERVAL);
        return;
      }

      isCapturing = true;
      const frames: Array<{ cameraId: string; frame: ImageBitmap; time: number }> = [];

      for (const [cameraId] of streams) {
        const video = videoRefs.current.get(cameraId);
        if (!video?.videoWidth || video.readyState < video.HAVE_ENOUGH_DATA) continue;

        try {
          const frame = await createImageBitmap(video);
          frames.push({ cameraId, frame, time: Date.now() });

          // Update FPS counter
          const fps = fpsRef.current.get(cameraId) || { frames: 0, samples: 0, lastTime: Date.now() };
          fps.frames++;
          fpsRef.current.set(cameraId, fps);
        } catch (error) {
          // Silently skip frame capture errors
        }
      }

      // Send frames to workers
      frames.forEach(({ cameraId, frame, time }) => {
        workers.get(cameraId)?.postMessage(
          { type: 'frame', frame, time, goal: goal.current },
          [frame]
        );
      });

      isCapturing = false;
      timerId = setTimeout(captureFrames, CAPTURE_INTERVAL);
    };

    // Report FPS
    let fpsTimer: NodeJS.Timeout | null = null;
    if (onFPS) {
      fpsTimer = setInterval(() => {
        const now = Date.now();
        const fpsData: Record<string, { camera: number; samples: number }> = {};

        cameraIds.forEach(cameraId => {
          const fps = fpsRef.current.get(cameraId) || { frames: 0, samples: 0, lastTime: now };
          const duration = (now - fps.lastTime) / 1000;
          fpsData[cameraId] = {
            camera: fps.frames / duration,
            samples: fps.samples / duration,
          };
          fps.frames = 0;
          fps.samples = 0;
          fps.lastTime = now;
        });

        onFPS(fpsData);
      }, 1500);
    }

    // Start initialization
    initializeStreams().then(() => {
      if (streams.size > 0) {
        captureFrames();
      }
    });

    return () => {
      if (timerId) clearTimeout(timerId);
      if (fpsTimer) clearInterval(fpsTimer);
      streams.forEach(stream => stream.getTracks().forEach(t => t.stop()));
      workers.forEach(w => {
        w.postMessage({ type: 'stop' });
        w.terminate();
      });
      workers.clear();
    };
  }, [cameraIdsStrList, goal, onDetect, onFPS]);

  const cameraIds = cameraIdsStrList.split(",").filter(id => id.length > 0);

  // Don't render if no cameras selected
  if (cameraIds.length === 0) {
    return null;
  }

  return (
    <>
      {cameraIds.map(cameraId => (
        <video
          key={cameraId}
          ref={(el) => {
            if (el) {
              videoRefs.current.set(cameraId, el);
            }
          }}
          // Hide video element off-screen but allow buffering
          style={{
            position: 'absolute',
            left: '-10000px',
            width: '1px',
            height: '1px',
          }}
          // Autoplay allows browser to start buffering immediately
          autoPlay
          playsInline
          muted
        />
      ))}
    </>
  );
}
