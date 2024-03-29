import React, { useCallback, useEffect, useMemo, useRef } from "react";
import * as cameraUtils from "@mediapipe/camera_utils";
import Webcam from "react-webcam";
import { FaceMesh, GpuBuffer, NormalizedLandmarkList, Results, ResultsListener } from "@mediapipe/face_mesh";
import { results2sample, Sample } from "../utils/MP";

const DEFAULT_SETTINGS = {
  mode: "circle", padding: 1.25,
  visibilityThreshold: 0.2, presenceThreshold: 0.2,
  SIZE: 40,

  maxNumFaces: 1,
  minDetectionConfidence: 0.2, minTrackingConfidence: 0.2,
};

export type Frame = {
  results: Results,
  sample: Sample | null,
  image: GpuBuffer,
  landmarks: NormalizedLandmarkList | null,
  settings: typeof DEFAULT_SETTINGS
}

// TODO: fix selection of webcam
// "BindingError: Cannot pass deleted object as a pointer of type SolutionWasm*
// at BindingError.<anonymous> (https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.js:9:136500)
// at new BindingError (eval at createNamedFunction (https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.js:9:135394), <anonymous>:4:34)
// at throwBindingError (https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.js:9:138077)
// at RegisteredPointer.nonConstNoSmartPtrRawPointerToWireType [as toWireType] (https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.js:9:152806)
// at SolutionWasm.SolutionWasm$send [as send] (eval at new_ (https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.js:9:161510), <anonymous>:7:28)
// at pa.h (http://localhost:3000/static/js/bundle.js:5402:17)
// at sa (http://localhost:3000/static/js/bundle.js:3751:17)
// at ta.next (http://localhost:3000/static/js/bundle.js:3777:64)
// at g (http://localhost:3000/static/js/bundle.js:4642:15)"
export default function FaceDetector({ onFrame, deviceId, ...settings }) {
  const Settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...settings }), [settings]); // never change
  const webcamRef = useRef<Webcam>(null);
  const intermediateCanvasRef = useRef(null);
  const callbackRef = useRef<((f: Frame) => void) | null>(null);
  useEffect(() => { callbackRef.current = onFrame; }, [onFrame]);

  const onResults = useCallback<ResultsListener>(
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

    const video = webcamRef.current?.video
    if (!video) return;
    const camera = new cameraUtils.Camera(
      video,
      {
        onFrame: async () => {
          await faceMesh.send({ image: video });
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