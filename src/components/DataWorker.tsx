import { useEffect } from 'react';

let worker;
const DataWorker = ({ incrementStats, changeActiveUploads }) => {
  useEffect(() => {
    const url = new URL('./worker.js', import.meta.url);
    const newWorker = new Worker(url, { type: 'module' });
    worker = newWorker;

    newWorker.onmessage = function(e) {
      if('start' === e.data.status) {
        console.log('Worker started uploading data');
        changeActiveUploads(1);
        return;
      } else {
        const { status, userId, placeId, count } = e.data;
        if('ok' === status) {
          incrementStats({ userId, placeId, count });
          changeActiveUploads(-1);
        }
        console.log('Message received from worker', e.data);
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