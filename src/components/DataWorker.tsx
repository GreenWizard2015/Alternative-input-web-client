import { useEffect } from 'react';

let worker;
const DataWorker = ({ incrementStats }) => {
  useEffect(() => {
    const url = new URL('./worker.js', import.meta.url);
    const newWorker = new Worker(url, { type: 'module' });
    worker = newWorker;

    newWorker.onmessage = function(e) {
      const { status, userId, placeId, count } = e.data;
      if('ok' === status) {
        incrementStats({ userId, placeId, count });
      }
      console.log('Message received from worker', e.data);
    };

    return () => {
      newWorker.terminate();
    };
  }, [incrementStats]);
  return null;
};

export default DataWorker;
export { worker };