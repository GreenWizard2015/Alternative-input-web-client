import React, { useEffect, useRef } from "react";
import * as cameraUtils from "@mediapipe/camera_utils";
import Webcam from "react-webcam";
import { FaceMesh } from "@mediapipe/face_mesh";
import { results2sample } from "utils/MP";

const DEFAULT_SETTINGS = {
  mode: "circle", padding: 1.25,
  visibilityThreshold: 0.2, presenceThreshold: 0.2,
  SIZE: 40,

  maxNumFaces: 1,
  minDetectionConfidence: 0.2, minTrackingConfidence: 0.2,
};

export default function FaceDetector({ children, onFrame, ...settings }) {
  const webcamRef = useRef(null);
  const intermediateCanvasRef = useRef(null);
  const callbackRef = useRef(null);
  useEffect(() => { callbackRef.current = onFrame; }, [onFrame]);
  // store settings and dont relay on props
  const Settings = React.useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...settings }),
    [] // never update..?
  );

  function onResults(results) {
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
  }

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
      camera.stop();
      faceMesh.close();
    };
  }, [Settings, onResults]);

  return (
    <>
      <Webcam ref={webcamRef} style={{ display: "none" }} />
      <canvas ref={intermediateCanvasRef} style={{ display: "none" }} />
    </>
  );
}