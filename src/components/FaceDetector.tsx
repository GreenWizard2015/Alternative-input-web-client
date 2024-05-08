import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import Webcam from 'react-webcam';
import { FaceMesh, GpuBuffer, NormalizedLandmarkList, Results } from '@mediapipe/face_mesh';
import cameraUtils from '@mediapipe/camera_utils';
import { results2sample, Sample } from '../utils/MP';

const DEFAULT_SETTINGS = {
  mode: 'circle', padding: 1.25,
  visibilityThreshold: 0.2, presenceThreshold: 0.2,
  SIZE: 32,
  maxNumFaces: 1,
  minDetectionConfidence: 0.2,
  minTrackingConfidence: 0.2,
};
export type Frame = {
  results: Results,
  sample: Sample | null,
  image: GpuBuffer,
  landmarks: NormalizedLandmarkList | null,
  settings: typeof DEFAULT_SETTINGS
}

export default function FaceDetector({ onFrame, deviceId, ...settings }) {
  const Settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...settings }), [settings]);
  const webcamRef = useRef<Webcam | null>(null);
  const intermediateCanvasRef = useRef(null);
  const callbackRef = useRef<((frame: Frame) => void) | null>(null);

  useEffect(() => {
    callbackRef.current = onFrame;
  }, [onFrame]);

  const onResults = useCallback((results) => {
    if (!callbackRef.current) return;

    const { SIZE, mode, padding, visibilityThreshold, presenceThreshold } = Settings;
    const sample = results2sample(results, intermediateCanvasRef.current, {
      mode, padding,
      visibilityThreshold, presenceThreshold,
      SIZE,
    });

    const landmarks = sample ? results.multiFaceLandmarks[0] : null;
    callbackRef.current({
      results,
      sample,
      image: results.image,
      landmarks,
      settings: Settings,
    });
  }, [Settings]);

  useEffect(() => {
    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    const { maxNumFaces, minDetectionConfidence, minTrackingConfidence } = Settings;
    faceMesh.setOptions({ maxNumFaces, minDetectionConfidence, minTrackingConfidence });
    faceMesh.onResults(onResults);

    const video = webcamRef.current?.video;
    if (!video) {
      console.error('Webcam not available');
      return;
    }

    const camera = new cameraUtils.Camera(video, {
      onFrame: async () => {
        await faceMesh.send({ image: video });
      },
    });

    camera.start();

    return () => {
      faceMesh.close().then(() => camera.stop()).catch(console.error);
    };
  }, [Settings, onResults, deviceId]);

  const videoConstraints = deviceId ? { deviceId: { exact: deviceId } } : undefined;

  return (
    <>
      <Webcam
        ref={webcamRef}
        style={{ display: 'none' }}
        videoConstraints={videoConstraints}
      />
      <canvas ref={intermediateCanvasRef} style={{ display: 'none' }} />
    </>
  );
}
