/**
 * Unified Camera configuration
 * Each camera is a complete entity with its own place assignment
 */

export type CameraEntity = {
  deviceId: string; // MediaDeviceInfo.deviceId (unique hardware ID)
  label: string; // Camera name/label for UI
  isSelected: boolean; // Is this camera currently selected?
  placeId: string; // Which place is assigned to this camera
  placeName?: string; // Cache of place name for display
};

export type CameraConfig = {
  [deviceId: string]: CameraEntity;
};

/**
 * Add or update camera
 */
export function setCameraEntity(config: CameraConfig, camera: CameraEntity): CameraConfig {
  return {
    ...config,
    [camera.deviceId]: camera,
  };
}

/**
 * Set place for a camera
 */
export function setCameraPlace(
  config: CameraConfig,
  deviceId: string,
  placeId: string,
  placeName?: string
): CameraConfig {
  const camera = config[deviceId];
  if (!camera) return config;

  return {
    ...config,
    [deviceId]: {
      ...camera,
      placeId,
      placeName,
    },
  };
}

/**
 * Toggle camera selection
 */
export function toggleCamera(config: CameraConfig, deviceId: string): CameraConfig {
  const camera = config[deviceId];
  if (!camera) return config;

  return {
    ...config,
    [deviceId]: {
      ...camera,
      isSelected: !camera.isSelected,
    },
  };
}

/**
 * Remove camera
 */
export function removeCamera(config: CameraConfig, deviceId: string): CameraConfig {
  const newConfig = { ...config };
  delete newConfig[deviceId];
  return newConfig;
}

/**
 * Get place IDs for all selected cameras
 */
export function getSelectedCameraPlaces(config: CameraConfig): string[] {
  return Object.values(config)
    .filter(cam => cam.isSelected)
    .map(cam => cam.placeId)
    .filter(id => id); // Remove empty strings
}

/**
 * Get unique places used by selected cameras
 */
export function getUniquePlaces(config: CameraConfig): Set<string> {
  return new Set(getSelectedCameraPlaces(config));
}
