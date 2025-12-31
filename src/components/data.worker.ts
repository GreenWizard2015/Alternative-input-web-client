/* eslint-env worker */
/* eslint-disable no-restricted-globals */  // Worker code needs access to 'self'

/**
 * data.worker.ts - Sample upload worker (simplified for pre-serialized buffers)
 *
 * PHASE 2C: Simplified to handle pre-serialized buffers from FaceDetector workers
 *
 * MESSAGES RECEIVED:
 * - { samples: ArrayBuffer, userId: string, placeId: string, endpoint: string, count: number }
 *   Receives pre-serialized sample buffer ready for upload
 *   @param samples - Pre-serialized ArrayBuffer (from FaceDetectorWorker.serialize())
 *   @param userId - User ID for tracking
 *   @param placeId - Place ID for tracking
 *   @param endpoint - Backend endpoint URL
 *   @param count - Number of samples in this batch
 *
 * MESSAGES SENT:
 * - { status: 'start', inQueue: number }
 *   Sent when processing queue begins
 *
 * - { status: 'ok', userId: string, placeId: string, count: number, inQueue: number, duration: number }
 *   Sent after successful upload
 *   @param duration - Time taken for the upload (ms)
 *   @param inQueue - Items still waiting to be processed
 *
 * - { status: 'error', error: string, code: number|null }
 *   Sent when upload fails after retries
 */

type QueueItem = {
  serializedBuffer: ArrayBuffer;
  endpoint: string;
  userId: string;
  placeId: string;
  count: number;
};

type UploadMessage = {
  samples: ArrayBuffer;
  endpoint: string;
  userId: string;
  placeId: string;
  count: number;
};

type ErrorWithCode = Error & { code?: number };

let queue: QueueItem[] = [];
let isRunning = false;

/**
 * Upload with exponential backoff for transient failures
 */
async function uploadWithRetry(
  fd: FormData,
  endpoint: string,
  maxRetries = 3
): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: fd
      });
      if (response.ok) return response.json();

      // Handle 403 Forbidden (Vercel blocking)
      if (response.status === 403) {
        console.warn('Received 403 error from Vercel, sleeping for 1 minute before retry...');
        const error = new Error(`HTTP error! status: ${response.status}`) as ErrorWithCode;
        error.code = 403;
        throw error;
      }

      const error = new Error(`HTTP error! status: ${response.status}`) as ErrorWithCode;
      error.code = response.status;
      throw error;
    } catch (e) {
      const error = e as ErrorWithCode;
      // Handle 403 errors with longer delay
      if (error.code === 403) {
        if (i === maxRetries - 1) throw e;
        console.log('Waiting 1 minute before retrying due to 403 Forbidden...');
        await new Promise(r => setTimeout(r, 60000)); // 1 minute
      } else {
        if (i === maxRetries - 1) throw e;
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, i) * 1000;
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
}

/**
 * Process next item in queue
 */
function processQueue(): void {
  self.postMessage({ status: 'start', inQueue: queue.length });
  isRunning = queue.length > 0;
  if (!isRunning) return;

  const item = queue.shift(); // Get first item (FIFO)
  if (!item) return;

  const { serializedBuffer, endpoint, userId, placeId, count } = item;
  console.log('Sending', serializedBuffer.byteLength, 'bytes to', endpoint);

  // Create FormData with serialized buffer
  const fd = new FormData();
  fd.append('chunk', new Blob([new Uint8Array(serializedBuffer)], {
    type: 'application/octet-stream'
  }));

  const startTime = Date.now();
  uploadWithRetry(fd, endpoint)
    .then(() => {
      const endTime = Date.now();
      self.postMessage({
        status: 'ok',
        inQueue: queue.length,
        duration: endTime - startTime,
        userId,
        placeId,
        count,
      });
    })
    .catch((error: ErrorWithCode) => {
      console.error('Upload failed after retries:', error);
      self.postMessage({
        status: 'error',
        error: error.message,
        code: error.code || null
      });
      // Put item back at front of queue for retry
      queue.unshift(item);
    })
    .finally(() => {
      // Process next item
      processQueue();
    });
}

/**
 * Handle messages from FaceDetectorWorkerManager
 *
 * Expects pre-serialized ArrayBuffer (no grouping/serialization needed)
 */
self.onmessage = function(event: MessageEvent<UploadMessage>) {
  const { samples, endpoint, userId, placeId, count } = event.data;

  // Simply queue the pre-serialized buffer
  queue.push({
    serializedBuffer: samples,
    endpoint,
    userId,
    placeId,
    count,
  });

  // Start processing if not already running
  if (!isRunning) {
    processQueue();
  }
};
