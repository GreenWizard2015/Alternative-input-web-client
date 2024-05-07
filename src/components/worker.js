/* eslint-env worker */
/* eslint no-restricted-globals: 0 */  // Disables no-restricted-globals lint error for this file
self.onmessage = function({ data: { samples, endpoint } }) {
  fetch(endpoint, {
    method: 'POST',
    body: new URLSearchParams([['chunk', samples]]),
  }).then(response => {
    if (response.ok) {
      return response.text();  // or response.json() if response is JSON
    }
    throw new Error('Network response was not ok.');
  }).then(text => {
    self.postMessage('OK');
  }).catch(error => {
    self.postMessage('Error: ' + error.message);
  });  
}
