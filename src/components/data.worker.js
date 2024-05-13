/* eslint-env worker */
/* eslint no-restricted-globals: 0 */  // Disables no-restricted-globals lint error for this file
const { serialize } = require('./Samples');
let queue = [];

function processQueue() {
  self.postMessage({ status: 'start', inQueue: queue.length });
  if (queue.length === 0) {
    return;
  }
  const chunk = queue.shift();
  const { samples, endpoint, userId, placeId, count } = chunk;
  const serializedSamples = serialize(samples);
  console.log('Sending', serializedSamples.byteLength, 'bytes to', endpoint, 'for', userId, placeId, count);
  const fd = new FormData();
  fd.append('chunk', new Blob([serializedSamples], {type: 'application/octet-stream'}));

  fetch(endpoint, {
    method: 'POST',
    body: fd
  }).then(response => {
    if (response.ok) {
      return response.text();  // or response.json() if response is JSON
    }
    throw new Error('Network response was not ok.');
  }).then(text => {
    self.postMessage({ status: 'ok', text, userId, placeId, count, inQueue: queue.length});
    processQueue();
  }).catch(error => {
    self.postMessage({ status: 'error', error: error.message });
    queue.unshift(chunk);
    processQueue();
  });
}

self.onmessage = function({ data }) {
  queue.push(data);
  processQueue();
}
