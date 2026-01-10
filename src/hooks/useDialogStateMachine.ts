import { useSelector, useDispatch } from 'react-redux';
import { useState, useCallback } from 'react';
import type { RootState } from '../store';
import type { AppMode } from '../modes/AppMode';
import {
  openUserDialog as openUserDialogAction,
  openPlaceDialog as openPlaceDialogAction,
  openMonitorDialog as openMonitorDialogAction,
  openStartDialog as openStartDialogAction,
  openGameConfirmDialog as openGameConfirmDialogAction,
  closeDialog as closeDialogAction,
  setTempName as setTempNameAction,
  setTempCameraId as setTempCameraIdAction,
} from '../store/slices/App';

export function useDialogStateMachine() {
  const dispatch = useDispatch();
  const [pendingGameMode, setPendingGameMode] = useState<AppMode | null>(null);
  const [onGameStartConfirm, setOnGameStartConfirm] = useState<((mode: AppMode) => void) | null>(null);

  const dialogType = useSelector((state: RootState) => state.App.dialogType);
  const tempName = useSelector((state: RootState) => state.App.tempName);
  const tempCameraId = useSelector((state: RootState) => state.App.tempCameraId);

  // Type guards for current state
  const isIdle = dialogType === 'IDLE';
  const isUserDialog = dialogType === 'USER_DIALOG';
  const isPlaceDialog = dialogType === 'PLACE_DIALOG';
  const isMonitorDialog = dialogType === 'MONITOR_DIALOG';
  const isStartDialog = dialogType === 'START_DIALOG';
  const isGameConfirmDialog = dialogType === 'GAME_CONFIRM_DIALOG';

  const openGameConfirmDialog = useCallback((gameMode: AppMode, onConfirm: (mode: AppMode) => void) => {
    // Store gameMode and callback separately to avoid immediate closure execution
    setPendingGameMode(gameMode);
    setOnGameStartConfirm(() => onConfirm);
    dispatch(openGameConfirmDialogAction());
  }, [dispatch]);

  const closeDialog = useCallback(() => {
    dispatch(closeDialogAction());
    setPendingGameMode(null);
    setOnGameStartConfirm(null);
  }, [dispatch]);

  return {
    // Dispatchers
    openUserDialog: () => dispatch(openUserDialogAction()),
    openPlaceDialog: (cameraId?: string) => dispatch(openPlaceDialogAction(cameraId)),
    openMonitorDialog: () => dispatch(openMonitorDialogAction()),
    openStartDialog: () => dispatch(openStartDialogAction()),
    openGameConfirmDialog,
    closeDialog,
    setTempName: (name: string) => dispatch(setTempNameAction(name)),
    setTempCameraId: (cameraId: string) => dispatch(setTempCameraIdAction(cameraId)),
    // State guards
    isIdle,
    isUserDialog,
    isPlaceDialog,
    isMonitorDialog,
    isStartDialog,
    isGameConfirmDialog,
    // Raw values
    tempName,
    tempCameraId,
    pendingGameMode,
    onGameStartConfirm,
  };
}
