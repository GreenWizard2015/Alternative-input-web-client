import React, { useEffect, useMemo, useRef } from 'react';
import Webcam from 'react-webcam';
import { FaceLandmarker, FaceLandmarkerResult, FilesetResolver, NormalizedLandmark } from '@mediapipe/tasks-vision';
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

export default function FaceDetectorComponent({ onFrame, deviceId, ...settings }) {
  const Settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...settings }), [settings]);
  const webcamRef = useRef<Webcam | null>(null);
  const intermediateCanvasRef = useRef<HTMLCanvasElement>(null);
  const frameCanvasRef = useRef<HTMLCanvasElement>(null);
  const callbackRef = useRef<((frame) => void) | null>(null);

  useEffect(() => {
    callbackRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    async function setupFaceLandmarker() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 1
      });
      
      const video = webcamRef.current?.video;
      if (!video) {
        console.error('Webcam not available');
        return;
      }

      const camera = new cameraUtils.Camera(video, {
        onFrame: async () => {
          const results: FaceLandmarkerResult = await faceLandmarker.detectForVideo(video, Date.now());
          const frame = frameCanvasRef.current;
          if (frame) {
            frame.width = video.videoWidth;
            frame.height = video.videoHeight;
            const ctx = frame.getContext('2d');
            ctx?.drawImage(video, 0, 0, frame.width, frame.height);
            
            if (callbackRef.current) {
              callbackRef.current({
                results,
                sample: results2sample(results, frame, intermediateCanvasRef.current, Settings),
                image: frame,
                landmarks: results.faceLandmarks[0],
                settings: Settings,
              });
            }
          }
        },
      });
      camera.start();

      return () => {
        faceLandmarker.close();
        camera.stop();
      };
    }

    setupFaceLandmarker();
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