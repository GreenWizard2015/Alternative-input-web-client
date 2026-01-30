import { useEffect } from 'react';
import UIStart from './UIStart';
import UserDialog from './UserDialog';
import PlaceDialog from './PlaceDialog';
import MonitorDialog from './MonitorDialog';
import StartConfirmDialog from './StartConfirmDialog';
import ControlsDialog from './ControlsDialog';
import GoalDialog from './GoalDialog';
import MainMenu from './MainMenu';
import { selectDefaultValues, addPlace, setUser, addMonitor } from '../store/slices/UI';
import { connect } from 'react-redux';
import { useDialogStateMachine } from '../hooks/useDialogStateMachine';
import { selectUserId, selectSelectedCameras } from '../store/selectors';
import type { RootState } from '../store';
import type { AppMode } from '../modes/AppMode';
import type { Dispatch } from 'redux';

type UIProps = {
  goFullscreen: () => void;
  onStart: (mode: AppMode) => void;
  canStart: boolean;
  selectDefaultValues: () => void;
  doAddPlace: (name: string) => void;
  doSetUser: (name: string) => void;
  doAddMonitor: (name: string) => void;
  userId?: string;
  selectedCameras?: Array<{ deviceId: string; placeId?: string; label?: string }>;
  screenId?: string;
  dialogType: string;
  tempName: string;
  tempCameraId: string;
  dispatch: Dispatch;
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
  dialogType,
  tempName,
  tempCameraId,
  dispatch,
}: UIProps) {
  const {
    isIdle,
    isUserDialog,
    isPlaceDialog,
    isMonitorDialog,
    isStartDialog,
    isGameConfirmDialog,
    isGameControlsDialog,
    isGoalDialog,
    pendingGameMode,
    onGameStartConfirm,
    openUserDialog,
    openPlaceDialog,
    openMonitorDialog,
    openStartDialog,
    openGameConfirmDialog,
    openGoalDialog,
    closeDialog,
    setTempName,
  } = useDialogStateMachine({ dialogType, tempName, tempCameraId, dispatch });

  useEffect(() => {
    selectDefaultValues();
  }, [selectDefaultValues]);

  return (
    <>
      {isStartDialog && (
        <UIStart onStart={mode => openGameConfirmDialog(mode, onStart)} onBack={closeDialog} />
      )}

      {isGameConfirmDialog && pendingGameMode && onGameStartConfirm && (
        <StartConfirmDialog gameMode={pendingGameMode} />
      )}

      {isGameControlsDialog && pendingGameMode && onGameStartConfirm && (
        <ControlsDialog
          gameMode={pendingGameMode}
          onConfirm={() => {
            // ULTRATHINK NOTE: This is where onConfirm finally gets called
            // It was stored in hook when UIStart called openGameConfirmDialog
            onGameStartConfirm(pendingGameMode);
            closeDialog();
          }}
        />
      )}

      {isUserDialog && (
        <UserDialog
          tempName={tempName}
          setTempName={setTempName}
          onConfirm={name => {
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
          onConfirm={placeName => {
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
          onConfirm={name => {
            // Create monitor
            // UUID is generated in Redux reducer
            doAddMonitor(name);
            closeDialog();
          }}
          onCancel={closeDialog}
        />
      )}

      {isGoalDialog && <GoalDialog onClose={closeDialog} />}

      {isIdle && (
        <MainMenu
          canStart={canStart}
          onAddUser={openUserDialog}
          onAddPlace={openPlaceDialog}
          onAddMonitor={openMonitorDialog}
          onStart={openStartDialog}
          onFullscreen={goFullscreen}
          onGoalSettings={openGoalDialog}
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
      selectedCameras: selectedCameras.map(cam => ({
        deviceId: cam.deviceId,
        placeId: cam.placeId,
        label: cam.label,
      })),
      dialogType: state.App.dialogType,
      tempName: state.App.tempName,
      tempCameraId: state.App.tempCameraId,
    };
  },
  (dispatch: Dispatch) => ({
    selectDefaultValues: () => dispatch(selectDefaultValues()),
    doAddPlace: (name: string) => dispatch(addPlace(name)),
    doSetUser: (name: string) => dispatch(setUser(name)),
    doAddMonitor: (name: string) => dispatch(addMonitor(name)),
    dispatch,
  })
)(UI);
