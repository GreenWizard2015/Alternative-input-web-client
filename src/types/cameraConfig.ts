/**
 * Per-camera configuration mapping
 * Each camera can have its own associated place
 */

export type CameraId = string; // Normalized camera ID (hash)
export type CameraConfig = {
  placeId?: string;
  isSelected?: boolean;
};

export type CameraConfigMap = Record<CameraId, CameraConfig>;

/**
 * Get the place ID for a specific camera
 */
export function getCameraPlaceId(
  cameraId: CameraId,
  cameraConfigMap: CameraConfigMap,
  fallbackPlaceId: string
): string {
  return cameraConfigMap[cameraId]?.placeId || fallbackPlaceId;
}

/**
 * Set place for a camera
 */
export function setCameraPlace(
  cameraId: CameraId,
  placeId: string,
  cameraConfigMap: CameraConfigMap
): CameraConfigMap {
  return {
    ...cameraConfigMap,
    [cameraId]: {
      ...cameraConfigMap[cameraId],
      placeId,
    },
  };
}

/**
 * Remove camera configuration
 */
export function removeCameraConfig(
  cameraId: CameraId,
  cameraConfigMap: CameraConfigMap
): CameraConfigMap {
  const newMap = { ...cameraConfigMap };
  delete newMap[cameraId];
  return newMap;
}

/**
 * Get all place IDs used across cameras
 */
export function getUsedPlaceIds(cameraConfigMap: CameraConfigMap): Set<string> {
  const placeIds = new Set<string>();
  Object.values(cameraConfigMap).forEach(config => {
    if (config.placeId) placeIds.add(config.placeId);
  });
  return placeIds;
}

