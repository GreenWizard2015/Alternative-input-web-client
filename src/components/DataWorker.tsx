import { useEffect } from 'react';
import { connect } from 'react-redux';

// @ts-ignore - worker-loader transforms this into a Worker constructor
import DataWorkerModule from './data.worker.ts';

import { incrementStats } from '../store/slices/UI';
import { changeActiveUploads } from '../store/slices/App';

type DataWorkerProps = {
  incrementStats: any;
  changeActiveUploads: any;
  onWorkerReady?: (worker: Worker) => void;
};

const DataWorkerComponent = ({ incrementStats, changeActiveUploads, onWorkerReady }: DataWorkerProps) => {
  useEffect(() => {
    const newWorker = new DataWorkerModule();

    if (onWorkerReady) {
      onWorkerReady(newWorker);
    }

    newWorker.onmessage = function(e: MessageEvent<any>) {
      console.log('Message received from worker', e.data);
      const { status, inQueue, error, code, userId, placeId, count, duration } = e.data;

      if (status === 'start') {
        changeActiveUploads({ total: inQueue, duration: null });
      } else if (status === 'error') {
        const errorEvent = new CustomEvent('workerError', { detail: { message: error, code } });
        window.dispatchEvent(errorEvent);
      } else if (status === 'ok') {
        incrementStats({ userId, placeId, count });
        changeActiveUploads({ total: inQueue, duration });
      } else {
        console.error('[DataWorker] Unknown message status:', status, 'full message:', e.data);
      }
    };

    return () => newWorker.terminate();
  }, [incrementStats, changeActiveUploads, onWorkerReady]);

  return null;
};

export default connect(
  null,
  { incrementStats, changeActiveUploads }
)(DataWorkerComponent);