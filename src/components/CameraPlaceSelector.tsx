import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import type { RootState } from '../store';
import { setCameraPlace } from '../store/slices/App';
import { resetPlace, removePlace } from '../store/slices/UI';
import { selectPlaces } from '../store/selectors';
import type { Place } from '../types/entities';

type CameraPlaceSelectorProps = {
  cameraId: string;
  selectedPlaceId: string;
  places: Place[] & { byId: (id: string) => Place | undefined };
  doSetCameraPlace: (payload: { deviceId: string; placeId: string }) => void;
  doResetPlace: (payload: { uuid: string }) => void;
  doRemovePlace: (placeId: string) => any;
  onAddPlace: (cameraId: string) => void;
};

function CameraPlaceSelector({
  cameraId,
  selectedPlaceId,
  places,
  doSetCameraPlace,
  doResetPlace,
  doRemovePlace,
  onAddPlace,
}: CameraPlaceSelectorProps) {
  const { t } = useTranslation ();

  // Filter places for this camera
  const cameraPrefix = useMemo(() => `${cameraId} | `, [cameraId]);
  const withoutPrefix = useCallback((name: string) => name.replace(cameraPrefix, ''), [cameraPrefix]);

  const filteredPlaces = useMemo(
    () => places.filter(place => place.name.startsWith(cameraPrefix)),
    [places, cameraPrefix]
  );

  const handleRemovePlace = useCallback(() => {
    const place = places.byId(selectedPlaceId);
    if (place && window.confirm(t('dialogs.confirmRemovePlace', { name: withoutPrefix(place.name) }))) {
      doRemovePlace(selectedPlaceId);
    }
  }, [selectedPlaceId, places, t, doRemovePlace, withoutPrefix]);

  const handleResetPlace = useCallback(() => {
    const place = places.byId(selectedPlaceId);
    if (place && window.confirm(t('dialogs.confirmResetPlace', { name: withoutPrefix(place.name) }))) {
      doResetPlace({ uuid: selectedPlaceId });
    }
  }, [selectedPlaceId, places, t, doResetPlace, withoutPrefix]);

  return (
    <div className='flex w100'>
      {t('menu.place')}
      <select value={selectedPlaceId} onChange={e => {
        const value = e.target.value;
        if (value === '') {
          doSetCameraPlace({ deviceId: cameraId, placeId: '' });
        } else {
          const place = places.byId(value);
          if (place) doSetCameraPlace({ deviceId: cameraId, placeId: place.uuid });
        }
      }}>
        <option value="">{t('menu.notSelected')}</option>
        {filteredPlaces.map(place => (
          <option key={place.uuid} value={place.uuid}>
            {withoutPrefix(place.name)} ({place.samples} {t('menu.samples')})
          </option>
        ))}
      </select>
      <button className='flex-grow m5' onClick={() => onAddPlace(cameraId)}>{t('menu.add')}</button>
      <button className='flex-grow m5' disabled={!selectedPlaceId} onClick={handleRemovePlace}>{t('menu.remove')}</button>
      <button className='flex-grow m5' disabled={!selectedPlaceId} onClick={handleResetPlace}>{t('menu.reset')}</button>
    </div>
  );
}

export default connect(
  (state: RootState) => ({
    places: selectPlaces(state),
  }),
  {
    doSetCameraPlace: setCameraPlace,
    doResetPlace: resetPlace,
    doRemovePlace: removePlace,
  }
)(CameraPlaceSelector);
