import React, { useEffect, useMemo, useRef } from 'react';
import Webcam from 'react-webcam';
import { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';
import cameraUtils from '@mediapipe/camera_utils';
import { results2sample } from '../utils/MP';

const DEFAULT_SETTINGS = {
  mode: 'circle', padding: 1.25,
  visibilityThreshold: 0.2, presenceThreshold: 0.2,
  SIZE: 32,
  maxNumFaces: 1,
  minDetectionConfidence: 0.2,
  minTrackingConfidence: 0.2,
};

export default function FaceDetectorComponent({ onFrame, deviceId, goal, ...settings }) {
  const Settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...settings }), [settings]);
  const settingsRef = useRef(Settings);
  useEffect(() => {
    settingsRef.current = Settings;
  }, [Settings]);

  const webcamRef = useRef<Webcam | null>(null);
  const intermediateCanvasRef = useRef<HTMLCanvasElement>(null);
  const frameCanvasRef = useRef<HTMLCanvasElement>(null);
  const callbackRef = useRef<((frame) => void) | null>(null);
  useEffect(() => {
    callbackRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    async function setup() {
      const worker = new Worker(new URL('./FaceDetector.worker.js', import.meta.url));
      worker.onmessage = function(e) {
        const status = e.data?.status;
        if (status === 'detected') {
          const { results, time } = e.data;
          const elapsed = Date.now() - time;
          if (elapsed > 75) {
            console.warn('Detection took', elapsed, 'ms');
          }
          const frame = e.data?.frame;
          if (frame && callbackRef.current) {
            const sample = results2sample(results, frame, intermediateCanvasRef.current, Settings);
            if(null == sample) return;

            sample.time = time;
            sample.goal = goal.current;
            
            callbackRef.current({
              results,
              sample,
              image: frame,
              landmarks: results.faceLandmarks[0],
              settings: Settings,
            });
          }
          return;
        }
        if (status === 'stopped') {
          console.log('Worker stopped');
          worker.terminate();
          return;
        }
      };
      worker.postMessage('start');

      const video = webcamRef.current?.video;
      if (!video) {
        console.error('Webcam not available');
        return;
      }

      const camera = new cameraUtils.Camera(video, {
        onFrame: async () => {
          const frame = await createImageBitmap(video);
          worker.postMessage(frame);
        },
      });
      camera.start();

      return () => {
        worker.postMessage('stop');
        camera.stop();
      };
    }

    setup();
  }, [Settings, deviceId]);

  const videoConstraints = deviceId ? { deviceId: { exact: deviceId } } : undefined;

  return (
    <>
      <Webcam
        ref={webcamRef}
        style={{ display: 'none' }}
        videoConstraints={videoConstraints}
      />
      <canvas ref={intermediateCanvasRef} style={{ display: 'none' }} />
      <canvas ref={frameCanvasRef} style={{ display: 'none' }} />
    </>
  );
}

export type Frame = {
  results: FaceLandmarkerResult,
  sample: any,
  image: HTMLCanvasElement | null,
  landmarks: NormalizedLandmark[][],
  settings: typeof DEFAULT_SETTINGS,
};