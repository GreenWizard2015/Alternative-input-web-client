// Single Camera Worker - handles face detection and sample generation
//
// MESSAGES RECEIVED:
// - { type: 'init', id: string }
//   Initializes the worker with a camera ID and loads the face detection model
//
// - { type: 'frame', frame: VideoFrame, time: number, goal: any }
//   Queues a video frame for face detection processing
//   @param frame - VideoFrame object to analyze
//   @param time - Timestamp for the frame
//   @param goal - Goal data associated with this frame
//
// - { type: 'stop' }
//   Stops processing, clears the queue, and cleans up resources
//
// MESSAGES SENT:
// - { type: 'detected', sample: object }
//   Sends detected face landmarks and sample data
//   @param sample - Contains face detection results with goal and time attached

import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import { results2sample, DEFAULT_SETTINGS } from "../utils/MP";

let frameQueue = [];
let isProcessing = false;
let faceLandmarker = null;
let cameraId = null;
let offscreenCanvas = null;

// Initialize face detection
const initFaceLandmarker = async () => {
  if (faceLandmarker) return;
  // Initialize OffscreenCanvas for sample processing
  offscreenCanvas = new OffscreenCanvas(1, 1);

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );
  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: "GPU"
    },
    outputFaceBlendshapes: false,
    runningMode: "VIDEO",
    numFaces: 1
  });
};

// Process frame queue
const processQueue = async () => {
  isProcessing = frameQueue.length > 0;
  if (!isProcessing) return;

  const { frame, time, goal } = frameQueue.shift();

  if (!faceLandmarker) {
    frame.close();
    processQueue();
    return;
  }

  try {
    const detection = await faceLandmarker.detectForVideo(frame, time);

    // Generate sample from detection results
    const sample = results2sample(detection, frame, offscreenCanvas, DEFAULT_SETTINGS);
    if(sample) {
      sample.goal = goal;
      sample.time = time;

      self.postMessage({type: 'detected', sample});
    }
  } catch (error) {
    console.error(`Detection failed:`, error);
    frame.close();
  }

  processQueue();
};

self.onmessage = async function({ data }) {
  const { type, id, frame, time, goal } = data;

  if (type === 'init') {
    cameraId = id;
    await initFaceLandmarker();
    console.log(`Worker for camera ${cameraId} initialized`);
    return;
  }

  if (type === 'frame') {
    // Queue frame for processing with goal data
    frameQueue.push({ frame, time, goal });
    if (frameQueue.length > 30) {
      frameQueue.shift().frame.close();
    }
    if (!isProcessing) processQueue();
    return;
  }

  if (type === 'stop') {
    frameQueue.forEach(({ frame }) => frame.close());
    frameQueue = [];
    if (faceLandmarker) {
      faceLandmarker.close();
      faceLandmarker = null;
    }
    return;
  }
};
