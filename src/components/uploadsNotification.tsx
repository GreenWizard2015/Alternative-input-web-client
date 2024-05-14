// uploadsNotification component
import React, { useEffect, useRef } from 'react';
import { connect } from 'react-redux';
import { RootState } from '../store';

function UploadsNotification({ activeUploads, show }) {
  // show confirmation dialog before leaving the page if there are active uploads
  const activeUploadsRef = useRef(activeUploads);
  useEffect(() => {
    activeUploadsRef.current = activeUploads;
  }, [activeUploads]);

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (activeUploadsRef.current > 0) {
        const answer = window.confirm(
          `There are ${activeUploadsRef.current} active uploads. Are you sure you want to leave the page?`,
        );

        if (!answer) {
          event.preventDefault();
          event.returnValue = '';
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
  return null;
}

export default connect(
  (state: RootState) => ({
    activeUploads: state.App.activeUploads,
  }),
  {},
)(UploadsNotification);