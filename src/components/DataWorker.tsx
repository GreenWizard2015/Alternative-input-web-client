import { useEffect } from 'react';

let worker: Worker;
const DataWorker = ({ incrementStats, changeActiveUploads, onError }) => {
  useEffect(() => {
    const newWorker = new Worker(new URL('./data.worker.js', import.meta.url));
    worker = newWorker;

    newWorker.onmessage = function(e) {
      console.log('Message received from worker', e.data);
      if('start' === e.data.status) {
        const { inQueue } = e.data;
        changeActiveUploads({ total: inQueue, duration: null });
        return;
      } else if('error' === e.data.status) {
        const { error, code } = e.data;
        // Dispatch error event to UI
        const errorEvent = new CustomEvent('workerError', {
          detail: { message: error, code }
        });
        window.dispatchEvent(errorEvent);

        if(onError) {
          onError({ message: error, code });
        }
        return;
      } else {
        const { status, userId, placeId, count, inQueue, duration } = e.data;
        if('ok' === status) {
          incrementStats({ userId, placeId, count });
          changeActiveUploads({ total: inQueue, duration });
        }
      }
    };

    return () => {
      newWorker.terminate();
    };
  }, [incrementStats, changeActiveUploads, onError]);
  return null;
};

export default DataWorker;
export { worker };