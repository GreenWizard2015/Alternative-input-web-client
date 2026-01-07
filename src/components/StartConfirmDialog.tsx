import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { selectUserId, selectMonitorId, selectSelectedCameras, selectUsers, selectMonitors } from '../store/selectors';
import { closeDialog, setMode } from '../store/slices/App';

export default function StartConfirmDialog() {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  // Get data from Redux
  const userId = useSelector(selectUserId);
  const monitorId = useSelector(selectMonitorId);
  const selectedCameras = useSelector(selectSelectedCameras);
  const users = useSelector(selectUsers);
  const monitors = useSelector(selectMonitors);

  // Lookup user and monitor names
  const userName = users.byId(userId)?.name || '';
  const monitorName = monitors.byId(monitorId)?.name || '';
  const cameraLabels = selectedCameras.map(cam => cam.label || cam.deviceId);

  // Redux actions
  const handleConfirm = useCallback(() => {
    dispatch(setMode('game'));
    dispatch(closeDialog());
  }, [dispatch]);

  const handleCancel = useCallback(() => {
    dispatch(closeDialog());
  }, [dispatch]);

  return (
    <div className="dialog-overlay">
      <div className="dialog-content">
        <h2>{t('gameStart.confirmTitle')}</h2>

        <div className="confirm-details">
          <div className="detail-row">
            <label>{t('common.user')}:</label>
            <span className="detail-value">{userName}</span>
          </div>

          <div className="detail-row">
            <label>{t('common.monitor')}:</label>
            <span className="detail-value">{monitorName}</span>
          </div>

          <div className="detail-row">
            <label>{t('common.cameras')}:</label>
            <div className="camera-list">
              {cameraLabels.length > 0 ? (
                <ul>
                  {cameraLabels.map((label, idx) => (
                    <li key={idx}>{label}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-gray">{t('common.none')}</span>
              )}
            </div>
          </div>
        </div>

        <div className="dialog-actions">
          <button onClick={handleCancel} className="btn-secondary">
            {t('common.cancel')}
          </button>
          <button onClick={handleConfirm} className="btn-primary">
            {t('common.start')}
          </button>
        </div>
      </div>
    </div>
  );
}
