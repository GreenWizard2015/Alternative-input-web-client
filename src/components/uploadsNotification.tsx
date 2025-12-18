// uploadsNotification component
import { useEffect, useRef } from 'react';
import i18n from '../i18n';
import { connect } from 'react-redux';
import { RootState } from '../store';

function UploadsNotification({ activeUploads }) {
  // show confirmation dialog before leaving the page if there are active uploads
  const activeUploadsRef = useRef(activeUploads);
  useEffect(() => {
    activeUploadsRef.current = activeUploads;
  }, [activeUploads]);

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (activeUploadsRef.current > 0) {
        const { t } = i18n;
        const answer = window.confirm(
          t('notifications.leaveWarning', { count: activeUploadsRef.current }),
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