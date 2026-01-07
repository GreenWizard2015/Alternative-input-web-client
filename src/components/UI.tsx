import { useEffect } from 'react';
import UIStart from './UIStart';
import UserDialog from './UserDialog';
import PlaceDialog from './PlaceDialog';
import MonitorDialog from './MonitorDialog';
import StartConfirmDialog from './StartConfirmDialog';
import MainMenu from './MainMenu';
import { selectDefaultValues, addPlace, setUser, addMonitor } from '../store/slices/UI';
import { connect } from 'react-redux';
import { useDialogStateMachine } from '../hooks/useDialogStateMachine';
import { selectUserId, selectSelectedCameras } from '../store/selectors';
import type { RootState } from '../store';

type UIProps = {
  goFullscreen: () => void;
  onStart: (mode: any) => void;
  canStart: boolean;
  selectDefaultValues: () => void;
  doAddPlace: (name: string) => void;
  doSetUser: (name: string) => void;
  doAddMonitor: (name: string) => void;
  userId?: string;
  selectedCameras?: Array<{ deviceId: string; placeId?: string; label?: string }>;
  screenId?: string;
};

function UI({
  goFullscreen,
  onStart,
  canStart,
  selectDefaultValues,
  doAddPlace,
  doSetUser,
  doAddMonitor,
  userId = '',
  selectedCameras = [],
  screenId = '',
}: UIProps) {
  const {
    isIdle,
    isUserDialog,
    isPlaceDialog,
    isMonitorDialog,
    isStartDialog,
    isGameConfirmDialog,
    tempName,
    tempCameraId,
    openUserDialog,
    openPlaceDialog,
    openMonitorDialog,
    openStartDialog,
    closeDialog,
    setTempName,
  } = useDialogStateMachine();

  useEffect(() => {
    selectDefaultValues();
  }, [selectDefaultValues]);

  return (
    <>
      {isStartDialog && <UIStart onStart={onStart} />}

      {isGameConfirmDialog && <StartConfirmDialog />}

      {isUserDialog && (
        <UserDialog
          tempName={tempName}
          setTempName={setTempName}
          onConfirm={(name) => {
            // Create user and select it, then close
            doSetUser(name);
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
            // Create place (placeName already has camera prefix)
            // UUID is generated in Redux reducer
            doAddPlace(placeName);
            closeDialog();
          }}
          onCancel={closeDialog}
        />
      )}

      {isMonitorDialog && (
        <MonitorDialog
          tempName={tempName}
          setTempName={setTempName}
          onConfirm={(name) => {
            // Create monitor
            // UUID is generated in Redux reducer
            doAddMonitor(name);
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
          onAddMonitor={openMonitorDialog}
          onStart={openStartDialog}
          onFullscreen={goFullscreen}
          userId={userId}
          selectedCameras={selectedCameras}
          screenId={screenId}
        />
      )}
    </>
  );
}

export default connect(
  (state: RootState) => {
    const selectedCameras = selectSelectedCameras(state);
    const userId = selectUserId(state);

    return {
      userId,
      selectedCameras: selectedCameras.map(cam => ({ deviceId: cam.deviceId, placeId: cam.placeId, label: cam.label })),
    };
  },
  {
    selectDefaultValues,
    doAddPlace: addPlace,
    doSetUser: setUser,
    doAddMonitor: addMonitor,
  }
)(UI);
