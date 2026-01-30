import { useCallback } from 'react';
import { connect } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { AppMode } from '../modes/AppMode';
import {
  selectUserId,
  selectMonitorId,
  selectSelectedCameras,
  selectUsers,
  selectMonitors,
} from '../store/selectors';
import { closeDialog, setGameMode, openGameControlsDialog } from '../store/slices/App';
import type { RootState } from '../store';
import type { Dispatch } from 'redux';

interface StartConfirmDialogProps {
  gameMode: AppMode;
  userId: string;
  monitorId: string;
  selectedCameras: ReturnType<typeof selectSelectedCameras>;
  users: ReturnType<typeof selectUsers>;
  monitors: ReturnType<typeof selectMonitors>;
  onCloseDialog: () => void;
  setGameMode: (mode: AppMode) => void;
  openGameControlsDialog: () => void;
}

function StartConfirmDialog({
  gameMode,
  userId,
  monitorId,
  selectedCameras,
  users,
  monitors,
  onCloseDialog,
  setGameMode: setGameModeDispatch,
  openGameControlsDialog: openGameControlsDialogDispatch,
}: StartConfirmDialogProps) {
  const { t } = useTranslation();

  // Lookup user and monitor names
  const userName = users.byId(userId)?.name || '';
  const monitorName = monitors.byId(monitorId)?.name || '';
  const cameraLabels = selectedCameras.map(cam => cam.label || cam.deviceId);

  // Redux actions
  const handleConfirm = useCallback(() => {
    // NEW FLOW: Don't call onConfirm immediately
    // Instead: Store game mode and show controls dialog
    setGameModeDispatch(gameMode);
    openGameControlsDialogDispatch();
    // Note: onConfirm will be called from ControlsDialog in UI.tsx
  }, [gameMode, setGameModeDispatch, openGameControlsDialogDispatch]);

  const handleCancel = useCallback(() => {
    onCloseDialog();
  }, [onCloseDialog]);

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
                  {cameraLabels.map(label => (
                    <li key={label}>{label}</li>
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

export default connect(
  (state: RootState) => ({
    userId: selectUserId(state),
    monitorId: selectMonitorId(state),
    selectedCameras: selectSelectedCameras(state),
    users: selectUsers(state),
    monitors: selectMonitors(state),
  }),
  (dispatch: Dispatch) => ({
    onCloseDialog: () => dispatch(closeDialog()),
    setGameMode: (mode: AppMode) => dispatch(setGameMode(mode)),
    openGameControlsDialog: () => dispatch(openGameControlsDialog()),
  })
)(StartConfirmDialog);
