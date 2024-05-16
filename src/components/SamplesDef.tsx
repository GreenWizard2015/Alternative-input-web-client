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
  leftEye: Uint8ClampedArray,
  rightEye: Uint8ClampedArray,
  points: Float32Array,
  goal: Position,
  userId: string,
  placeId: string,
  screenId: string,
};

export function sampleSize() {
  return 4 // time
    + 32 * 32 * 1 // sample.leftEye is 32x32 pixels
    + 32 * 32 * 1 // sample.rightEye is 32x32 pixels
    + 4 * 2 * 478 // sample.points is 478 points
    + 4 // goal.x
    + 4 // goal.y
    + 36 // userId
    + 36 // placeId
    + 36; // screenId
}

export type { UUIDed, Position, Sample };