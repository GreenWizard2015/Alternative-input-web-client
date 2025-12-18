/* eslint-env worker */
/* eslint no-restricted-globals: 0 */  // Disables no-restricted-globals lint error for this file

// Data Upload Worker - handles sample serialization and uploading to backend
//
// MESSAGES RECEIVED:
// - { samples: array, endpoint: string }
//   Receives an array of samples grouped by userId, placeId, screenId, cameraId
//   Groups samples by their identifiers and serializes them for upload
//   @param samples - Array of sample objects with userId, placeId, screenId, cameraId
//   @param endpoint - Backend endpoint URL where samples will be posted
//
// MESSAGES SENT:
// - { status: 'start', inQueue: number }
//   Sent when processing queue begins
//   @param inQueue - Number of items remaining in the queue
//
// - { status: 'ok', userId: string, placeId: string, count: number, inQueue: number, duration: number, chunks: number }
//   Sent after successful upload
//   @param duration - Time taken for the upload (ms)
//   @param chunks - Number of chunks received by server
//   @param inQueue - Items still waiting to be processed
//
// - { status: 'error', error: string }
//   Sent when upload fails after retries
//   @param error - Error message describing what went wrong

const { serialize } = require('./SerializeSamples');
let queue = [];
let isRunning = false;

// Retry upload with exponential backoff for transient failures
async function uploadWithRetry(fd, endpoint, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: fd
      });
      if (response.ok) return response.json();
      throw new Error(`HTTP error! status: ${response.status}`);
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      // Exponential backoff: 1s, 2s, 4s
      const delayMs = Math.pow(2, i) * 1000;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

function processQueue() {
  self.postMessage({ status: 'start', inQueue: queue.length });
  isRunning = queue.length > 0;
  if (!isRunning) return;
  const chunk = queue.pop(); // get the last element from the queue
  const { serializedSamples, endpoint, userId, placeId, count } = chunk;
  console.log('Sending', serializedSamples.byteLength, 'bytes to', endpoint);
  const fd = new FormData();
  fd.append('chunk', new Blob([serializedSamples], {type: 'application/octet-stream'}));

  const startTime = Date.now();
  uploadWithRetry(fd, endpoint).then(() => {
    const endTime = Date.now();
    queue.pop(); // remove the last element from the queue
    self.postMessage({
      status: 'ok', userId, placeId, count, inQueue: queue.length,
      duration: endTime - startTime
    });
  }).catch(error => {
    console.error('Upload failed after retries:', error);
    self.postMessage({ status: 'error', error: error.message });
    queue.push(chunk); // put the chunk back to the queue
  }).finally(() => {
    processQueue(); // process next chunk no matter what
  });
}

self.onmessage = function({ data }) {
  const { samples, endpoint } = data;
  // samples could have different ids, so we need to serialize them separately
  const grouped = samples.reduce((acc, sample) => {
    const { userId, placeId, screenId, cameraId } = sample;
    // Use pipe-separated format consistent with Sample.bucket() method
    const key = [userId, placeId, screenId, cameraId].join('|');

    if (!(key in acc)) acc[key] = [];
    acc[key].push(sample);
    return acc;
  }, {});
  // serialize the samples before pushing them to the queue
  // in hope that it will reduce the memory usage
  for(const groupId in grouped) {
    const samples = grouped[groupId];
    const { userId, placeId } = samples[0]; // Extract userId and placeId from first sample
    // put to the start of the queue
    queue.push({
      serializedSamples: serialize(samples),
      endpoint,
      userId,
      placeId,
      count: samples.length,
    });
  }
  if(!isRunning) processQueue(); // start processing the queue only if didn't start yet
}
