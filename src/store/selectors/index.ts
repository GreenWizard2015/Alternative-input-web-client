import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../index';
import type { CameraEntity } from '../../types/camera';
import { fromJSON, toJSON } from '../json';
import type { UUIDed } from '../../shared/Sample';
import { byId } from '../../shared/Sample';
import type { Goal } from '../../types/Goal';
import { DEFAULT_GOAL } from '../../types/Goal';

/**
 * Base selectors - extract raw state values (no memoization needed)
 */
export const selectMode = (state: RootState): string => state.App.mode;

export const selectUserId = (state: RootState): string => state.UI.userId;

export const selectMonitorId = (state: RootState): string => state.UI.monitorId || '';

export const selectActiveUploads = (state: RootState): number => state.App.activeUploads;

export const selectMeanUploadDuration = (state: RootState): number => state.App.meanUploadDuration;

// All cameras - parse from JSON string
export const selectCameras = createSelector(
  (state: RootState) => state.App.cameras,
  (camerasJson: string) => fromJSON<Record<string, CameraEntity>>(camerasJson, {})
);

// Selected cameras - memoized to prevent unnecessary re-renders
export const selectSelectedCameras = createSelector(selectCameras, cameras =>
  Object.values(cameras).filter((cam: CameraEntity) => cam.isSelected)
);

// Sorted device IDs from selected cameras - for stable array references
export const selectSortedDeviceIds = createSelector(
  (state: RootState) => {
    const cameras = selectSelectedCameras(state);
    const ids = cameras.map(cam => cam.deviceId).sort();
    return toJSON(ids);
  },
  ids => fromJSON<string[]>(ids, [])
);

/**
 * JSON Selectors - Deserialize lists/maps on demand
 */

// Users list stored as JSON string, parsed only when accessed
export const selectUsersList = createSelector(
  (state: RootState) => state.UI.users,
  (json: string) => fromJSON<UUIDed[]>(json, [])
);

// Users with byId helper stored as JSON string, parsed only when accessed
export const selectUsers = createSelector(selectUsersList, users => {
  return Object.assign([], users, { byId: (id: string) => byId(users, id) });
});

// Places with byId helper stored as JSON string, parsed only when accessed
export const selectPlaces = createSelector(
  (state: RootState) => state.UI.places,
  (json: string) => {
    const places = fromJSON<UUIDed[]>(json, []);
    return Object.assign([], places, { byId: (id: string) => byId(places, id) });
  }
);

// Monitors list stored as JSON string, parsed only when accessed
export const selectMonitorsList = createSelector(
  (state: RootState) => state.UI.monitors,
  (json: string) => fromJSON<UUIDed[]>(json, [])
);

// Monitors with byId helper stored as JSON string, parsed only when accessed
export const selectMonitors = createSelector(selectMonitorsList, monitors => {
  return Object.assign([], monitors, { byId: (id: string) => byId(monitors, id) });
});

// Goal settings stored as JSON string, parsed only when accessed
export const selectGoalSettings = createSelector(
  (state: RootState) => state.UI.goalSettings,
  (json: string) => fromJSON<Goal>(json, DEFAULT_GOAL)
);

/**
 * Composite selector - returns multiple values as object
 * Memoized to prevent unnecessary re-renders
 */
export const selectAppProps = createSelector(
  selectMode,
  selectUserId,
  selectMonitorId,
  selectActiveUploads,
  selectMeanUploadDuration,
  selectSelectedCameras,
  selectUsers,
  (mode, userId, monitorId, activeUploads, meanUploadDuration, selectedCameras, users) => ({
    mode,
    userId,
    monitorId,
    activeUploads,
    meanUploadDuration,
    selectedCameras,
    users,
    currentUser: users.byId(userId), // Get current user by id
  })
);

// Camera manager props selector
export const selectCameraManagerProps = createSelector(
  selectCameras,
  selectPlaces,
  (cameras, places) => ({
    cameras,
    places,
  })
);

// Transform examples - parse once, transform on demand
export const selectUserNames = createSelector(
  (state: RootState) => state.UI.users,
  (json: string) => {
    const users = fromJSON<UUIDed[]>(json, []);
    return users.map(u => u.name);
  }
);
