import { useMemo } from 'react';
import { connect } from 'react-redux';
import type { RootState } from '../store';
import { setCameraPlace } from '../store/slices/App';
import { recreatePlace, removePlace } from '../store/slices/UI';
import { selectPlaces } from '../store/selectors';
import type { Place } from '../types/entities';
import { byId } from '../shared/Sample';
import BaseSelector from './BaseSelector';

type CameraPlaceSelectorProps = {
  cameraId: string;
  selectedPlaceId: string;
  places: Place[] & { byId: (id: string) => Place | undefined };
  doSetCameraPlace: (payload: { deviceId: string; placeId: string }) => void;
  doRecreatePlace: (payload: { uuid: string }) => void;
  doRemovePlace: (placeId: string) => void;
  onAddPlace: (cameraId: string) => void;
};

function CameraPlaceSelector({
  cameraId,
  selectedPlaceId,
  places,
  doSetCameraPlace,
  doRecreatePlace,
  doRemovePlace,
  onAddPlace,
}: CameraPlaceSelectorProps) {
  // Filter and process places for this camera
  const cameraPrefix = useMemo(() => `${cameraId} | `, [cameraId]);

  const filteredPlaces = useMemo(() => {
    const filtered = places.filter(place => place.name.startsWith(cameraPrefix));
    return Object.assign(filtered, { byId: (id: string) => byId(filtered, id) });
  }, [places, cameraPrefix]);

  const withoutPrefix = (name: string) => name.replace(cameraPrefix, '');

  return (
    <BaseSelector<Place>
      selectedId={selectedPlaceId}
      items={filteredPlaces}
      onSelect={place => doSetCameraPlace({ deviceId: cameraId, placeId: place ? place.uuid : '' })}
      onAdd={() => onAddPlace(cameraId)}
      onRemove={() => doRemovePlace(selectedPlaceId)}
      onRecreate={() => doRecreatePlace({ uuid: selectedPlaceId })}
      labelKey="menu.place"
      renderItemLabel={place => `${withoutPrefix(place.name)} (${place.samples} samples)`}
      confirmRemoveKey="dialogs.confirmRemovePlace"
      confirmRecreateKey="dialogs.confirmRecreatePlace"
    />
  );
}

export default connect(
  (state: RootState) => ({
    places: selectPlaces(state),
  }),
  {
    doSetCameraPlace: setCameraPlace,
    doRecreatePlace: recreatePlace,
    doRemovePlace: removePlace,
  }
)(CameraPlaceSelector);
