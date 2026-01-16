import { useTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import UserSelector from './UserSelector';
import MonitorSelector from './MonitorSelector';
import WebcamSelector from './WebcamSelector';
import { hash128Hex } from '../utils';
import { selectMonitorId } from '../store/selectors';
import type { RootState } from '../store';

type MainMenuProps = {
  canStart: boolean;
  onAddUser: () => void;
  onAddPlace: (cameraId: string) => void;
  onAddMonitor: () => void;
  onStart: () => void;
  onFullscreen: () => void;
  onGoalSettings: () => void;
  userId?: string;
  selectedCameras?: Array<{ deviceId: string; placeId?: string }>;
  screenId?: string;
  monitorId: string;
};

function MainMenu({
  canStart,
  onAddUser,
  onAddPlace,
  onAddMonitor,
  onStart,
  onFullscreen,
  onGoalSettings,
  userId = '',
  selectedCameras = [],
  screenId = '',
  monitorId,
}: MainMenuProps) {
  const { t } = useTranslation();

  // Build debug info
  const debugInfo = [
    `User: ${userId}`,
    `Monitor: ${monitorId}`,
    ...selectedCameras.map((cam, idx) => `Camera ${idx + 1}: ${hash128Hex(cam.deviceId)}`),
    ...selectedCameras.map((cam, idx) => `Place camera ${idx + 1}: ${cam.placeId || ''}`),
    `Screen: ${screenId}`,
  ].join('\n');

  return (
    <>
      <UserSelector onAdd={onAddUser} />
      <MonitorSelector onAdd={onAddMonitor} />
      <WebcamSelector onAddPlace={onAddPlace} />

      <button className="w100" onClick={onStart} disabled={!canStart}>
        {t('common.start')}
      </button>
      <button className="w100" onClick={onFullscreen}>
        {t('menu.fullscreen')}
      </button>
      <button className="w100" onClick={onGoalSettings}>
        {t('dialogs.goalSettings')}
      </button>

      <textarea className="debug-info-textarea" value={debugInfo} readOnly />
    </>
  );
}

export default connect(
  (state: RootState) => ({
    monitorId: selectMonitorId(state),
  }),
  {}
)(MainMenu);
