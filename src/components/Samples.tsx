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
  screenId: string,
};

function sampleSize() {
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

    if (sample.points.length !== 2 * 478) {
      throw new Error('Invalid points size. Expected 2x478, got ' + sample.points.length);
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
    
    if(36 !== sample.screenId.length) {
      throw new Error('Invalid screenId size. Expected 36, got ' + sample.screenId.length);
    }
    for (let i = 0; i < 36; i++) {
      view.setUint8(offset, sample.screenId.charCodeAt(i));
      offset += 1;
    }
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
  // sort by time
  oldSamples.sort((a, b) => a.time - b.time);
  
  if(0 < oldSamples.length) {
    if(MAX_SAMPLES < oldSamples.length) { // add to start of samples
      // Add elements to the start of samples
      samples = oldSamples.slice(MAX_SAMPLES).concat(samples);
      // Reduce oldSamples to the first MAX_SAMPLES elements
      oldSamples = oldSamples.slice(0, MAX_SAMPLES);
    }

    const count = oldSamples.length;
    if(count < 1) return;
    if(MAX_SAMPLES < count) {
      throw new Error('Too many samples to send: ' + count);
    }
    const userId = oldSamples[0].userId;
    const placeId = oldSamples[0].placeId;
    
    worker.postMessage({ 
      samples: oldSamples,
      endpoint: saveEndpoint,
      userId, placeId, count
    });
  }
}

function storeSample(sample: Sample, limit: number) {
  // goal should be within the range -2..2, just to be sure that its valid  
  const isValidGoal = (
    (-2 < sample.goal.x) && (sample.goal.x < 2) &&
    (-2 < sample.goal.y) && (sample.goal.y < 2)
  );
  if(!isValidGoal) {
    console.log('Invalid goal:', sample.goal);
    return;
  }
  samples.push(sample);
  if (samples.length >= 2 * MAX_SAMPLES) {
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