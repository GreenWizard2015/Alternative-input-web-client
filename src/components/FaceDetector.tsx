import React, { useEffect, useMemo, useRef } from 'react';
import Webcam from 'react-webcam';
import { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';
import cameraUtils from '@mediapipe/camera_utils';
import { results2sample } from '../utils/MP';

const DEFAULT_SETTINGS = {
  mode: 'circle', padding: 1.35,
  visibilityThreshold: 0.2, presenceThreshold: 0.2,
  SIZE: 48,
  maxNumFaces: 1,
  minDetectionConfidence: 0.2,
  minTrackingConfidence: 0.2,
};

const CORRECTED_BASE_TIME = Math.round(Date.now() - performance.now());
let old_now = performance.now();
let old_timestamp = Math.round(CORRECTED_BASE_TIME + old_now);
function getTimestamp() {
  // Date.now() is int number of milliseconds since 1970
  // performance.now() is float number of milliseconds since page load, with microsecond precision
  // we combine them to get a float number of milliseconds since 1970 with microsecond precision
  let timestamp = Math.round(CORRECTED_BASE_TIME + performance.now());
  if(timestamp == old_now) {
    timestamp = old_timestamp + 1; // add 1ms to old_timestamp, to avoid duplicates in the same millisecond
  } else { // update old_now
    old_now = timestamp;
  }
  old_timestamp = timestamp; // save last timestamp
  return timestamp;
}

export default function FaceDetectorComponent({ onFrame, onFPS, deviceId, goal, ...settings }) {
  // calculate avg fps
  const framesCount = useRef(0);
  const lastTime = useRef(Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const fps = framesCount.current / (now - lastTime.current) * 1000;
      onFPS(fps);
      framesCount.current = 0;
      lastTime.current = now;
    }, 1500);
    return () => clearInterval(interval);
  }, [onFPS]);

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
    const worker = new Worker(new URL('./FaceDetector.worker.js', import.meta.url));
    
    worker.onmessage = function(e) {
      const status = e.data?.status;
      if (status === 'detected') {
        const { results, time } = e.data;
        const frame = e.data?.frame;
        if (frame && callbackRef.current && intermediateCanvasRef.current) {
          const sample = results2sample(results, frame, intermediateCanvasRef.current, Settings);
          if(null == sample) return;
          // override the time with the time from the worker and add the goal
          sample.time = time;
          sample.goal = goal.current;
          
          framesCount.current++;
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
        worker.postMessage({ data: frame, time: getTimestamp() });
      },
    });
    camera.start();

    return () => {
      camera.stop();
      worker.postMessage('stop');
    };
  }, [Settings, deviceId, goal]);

  const videoConstraints = deviceId ? { 
    deviceId: { exact: deviceId },
  } : undefined;

  return (
    <>
      <Webcam
        ref={webcamRef}
        style={{ display: 'block' }}
        videoConstraints={videoConstraints}
        key={deviceId} // force re-render on deviceId change
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