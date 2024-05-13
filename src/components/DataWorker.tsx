import { useEffect } from 'react';

let worker;
const DataWorker = ({ incrementStats, changeActiveUploads }) => {
  useEffect(() => {
    const url = new URL('./worker.js', import.meta.url);
    const newWorker = new Worker(url, { type: 'module' });
    worker = newWorker;

    newWorker.onmessage = function(e) {
      console.log('Message received from worker', e.data);
      if('start' === e.data.status) {
        const { inQueue } = e.data;
        changeActiveUploads(inQueue);
        return;
      } else {
        const { status, userId, placeId, count, inQueue } = e.data;
        if('ok' === status) {
          incrementStats({ userId, placeId, count });
          changeActiveUploads(inQueue);
        }
      }
    };

    return () => {
      newWorker.terminate();
    };
  }, [incrementStats, changeActiveUploads]);
  return null;
};

export default DataWorker;
export { worker };