/* eslint-env worker */
/* eslint no-restricted-globals: 0 */  // Disables no-restricted-globals lint error for this file
const { serialize } = require('./SerializeSamples');
let queue = [];
let isRunning = false;

function processQueue() {
  self.postMessage({ status: 'start', inQueue: queue.length });
  isRunning = queue.length > 0;
  if (!isRunning) return;
  const chunk = queue.pop(); // get the last element from the queue
  const { serializedSamples, endpoint, userId, placeId, count } = chunk;
  console.log('Sending', serializedSamples.byteLength, 'bytes to', endpoint, 'for', userId, placeId, count);
  const fd = new FormData();
  fd.append('chunk', new Blob([serializedSamples], {type: 'application/octet-stream'}));

  const startTime = Date.now();
  fetch(endpoint, {
    method: 'POST',
    body: fd
  }).then(response => {
    if (response.ok) return response.json();
    throw new Error('Network response was not ok.');
  }).then(json => {
    const endTime = Date.now();
    queue.pop(); // remove the last element from the queue
    self.postMessage({ 
      status: 'ok', userId, placeId, count, inQueue: queue.length,
      duration: endTime - startTime,
      chunks: json.chunks,
    });
  }).catch(error => {
    self.postMessage({ status: 'error', error: error.message });
    queue.push(chunk); // put the chunk back to the queue
  }).finally(() => {
    processQueue(); // process next chunk no matter what
  });
}

self.onmessage = function({ data }) {
  const { samples, endpoint, userId, placeId, count } = data;
  // samples could have different ids, so we need to serialize them separately
  const grouped = samples.reduce((acc, sample) => {
    const { userId, placeId, screenId } = sample;
    const key = `${userId}-${placeId}-${screenId}`;
    
    if (!(key in acc)) acc[key] = [];
     acc[key].push(sample);
    return acc;
  }, {});
  // serialize the samples before pushing them to the queue
  // in hope that it will reduce the memory usage
  for(const groupId in grouped) {
    const samples = grouped[groupId];
    // put to the start of the queue
    queue.push({
      serializedSamples: serialize(samples),
      endpoint,
      userId,
      placeId,
      count
    });
  }
  if(!isRunning) processQueue(); // start processing the queue only if didn't start yet
}
