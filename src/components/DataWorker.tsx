import { useEffect } from 'react';

let worker;
const DataWorker = ({ incrementStats, changeActiveUploads }) => {
  useEffect(() => {
    const newWorker = new Worker(new URL('./data.worker.js', import.meta.url));
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