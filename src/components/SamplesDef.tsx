type UUIDed = {
  name: string,
  uuid: string,
  samples: number,
};

type Position = {
  x: number,
  y: number
};

type Sample = {
  time: number,
  leftEye: Uint8ClampedArray | null,
  rightEye: Uint8ClampedArray | null,
  points: Float32Array,
  goal: Position,
  userId: string,
  placeId: string,
  screenId: string,
};

export const EYE_SIZE = 48;
export function sampleSize() {
  return 4 // time
    + EYE_SIZE * EYE_SIZE * 1 // sample.leftEye is 32x32 pixels
    + EYE_SIZE * EYE_SIZE * 1 // sample.rightEye is 32x32 pixels
    + 4 * 2 * 478 // sample.points is 478 points
    + 4 // goal.x
    + 4; // goal.y
  // userId, placeId and screenId are not included in the size
  // as they are common to all samples and are written only once
}

export type { UUIDed, Position, Sample };