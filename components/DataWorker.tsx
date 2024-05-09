import { useEffect } from 'react';

let worker;
const DataWorker = () => {
  useEffect(() => {
    const url = new URL('./worker.js', import.meta.url);
    const newWorker = new Worker(url, { type: 'module' });
    worker = newWorker;

    newWorker.onmessage = function(e) {
      console.log('Message received from worker', e.data);
    };

    return () => {
      newWorker.terminate();
    };
  }, []);

  return null;
};

export default DataWorker;
export { worker };