// errorNotification component
import { useEffect, useState } from 'react';
import { connect } from 'react-redux';
import { RootState } from '../store';

interface ErrorMessage {
  message: string;
  code?: number;
  isVercelBlocking?: boolean;
  id?: string;
}

function ErrorNotification() {
  const [errors, setErrors] = useState<ErrorMessage[]>([]);

  // Subscribe to worker errors
  useEffect(() => {
    const handleWorkerError = (event: CustomEvent) => {
      const error = event.detail;
      const errorId = `${Date.now()}-${Math.random()}`;
      const errorWithId: ErrorMessage = { ...error, id: errorId };

      setErrors(prev => [...prev, errorWithId]);

      // Auto-remove error after 8 seconds (or 15 seconds for Vercel blocking)
      const timeout = error.isVercelBlocking ? 15000 : 8000;
      setTimeout(() => {
        setErrors(prev => prev.filter(e => e.id !== errorId));
      }, timeout);
    };

    window.addEventListener('workerError', handleWorkerError as EventListener);
    return () => {
      window.removeEventListener('workerError', handleWorkerError as EventListener);
    };
  }, []);

  if (errors.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        maxWidth: '400px',
        zIndex: 9999,
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {errors.map(error => (
        <div
          key={error.id}
          style={{
            padding: '12px 16px',
            marginBottom: '10px',
            backgroundColor: error.isVercelBlocking ? '#ff6b6b' : '#dc3545',
            color: 'white',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            fontSize: '14px',
            lineHeight: '1.4',
          }}
        >
          {error.isVercelBlocking ? (
            <>
              <strong>Vercel is blocking requests (Error 403)</strong>
              <br />
              <small>Waiting 1 minute before retry...</small>
              <br />
              {error.message}
            </>
          ) : (
            <>
              <strong>Upload Error {error.code ? `(${error.code})` : ''}</strong>
              <br />
              {error.message}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default connect(
  (state: RootState) => ({}),
  {},
)(ErrorNotification);
