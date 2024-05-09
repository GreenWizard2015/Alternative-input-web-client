/* eslint-env worker */
/* eslint no-restricted-globals: 0 */  // Disables no-restricted-globals lint error for this file
self.onmessage = function({ data: { samples, endpoint, userId, placeId, count } }) {
  const fd = new FormData();
  fd.append('chunk', new Blob([samples], {type: 'application/octet-stream'}));
  
  fetch(endpoint, {
    method: 'POST',
    body: fd
  }).then(response => {
    if (response.ok) {
      return response.text();  // or response.json() if response is JSON
    }
    throw new Error('Network response was not ok.');
  }).then(text => {
    self.postMessage({ status: 'ok', text, userId, placeId, count });
  }).catch(error => {
    self.postMessage('Error: ' + error.message);
  });  
}
