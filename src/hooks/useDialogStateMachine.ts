import { useSelector, useDispatch } from 'react-redux';
import { useState, useCallback, useEffect } from 'react';
import type { RootState } from '../store';
import type { AppMode } from '../modes/AppMode';
import {
  openUserDialog as openUserDialogAction,
  openPlaceDialog as openPlaceDialogAction,
  openMonitorDialog as openMonitorDialogAction,
  openStartDialog as openStartDialogAction,
  openGameConfirmDialog as openGameConfirmDialogAction,
  openGoalDialog as openGoalDialogAction,
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

  useEffect(() => {
    if (dialogType === 'IDLE') {
      setPendingGameMode(null);
      setOnGameStartConfirm(null);
    }
  }, [dialogType]);

  // Type guards for current state
  const isIdle = dialogType === 'IDLE';
  const isUserDialog = dialogType === 'USER_DIALOG';
  const isPlaceDialog = dialogType === 'PLACE_DIALOG';
  const isMonitorDialog = dialogType === 'MONITOR_DIALOG';
  const isStartDialog = dialogType === 'START_DIALOG';
  const isGameConfirmDialog = dialogType === 'GAME_CONFIRM_DIALOG';
  const isGoalDialog = dialogType === 'GOAL_DIALOG';

  const openGameConfirmDialog = useCallback((gameMode: AppMode, onConfirm: (mode: AppMode) => void) => {
    // Store gameMode and callback FIRST, then dispatch Redux action
    // This ensures React state is updated before Redux triggers re-renders
    setPendingGameMode(gameMode);
    setOnGameStartConfirm(() => onConfirm);
    // Use setTimeout to ensure state updates are processed before Redux dispatch
    setTimeout(() => {
      dispatch(openGameConfirmDialogAction());
    }, 0);
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
    openGoalDialog: () => dispatch(openGoalDialogAction()),
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
    isGoalDialog,
    // Raw values
    tempName,
    tempCameraId,
    pendingGameMode,
    onGameStartConfirm,
  };
}
