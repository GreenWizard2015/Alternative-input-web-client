/**
 * Sample.ts - Shared Sample class and utilities
 *
 * Moved from: src/components/SamplesDef.tsx
 *
 * Contains the Sample class definition, position type, and serialization size utilities
 * that are used across both component and worker contexts.
 */

export type Position = {
  x: number;
  y: number;
};

export interface UUIDed {
  name: string;
  uuid: string;
  samples: number;
}

/**
 * Helper to find UUIDed item by id in an array
 * Usage:
 *   byId(users, userId)           // Get item by UUID
 *   byId(users, userId)?.name     // Get name by UUID
 */
export function byId(items: UUIDed[], id: string): UUIDed | undefined {
  return items.find(item => item.uuid === id);
}

/**
 * Sample - Represents a single facial detection sample
 *
 * Contains facial landmark detection data, eye crops, and gaze goal position.
 * All samples in a serialized batch must have the same userId, placeId, screenId, cameraId, and monitorId.
 *
 * Validates goal position in constructor if provided.
 * Goal must be in range [-2, 2] (inclusive) for both x and y coordinates, or null for invalid detections.
 */
export class Sample {
  // time: uint64 milliseconds since Unix epoch (Date.now())
  // Range: 0 to 18,446,744,073,709,551,615 ms (supports timestamps beyond year 584,942,417)
  // Serialized as 8-byte unsigned integer (DataView.setBigUint64)
  time: number;
  leftEye: Uint8ClampedArray | null;
  rightEye: Uint8ClampedArray | null;
  // points: 478 face landmarks, each with x,y coordinates (Float32)
  points: Float32Array;
  // goal: normalized screen position where user should look (null for invalid detections)
  goal: Position | null;
  userId: string;
  placeId: string;
  screenId: string;
  // cameraId: identifier for the camera that captured this sample
  cameraId: string;
  // monitorId: identifier for the monitor selected during this sample (for tracking/correlation, not stats)
  monitorId: string;

  private static readonly GOAL_MIN = -2;
  private static readonly GOAL_MAX = 2;

  constructor(data: {
    time: number;
    leftEye: Uint8ClampedArray | null;
    rightEye: Uint8ClampedArray | null;
    points: Float32Array;
    goal: Position | null;
    userId: string;
    placeId: string;
    screenId: string;
    cameraId: string;
    monitorId: string;
  }) {
    // Validate goal position if provided (inclusive bounds)
    if (data.goal) {
      if (!(Sample.GOAL_MIN <= data.goal.x && data.goal.x <= Sample.GOAL_MAX)) {
        throw new Error(`Invalid goal.x: ${data.goal.x} (must be in range [${Sample.GOAL_MIN}, ${Sample.GOAL_MAX}])`);
      }
      if (!(Sample.GOAL_MIN <= data.goal.y && data.goal.y <= Sample.GOAL_MAX)) {
        throw new Error(`Invalid goal.y: ${data.goal.y} (must be in range [${Sample.GOAL_MIN}, ${Sample.GOAL_MAX}])`);
      }
    }

    this.time = data.time;
    this.leftEye = data.leftEye;
    this.rightEye = data.rightEye;
    this.points = data.points;
    this.goal = data.goal;
    this.userId = data.userId;
    this.placeId = data.placeId;
    this.screenId = data.screenId;
    this.cameraId = data.cameraId;
    this.monitorId = data.monitorId;
  }

  /**
   * Returns a pipe-joined string of all sample identifiers.
   * Format: "userId|placeId|screenId|cameraId|monitorId"
   */
  bucket(): string {
    return [this.userId, this.placeId, this.screenId, this.cameraId, this.monitorId].join('|');
  }
}

/** Size of eye crop (48x48 pixels grayscale) */
export const EYE_SIZE = 48;

/**
 * Calculates the size in bytes of a single serialized sample.
 *
 * Layout:
 * - time: 8 bytes (uint64 milliseconds since Unix epoch, Date.now())
 * - leftEye: 2,304 bytes (48x48 = 2,304 uint8 pixels)
 * - rightEye: 2,304 bytes (48x48 = 2,304 uint8 pixels)
 * - points: 3,824 bytes (478 landmarks × 2 coords × 4 bytes float32)
 * - goal.x: 4 bytes (float32, normalized -1.0 to 1.0)
 * - goal.y: 4 bytes (float32, normalized -1.0 to 1.0)
 *
 * Note: userId, placeId, screenId, cameraId, and monitorId are not included here.
 * They are common to all samples in a chunk and are written only once in the header.
 */
export function sampleSize(): number {
  return (
    8 // time: uint64 milliseconds since Unix epoch
    + EYE_SIZE * EYE_SIZE * 1 // leftEye: 48x48 grayscale pixels (uint8)
    + EYE_SIZE * EYE_SIZE * 1 // rightEye: 48x48 grayscale pixels (uint8)
    + 4 * 2 * 478 // points: 478 face landmarks, x,y coordinates (float32 each)
    + 4 // goal.x: target position x (float32, normalized)
    + 4 // goal.y: target position y (float32, normalized)
  );
}
