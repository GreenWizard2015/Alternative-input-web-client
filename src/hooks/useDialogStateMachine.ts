import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import {
  openUserDialog as openUserDialogAction,
  openPlaceDialog as openPlaceDialogAction,
  openStartDialog as openStartDialogAction,
  closeDialog as closeDialogAction,
  setTempName as setTempNameAction,
  setTempUUID as setTempUUIDAction,
  setTempCameraId as setTempCameraIdAction,
} from '../store/slices/App';

export function useDialogStateMachine() {
  const dispatch = useDispatch();
  const dialogType = useSelector((state: RootState) => state.App.dialogType);
  const tempName = useSelector((state: RootState) => state.App.tempName);
  const tempUUID = useSelector((state: RootState) => state.App.tempUUID);
  const tempCameraId = useSelector((state: RootState) => state.App.tempCameraId);

  // Type guards for current state
  const isIdle = dialogType === 'IDLE';
  const isUserDialog = dialogType === 'USER_DIALOG';
  const isPlaceDialog = dialogType === 'PLACE_DIALOG';
  const isStartDialog = dialogType === 'START_DIALOG';

  return {
    // Dispatchers
    openUserDialog: () => dispatch(openUserDialogAction()),
    openPlaceDialog: (cameraId?: string) => dispatch(openPlaceDialogAction(cameraId)),
    openStartDialog: () => dispatch(openStartDialogAction()),
    closeDialog: () => dispatch(closeDialogAction()),
    setTempName: (name: string) => dispatch(setTempNameAction(name)),
    setTempUUID: (uuid: string) => dispatch(setTempUUIDAction(uuid)),
    setTempCameraId: (cameraId: string) => dispatch(setTempCameraIdAction(cameraId)),
    // State guards
    isIdle,
    isUserDialog,
    isPlaceDialog,
    isStartDialog,
    // Raw values
    tempName,
    tempUUID,
    tempCameraId,
  };
}
