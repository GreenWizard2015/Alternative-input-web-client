// errorNotification component
import { useEffect, useState } from 'react';
import { connect } from 'react-redux';

interface ErrorMessage {
  message: string;
  code?: number;
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

      // Auto-remove error after 8 seconds
      setTimeout(() => {
        setErrors(prev => prev.filter(e => e.id !== errorId));
      }, 8000);
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
    <div className="error-notification-container">
      {errors.map(error => (
        <div key={error.id} className="error-notification-item">
          <strong>Upload Error {error.code ? `(${error.code})` : ''}</strong>
          <br />
          {error.message}
        </div>
      ))}
    </div>
  );
}

export default connect(() => ({}), {})(ErrorNotification);
