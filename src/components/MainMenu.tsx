import { useTranslation } from 'react-i18next';
import UserSelector from './UserSelector';
import WebcamSelector from './WebcamSelector';
import { hash128Hex } from '../utils';

type MainMenuProps = {
  canStart: boolean;
  onAddUser: () => void;
  onAddPlace: (cameraId: string) => void;
  onStart: () => void;
  onFullscreen: () => void;
  userId?: string;
  selectedCameras?: Array<{ deviceId: string; placeId?: string }>;
  screenId?: string;
};

export default function MainMenu({
  canStart,
  onAddUser,
  onAddPlace,
  onStart,
  onFullscreen,
  userId = '',
  selectedCameras = [],
  screenId = ''
}: MainMenuProps) {
  const { t } = useTranslation();

  // Build debug info
  const debugInfo = [
    `User: ${userId}`,
    ...selectedCameras.map((cam, idx) => `Camera ${idx + 1}: ${hash128Hex(cam.deviceId)}`),
    ...selectedCameras.map((cam, idx) => `Place camera ${idx + 1}: ${cam.placeId || ''}`),
    `Screen: ${screenId}`
  ].join('\n');

  return (
    <>
      <UserSelector onAdd={onAddUser} />
      <WebcamSelector onAddPlace={onAddPlace} />

      <button
        className='w100'
        onClick={onStart}
        disabled={!canStart}
      >
        {t('common.start')}
      </button>
      <button className='w100' onClick={onFullscreen}>{t('menu.fullscreen')}</button>

      <textarea className="debug-info-textarea" value={debugInfo} readOnly />
    </>
  );
}
