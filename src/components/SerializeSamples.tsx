import { EYE_SIZE, Sample, sampleSize } from "./SamplesDef";

function accumulateUnique(key) {
  return (array, value) => {
    value = value[key];
    if (!array.includes(value)) {
      array.push(value);
    }
    return array;
  };
}

export function serialize(samples: Sample[]) {
  const userIDs = samples.reduce(accumulateUnique('userId'), []);
  if(1 !== userIDs.length) {
    throw new Error('Expected one user ID, got ' + userIDs.length);
  }
  const placeIDs = samples.reduce(accumulateUnique('placeId'), []);
  if(1 !== placeIDs.length) {
    throw new Error('Expected one place ID, got ' + placeIDs.length);
  }
  const screenIDs = samples.reduce(accumulateUnique('screenId'), []);
  if(1 !== screenIDs.length) {
    throw new Error('Expected one screen ID, got ' + screenIDs.length);
  }
  const headerSize = 36 + 36 + 36 + 1;
  const totalSize = samples.length * sampleSize() + headerSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  let offset = 0;
  // write the version of the format
  const version = 3;
  view.setUint8(offset, version);
  offset += 1;
  // encode the strings to utf-8
  const encoder = new TextEncoder();
  const saveString = (str, name) => {
    const encoded = encoder.encode(str);
    if (36 !== encoded.length) {
      throw new Error(`Invalid ${name} size. Expected 36, got ${encoded.length}`);
    }
    for (let i = 0; i < 36; i++) {
      view.setUint8(offset, encoded.at(i));
      offset += 1;
    }
  };
  
  // first write the user ID, place ID and screen ID, which are common to all samples
  const sample = samples[0];
  saveString(sample.userId, 'userID');
  saveString(sample.placeId, 'placeID');
  saveString(sample.screenId, 'screenID');
  const EMPTY_EYE = new Uint8ClampedArray(EYE_SIZE * EYE_SIZE).fill(0);

  const saveEye = (eye) => {
    if (eye.length !== EYE_SIZE * EYE_SIZE) {
      throw new Error(`Invalid eye size. Expected ${EYE_SIZE}x${EYE_SIZE}, got ${eye.length}`);
    }
    for (let i = 0; i < EYE_SIZE * EYE_SIZE; i++) {
      const value = eye[i];
      view.setUint8(offset, value);
      offset += 1;
    }
  };
  // then write the samples
  samples.forEach((sample) => {
    // Store timestamp as uint64 (8 bytes) using BigInt
    // This supports full range of Date.now() values without overflow
    const timestamp = BigInt(sample.time);
    view.setBigUint64(offset, timestamp);
    offset += 8;

    saveEye(sample.leftEye ?? EMPTY_EYE);
    saveEye(sample.rightEye ?? EMPTY_EYE);

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
  });

  return buffer;
};