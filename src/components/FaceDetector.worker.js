const { FilesetResolver, FaceLandmarker } = require("@mediapipe/tasks-vision");

let queue = [];
let isRunning = false;
let faceLandmarker = null;

async function processQueue() {
  isRunning = queue.length > 0;
  if (!isRunning) return;

  const chunk = queue.shift();
  const { data, time, bitmapTime } = chunk;
  try {
    // could throw an error
    if (!faceLandmarker) return;
    const startTime = performance.now();
    const results = await faceLandmarker.detectForVideo(data, time);
    const detectionDuration = performance.now() - startTime;
    console.log(`Pipeline: bitmap=${bitmapTime?.toFixed(1)}ms, detection=${detectionDuration.toFixed(1)}ms, queueSize=${queue.length}`);
    self.postMessage({ status: "detected", results, time, frame: data });
  } finally {
    processQueue(); // process next chunk
  }
}

self.onmessage = async function({ data }) {
  if (data === "stop") {
    if (faceLandmarker) {

      faceLandmarker.close();
      faceLandmarker = null;
    }
    self.postMessage({ status: "stopped" });
    return;
  }
  if (data === "start") {
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
    return;
  }
  queue.push(data);
  // leave up to 10 frames in the queue
  queue.splice(0, queue.length - 10);
  if (!isRunning) processQueue();
}
