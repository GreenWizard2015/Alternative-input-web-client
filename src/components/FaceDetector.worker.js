const { FilesetResolver, FaceLandmarker } = require("@mediapipe/tasks-vision");

let queue = [];
let faceLandmarker = null;

async function processQueue() {
  if (queue.length === 0) {
    return;
  }
  const chunk = queue.shift();
  const { data, time } = chunk;
  const results = await faceLandmarker.detectForVideo(data, time);
  self.postMessage({ status: "detected", results, time, frame: data });
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
  const time = Date.now();
  queue.push({ data, time });
  processQueue();
}
