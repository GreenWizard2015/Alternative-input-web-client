import { useEffect } from 'react';
import UIStart from './UIStart';
import UserDialog from './UserDialog';
import PlaceDialog from './PlaceDialog';
import MainMenu from './MainMenu';
import { selectDefaultValues, setPlace, setUser } from '../store/slices/UI';
import { setCameraPlace } from '../store/slices/App';
import { connect } from 'react-redux';
import { useDialogStateMachine } from '../hooks/useDialogStateMachine';

type UIProps = {
  goFullscreen: () => void;
  onStart: (mode: any) => void;
  canStart: boolean;
  selectDefaultValues: () => void;
  doSetCameraPlace: (payload: { deviceId: string; placeId: string }) => void;
  doSetPlace: (payload: { uuid: string; name: string; samples: number }) => void;
  doSetUser: (payload: { uuid: string; name: string; samples: number }) => void;
};

function UI({
  goFullscreen,
  onStart,
  canStart,
  selectDefaultValues,
  doSetCameraPlace,
  doSetPlace,
  doSetUser,
}: UIProps) {
  const {
    isIdle,
    isUserDialog,
    isPlaceDialog,
    isStartDialog,
    tempName,
    tempUUID,
    tempCameraId,
    openUserDialog,
    openPlaceDialog,
    openStartDialog,
    closeDialog,
    setTempName,
    setTempUUID,
  } = useDialogStateMachine();

  useEffect(() => {
    selectDefaultValues();
  }, [selectDefaultValues]);

  return (
    <>
      {isStartDialog && <UIStart onStart={onStart} />}

      {isUserDialog && (
        <UserDialog
          tempName={tempName}
          setTempName={setTempName}
          tempUUID={tempUUID}
          setTempUUID={setTempUUID}
          onConfirm={() => {
            // Create user and select it, then close
            doSetUser({ uuid: tempUUID, name: tempName, samples: 0 });
            closeDialog();
          }}
          onCancel={closeDialog}
        />
      )}

      {isPlaceDialog && (
        <PlaceDialog
          cameraId={tempCameraId || ''}
          tempName={tempName}
          setTempName={setTempName}
          onConfirm={(placeName) => {
            // Create place and assign to camera (placeName already has camera prefix)
            doSetPlace({ uuid: tempUUID, name: placeName, samples: 0 });
            if (tempCameraId) {
              doSetCameraPlace({ deviceId: tempCameraId, placeId: tempUUID });
            }
            closeDialog();
          }}
          onCancel={closeDialog}
        />
      )}

      {isIdle && (
        <MainMenu
          canStart={canStart}
          onAddUser={openUserDialog}
          onAddPlace={openPlaceDialog}
          onStart={openStartDialog}
          onFullscreen={goFullscreen}
        />
      )}
    </>
  );
}

export default connect(
  () => ({}),
  {
    selectDefaultValues,
    doSetCameraPlace: setCameraPlace,
    doSetPlace: setPlace,
    doSetUser: setUser,
  }
)(UI);
