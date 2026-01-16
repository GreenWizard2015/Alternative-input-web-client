/**
 * Serialization.ts - Binary sample serialization for upload
 *
 * Moved from: src/components/SerializeSamples.tsx
 *
 * Handles conversion of Sample objects to ArrayBuffer format for efficient upload.
 * This function is designed to run in worker context for CPU parallelization.
 */

import { Sample, EYE_SIZE, sampleSize } from './Sample';

/**
 * Helper function to collect unique values from array by key
 * Used to validate that all samples in a batch have the same userId, placeId, etc.
 */
function accumulateUnique(key: keyof Sample) {
  return (array: unknown[], value: Sample) => {
    const val = value[key];
    if (!array.includes(val)) {
      array.push(val);
    }
    return array;
  };
}

/**
 * Serialize samples to ArrayBuffer for upload
 *
 * Format (binary):
 * - Version: 1 byte (uint8)
 * - Header (common to all samples):
 *   - userId: 36 bytes (UTF-8 encoded string)
 *   - placeId: 36 bytes (UTF-8 encoded string)
 *   - screenId: 36 bytes (UTF-8 encoded string)
 *   - cameraId: 36 bytes (UTF-8 encoded string)
 *   - monitorId: 36 bytes (UTF-8 encoded string)
 * - Per-sample data (repeated for each sample):
 *   - time: 8 bytes (uint64 BigInt milliseconds)
 *   - leftEye: 2,304 bytes (48x48 uint8 grayscale)
 *   - rightEye: 2,304 bytes (48x48 uint8 grayscale)
 *   - points: 3,824 bytes (478 landmarks × 2 × float32)
 *   - goal.x: 4 bytes (float32)
 *   - goal.y: 4 bytes (float32)
 *
 * Total size = 1 + 180 + (samples.length * sampleSize())
 *
 * @throws Error if samples have inconsistent userId, placeId, screenId, cameraId, or monitorId
 * @throws Error if sample data doesn't match expected format (eye size, landmarks, etc.)
 */
export function serialize(samples: Sample[]): ArrayBuffer {
  // Validate all samples have same IDs (required for header)
  const userIDs = samples.reduce(accumulateUnique('userId'), []);
  if (1 !== userIDs.length) {
    throw new Error('Expected one user ID, got ' + userIDs.length);
  }

  const placeIDs = samples.reduce(accumulateUnique('placeId'), []);
  if (1 !== placeIDs.length) {
    throw new Error('Expected one place ID, got ' + placeIDs.length);
  }

  const screenIDs = samples.reduce(accumulateUnique('screenId'), []);
  if (1 !== screenIDs.length) {
    throw new Error('Expected one screen ID, got ' + screenIDs.length);
  }

  const cameraIDs = samples.reduce(accumulateUnique('cameraId'), []);
  if (1 !== cameraIDs.length) {
    throw new Error('Expected one camera ID, got ' + cameraIDs.length);
  }

  const monitorIDs = samples.reduce(accumulateUnique('monitorId'), []);
  if (1 !== monitorIDs.length) {
    throw new Error('Expected one monitor ID, got ' + monitorIDs.length);
  }

  // Allocate buffer: version (1) + header IDs (180: 5×36) + all samples
  const headerSize = 36 + 36 + 36 + 36 + 36 + 1;
  const totalSize = samples.length * sampleSize() + headerSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  let offset = 0;

  // Write format version
  const version = 4;
  view.setUint8(offset, version);
  offset += 1;

  // Helper to write fixed-size UTF-8 string (36 bytes)
  const encoder = new TextEncoder();
  const saveString = (str: string, name: string) => {
    const encoded = encoder.encode(str);
    if (36 !== encoded.length) {
      throw new Error(`Invalid ${name} size. Expected 36, got ${encoded.length}`);
    }
    for (let i = 0; i < 36; i++) {
      view.setUint8(offset, encoded[i]);
      offset += 1;
    }
  };

  // Write header: userId, placeId, screenId, cameraId, monitorId (all from first sample)
  const sample = samples[0];
  saveString(sample.userId, 'userID');
  saveString(sample.placeId, 'placeID');
  saveString(sample.screenId, 'screenID');
  saveString(sample.cameraId, 'cameraID');
  saveString(sample.monitorId, 'monitorID');

  // Create empty eye for null cases
  const EMPTY_EYE = new Uint8ClampedArray(EYE_SIZE * EYE_SIZE).fill(0);

  // Helper to write eye crop (48x48 = 2,304 bytes)
  const saveEye = (eye: Uint8ClampedArray | null) => {
    const eyeData = eye ?? EMPTY_EYE;
    if (eyeData.length !== EYE_SIZE * EYE_SIZE) {
      throw new Error(`Invalid eye size. Expected ${EYE_SIZE}x${EYE_SIZE}, got ${eyeData.length}`);
    }
    for (let i = 0; i < EYE_SIZE * EYE_SIZE; i++) {
      view.setUint8(offset, eyeData[i]);
      offset += 1;
    }
  };

  // Write per-sample data
  samples.forEach(s => {
    // Store timestamp as uint64 (8 bytes) using BigInt
    // This supports full range of Date.now() values without overflow
    const timestamp = BigInt(s.time);
    view.setBigUint64(offset, timestamp);
    offset += 8;

    saveEye(s.leftEye);
    saveEye(s.rightEye);

    // Points: 478 face landmarks × 2 coordinates × 4 bytes float32 = 3,824 bytes
    if (s.points.length !== 2 * 478) {
      throw new Error('Invalid points size. Expected 2x478, got ' + s.points.length);
    }
    s.points.forEach(value => {
      view.setFloat32(offset, value);
      offset += 4;
    });

    // Goal position (normalized, -1.0 to 1.0)
    // Use default (0, 0) if goal is null
    const goalX = s.goal?.x ?? 0.0;
    const goalY = s.goal?.y ?? 0.0;
    view.setFloat32(offset, goalX);
    offset += 4;
    view.setFloat32(offset, goalY);
    offset += 4;
  });

  return buffer;
}
