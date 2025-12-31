import { useEffect } from 'react';
import { connect } from 'react-redux';

// @ts-ignore - worker-loader transforms this into a Worker constructor
import DataWorkerModule from './data.worker.ts';

// Lazy load to avoid circular dependency
const getActions = () => {
  const { incrementStats } = require('../store/slices/UI');
  const { changeActiveUploads } = require('../store/slices/App');
  return { incrementStats, changeActiveUploads };
};

type DataWorkerProps = {
  incrementStats: any;
  changeActiveUploads: any;
  onWorkerReady?: (worker: Worker) => void;
};

const DataWorkerComponent = ({ incrementStats, changeActiveUploads, onWorkerReady }: DataWorkerProps) => {
  useEffect(() => {
    const newWorker = new DataWorkerModule();

    // Notify parent that worker is ready
    if (onWorkerReady) {
      onWorkerReady(newWorker);
    }

    newWorker.onmessage = function(e: MessageEvent<any>) {
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
  }, [incrementStats, changeActiveUploads, onWorkerReady]);
  return null;
};

const mapDispatchToProps = () => {
  const { incrementStats, changeActiveUploads } = getActions();
  return {
    incrementStats,
    changeActiveUploads
  };
};

const DataWorker = connect(null, mapDispatchToProps)(DataWorkerComponent);

export default DataWorker;