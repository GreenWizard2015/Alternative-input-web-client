import { useTranslation } from 'react-i18next';
import UserSelector from './UserSelector';
import WebcamSelector from './WebcamSelector';

type MainMenuProps = {
  canStart: boolean;
  onAddUser: () => void;
  onAddPlace: (cameraId: string) => void;
  onStart: () => void;
  onFullscreen: () => void;
};

export default function MainMenu({
  canStart,
  onAddUser,
  onAddPlace,
  onStart,
  onFullscreen
}: MainMenuProps) {
  const { t } = useTranslation();

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
    </>
  );
}
