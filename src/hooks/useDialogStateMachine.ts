import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import {
  openUserDialog as openUserDialogAction,
  openPlaceDialog as openPlaceDialogAction,
  openMonitorDialog as openMonitorDialogAction,
  openStartDialog as openStartDialogAction,
  closeDialog as closeDialogAction,
  setTempName as setTempNameAction,
  setTempCameraId as setTempCameraIdAction,
} from '../store/slices/App';

export function useDialogStateMachine() {
  const dispatch = useDispatch();
  const dialogType = useSelector((state: RootState) => state.App.dialogType);
  const tempName = useSelector((state: RootState) => state.App.tempName);
  const tempCameraId = useSelector((state: RootState) => state.App.tempCameraId);

  // Type guards for current state
  const isIdle = dialogType === 'IDLE';
  const isUserDialog = dialogType === 'USER_DIALOG';
  const isPlaceDialog = dialogType === 'PLACE_DIALOG';
  const isMonitorDialog = dialogType === 'MONITOR_DIALOG';
  const isStartDialog = dialogType === 'START_DIALOG';

  return {
    // Dispatchers
    openUserDialog: () => dispatch(openUserDialogAction()),
    openPlaceDialog: (cameraId?: string) => dispatch(openPlaceDialogAction(cameraId)),
    openMonitorDialog: () => dispatch(openMonitorDialogAction()),
    openStartDialog: () => dispatch(openStartDialogAction()),
    closeDialog: () => dispatch(closeDialogAction()),
    setTempName: (name: string) => dispatch(setTempNameAction(name)),
    setTempCameraId: (cameraId: string) => dispatch(setTempCameraIdAction(cameraId)),
    // State guards
    isIdle,
    isUserDialog,
    isPlaceDialog,
    isMonitorDialog,
    isStartDialog,
    // Raw values
    tempName,
    tempCameraId,
  };
}
