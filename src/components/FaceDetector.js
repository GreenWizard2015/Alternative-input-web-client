import React, { useCallback, useEffect, useMemo, useRef } from "react";
import * as cameraUtils from "@mediapipe/camera_utils";
import Webcam from "react-webcam";
import { FaceMesh } from "@mediapipe/face_mesh";
import { results2sample } from "../utils/MP";

const DEFAULT_SETTINGS = {
  mode: "circle", padding: 1.25,
  visibilityThreshold: 0.2, presenceThreshold: 0.2,
  SIZE: 40,

  maxNumFaces: 1,
  minDetectionConfidence: 0.2, minTrackingConfidence: 0.2,
};

// TODO: fix selection of webcam
export default function FaceDetector({ children, onFrame, deviceId, ...settings }) {
  const Settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...settings }), [ settings ]); // never change
  const webcamRef = useRef(null);
  const intermediateCanvasRef = useRef(null);
  const callbackRef = useRef(null);
  useEffect(() => { callbackRef.current = onFrame; }, [onFrame]);

  const onResults = useCallback(
    (results) => {
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
    },
    [Settings, callbackRef, intermediateCanvasRef]
  );

  useEffect(() => {
    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    const { maxNumFaces, minDetectionConfidence, minTrackingConfidence } = Settings;
    faceMesh.setOptions({ maxNumFaces, minDetectionConfidence, minTrackingConfidence });
    faceMesh.onResults(onResults);

    const camera = new cameraUtils.Camera(
      webcamRef.current.video,
      {
        onFrame: async () => {
          await faceMesh.send({ image: webcamRef.current.video });
        },
      });

    camera.start();
    return () => {
      faceMesh.close().then(() => camera.stop());
    };
  }, [Settings, onResults, deviceId]);

  const videoConstraints = deviceId ? { deviceId: { exact: deviceId } } : undefined;
  return (
    <>
      <Webcam
        ref={webcamRef} style={{ display: "none" }}
        videoConstraints={videoConstraints}
      />
      <canvas ref={intermediateCanvasRef} style={{ display: "none" }} />
    </>
  );
}