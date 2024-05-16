import { Sample, sampleSize } from "./SamplesDef";

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
  const headerSize = 36 + 36 + 36 + 1
  const totalSize = samples.length * sampleSize() + headerSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  let offset = 0;
  // write the version of the format
  const version = 1;
  view.setUint8(offset, version);
  offset += 1;
  // first write the user ID, place ID and screen ID, which are common to all samples
  const sample = samples[0];
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
  // then write the samples
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
  });

  return buffer;
};