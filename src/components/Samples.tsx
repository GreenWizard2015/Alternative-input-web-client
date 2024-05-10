import { worker } from './DataWorker';

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
    view.setUint32(offset, sample.time);
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

    if(36 !== sample.userId.length) {
      throw new Error('Invalid userId size. Expected 36, got ' + sample.userId.length);
    }
    for (let i = 0; i < 36; i++) {
      view.setUint8(offset, sample.userId.charCodeAt(i));
      offset += 1;
    }

    if(36 !== sample.placeId.length) {
      throw new Error('Invalid placeId size. Expected 36, got ' + sample.placeId.length);
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

// max chunk size 4mb
const MAX_CHUNK_SIZE: number = 4 * 1024 * 1024;
const MAX_SAMPLES: number = Math.floor(MAX_CHUNK_SIZE / sampleSize());
let samples: Sample[] = [];

function sendSamples({ limit, clear=false }) {
  let oldSamples = samples;
  // Async request
  const saveEndpoint = '/api/upload';
  if (clear) {
    samples = [];
  } else {
    samples = oldSamples.filter(sample => sample.time >= limit);
  }
  oldSamples = oldSamples.filter(sample => sample.time < limit);
  
  if(0 < oldSamples.length) {
    if(MAX_SAMPLES < oldSamples.length) { // add to start of samples
      for(let i = MAX_SAMPLES; i < oldSamples.length; i++) {
        samples.unshift(oldSamples[i]);
      }
      oldSamples = oldSamples.slice(0, MAX_SAMPLES);
    }

    const count = oldSamples.length;
    if(count < 1) return;
    if(MAX_SAMPLES < count) {
      throw new Error('Too many samples to send: ' + count);
    }
    // check time is monotonicly increasing
    for(let i = 1; i < count; i++) {
      if(oldSamples[i-1].time >= oldSamples[i].time) {
        throw new Error('Time is not increasing');
      }
    }
    const serializedSamples = serialize(oldSamples);
    console.log('Sending', serializedSamples.byteLength, 'bytes');
    const userId = oldSamples[0].userId;
    const placeId = oldSamples[0].placeId;

    worker.postMessage({ 
      samples: serializedSamples,
      endpoint: saveEndpoint,
      userId, placeId, count
    });
  }
}

function storeSample(sample: Sample, limit: number) {
  // goal should be within the range -2..2, just to be sure that its valid  
  if(sample.goal.x < -2 || sample.goal.x > 2) return;
  if(sample.goal.y < -2 || sample.goal.y > 2) return;
  samples.push(sample);
  if (samples.length >= MAX_SAMPLES) {
    sendSamples({ limit, clear: false });
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