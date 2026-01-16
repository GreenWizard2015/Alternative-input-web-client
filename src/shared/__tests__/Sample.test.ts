/**
 * Sample.test.ts - Unit tests for Sample class and utilities
 */

import { Sample, sampleSize, EYE_SIZE } from '../Sample';
import type { Position } from '../Sample';

type SampleConstructorData = ConstructorParameters<typeof Sample>[0];

describe('Sample Class', () => {
  let sampleData: SampleConstructorData;

  beforeEach(() => {
    sampleData = {
      time: 1000,
      leftEye: new Uint8ClampedArray(EYE_SIZE * EYE_SIZE).fill(128),
      rightEye: new Uint8ClampedArray(EYE_SIZE * EYE_SIZE).fill(100),
      points: new Float32Array(478 * 2).fill(0.5),
      goal: { x: 0.1, y: 0.2 } as Position,
      userId: 'user123',
      placeId: 'place456',
      screenId: 'screen789',
      cameraId: 'camera000',
      monitorId: 'monitor111',
    };
  });

  test('creates sample with valid data', () => {
    const sample = new Sample(sampleData);
    expect(sample.time).toBe(1000);
    expect(sample.userId).toBe('user123');
    expect(sample.cameraId).toBe('camera000');
  });

  test('bucket() returns pipe-separated identifiers', () => {
    const sample = new Sample(sampleData);
    const bucket = sample.bucket();
    expect(bucket).toBe('user123|place456|screen789|camera000|monitor111');
  });

  test('bucket() format matches expected pattern', () => {
    const sample = new Sample(sampleData);
    const parts = sample.bucket().split('|');
    expect(parts.length).toBe(5);
    expect(parts[0]).toBe('user123');
    expect(parts[4]).toBe('monitor111');
  });

  test('handles null eye data', () => {
    sampleData.leftEye = null;
    sampleData.rightEye = null;
    const sample = new Sample(sampleData);
    expect(sample.leftEye).toBeNull();
    expect(sample.rightEye).toBeNull();
  });

  test('preserves all data fields', () => {
    const sample = new Sample(sampleData);
    expect(sample.time).toBe(sampleData.time);
    expect(sample.goal).toBe(sampleData.goal);
    expect(sample.points).toBe(sampleData.points);
    expect(sample.userId).toBe(sampleData.userId);
  });
});

describe('sampleSize() utility', () => {
  test('returns correct size in bytes', () => {
    const size = sampleSize();
    // 8 (time) + 2304*2 (eyes) + 3824 (points) + 8 (goal)
    const expected = 8 + EYE_SIZE * EYE_SIZE * 2 + 4 * 2 * 478 + 8;
    expect(size).toBe(expected);
  });

  test('returns consistent size across calls', () => {
    const size1 = sampleSize();
    const size2 = sampleSize();
    expect(size1).toBe(size2);
  });

  test('is at least 8440 bytes (known size)', () => {
    const size = sampleSize();
    expect(size).toBeGreaterThanOrEqual(8440);
  });
});

describe('EYE_SIZE constant', () => {
  test('is set to 48', () => {
    expect(EYE_SIZE).toBe(48);
  });

  test('eye data should be EYE_SIZE * EYE_SIZE bytes', () => {
    const expectedEyeSize = EYE_SIZE * EYE_SIZE;
    expect(expectedEyeSize).toBe(2304);
  });
});
