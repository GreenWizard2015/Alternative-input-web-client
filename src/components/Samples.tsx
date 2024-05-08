import { worker } from './DataWorker';

type UUIDed = {
  name: string,
  uuid: string
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
  screenId: number
};

function sampleSize() {
  return 4 // time
    + 32 * 32 * 1 // sample.leftEye is 32x32 pixels
    + 32 * 32 * 1 // sample.rightEye is 32x32 pixels
    + 4 * 2 * 468 // sample.points is 468 points
    + 4 // goal.x
    + 4 // goal.y
    + 36 // userId
    + 36 // placeId
    + 4; // screenId
}

export function serialize(samples: Sample[]) {
  const totalSize = samples.length * sampleSize();
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  let offset = 0;
  samples.forEach((sample, index) => {
    view.setInt32(offset, sample.time);
    offset += 4;
    if (sample.leftEye.length !== 32 * 32) {
      throw new Error('Invalid leftEye size. Expected 32x32, got ' + sample.leftEye.length);
    }
    sample.leftEye.forEach(value => {
      view.setUint8(offset, value);
      offset += 1;
    });

    if (sample.rightEye.length !== 32 * 32) {
      throw new Error('Invalid rightEye size. Expected 32x32, got ' + sample.rightEye.length);
    }
    sample.rightEye.forEach(value => {
      view.setUint8(offset, value);
      offset += 1;
    });

    if (sample.points.length !== 2 * 468) {
      throw new Error('Invalid points size. Expected 2x468, got ' + sample.points.length);
    }
    sample.points.forEach(value => {
      view.setFloat32(offset, value);
      offset += 4;
    });
    view.setFloat32(offset, sample.goal.x);
    offset += 4;
    view.setFloat32(offset, sample.goal.y);
    offset += 4;
    for (let i = 0; i < 36; i++) {
      view.setUint8(offset, sample.userId.charCodeAt(i));
      offset += 1;
    }
    for (let i = 0; i < 36; i++) {
      view.setUint8(offset, sample.placeId.charCodeAt(i));
      offset += 1;
    }
    view.setInt32(offset, sample.screenId);
    offset += 4;
  });

  return buffer;
};

const MAX_SAMPLES: number = 111;// parseInt(process.env.REACT_APP_SAMPLES_PER_CHUNK || '1000');
let samples: Sample[] = [];

function sendSamples({ limit = -1 } = {}) {
  let oldSamples = samples;
  samples = [];
  // Async request
  const saveEndpoint = '/api/upload';
  if (-1 < limit) {
    oldSamples = oldSamples.filter(sample => sample.time < limit)
  }
  const serializedSamples = serialize(oldSamples);
  console.log('Sending', serializedSamples.byteLength, 'bytes');
  
  worker.postMessage({ 
    samples: serializedSamples,
    endpoint: saveEndpoint 
  });
}

function storeSample(sample: Sample) {
  samples.push(sample)
  if (samples.length >= MAX_SAMPLES) {
    sendSamples()
  }
}

export { storeSample, sendSamples };
export function validate(obj: UUIDed | null) {
  if (obj == null) {
    return false;
  }
  return obj.name.length > 0 && obj.uuid.length > 0;
}
export type { UUIDed, Position, Sample };