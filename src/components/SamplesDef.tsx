type UUIDed = {
  name: string,
  uuid: string,
  samples: number,
};

type Position = {
  x: number,
  y: number
};

class Sample {
  // time: uint64 milliseconds since Unix epoch (Date.now())
  // Range: 0 to 18,446,744,073,709,551,615 ms (supports timestamps beyond year 584,942,417)
  // Serialized as 8-byte unsigned integer (DataView.setBigUint64)
  time: number;
  leftEye: Uint8ClampedArray | null;
  rightEye: Uint8ClampedArray | null;
  // points: 478 face landmarks, each with x,y coordinates (Float32)
  points: Float32Array;
  // goal: normalized screen position where user should look
  goal: Position;
  userId: string;
  placeId: string;
  screenId: string;
  // cameraId: identifier for the camera that captured this sample
  cameraId: string;

  constructor(data: {
    time: number;
    leftEye: Uint8ClampedArray | null;
    rightEye: Uint8ClampedArray | null;
    points: Float32Array;
    goal: Position;
    userId: string;
    placeId: string;
    screenId: string;
    cameraId: string;
  }) {
    this.time = data.time;
    this.leftEye = data.leftEye;
    this.rightEye = data.rightEye;
    this.points = data.points;
    this.goal = data.goal;
    this.userId = data.userId;
    this.placeId = data.placeId;
    this.screenId = data.screenId;
    this.cameraId = data.cameraId;
  }

  /**
   * Returns a pipe-joined string of all sample identifiers.
   * Format: "userId|placeId|screenId|cameraId"
   */
  bucket(): string {
    return [this.userId, this.placeId, this.screenId, this.cameraId].join('|');
  }
}

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
 * Note: userId, placeId, screenId, and cameraId are not included here.
 * They are common to all samples in a chunk and are written only once in the header.
 */
export function sampleSize() {
  return 8 // time: uint64 milliseconds since Unix epoch
    + EYE_SIZE * EYE_SIZE * 1 // leftEye: 48x48 grayscale pixels (uint8)
    + EYE_SIZE * EYE_SIZE * 1 // rightEye: 48x48 grayscale pixels (uint8)
    + 4 * 2 * 478 // points: 478 face landmarks, x,y coordinates (float32 each)
    + 4 // goal.x: target position x (float32, normalized)
    + 4; // goal.y: target position y (float32, normalized)
}

export type { UUIDed, Position };
export { Sample };