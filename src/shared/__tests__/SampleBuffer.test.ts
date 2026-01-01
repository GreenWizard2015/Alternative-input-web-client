/**
 * SampleBuffer.test.ts - Unit tests for buffering classes
 */

import { SampleBuffer, CameraSampleBucket } from '../SampleBuffer';
import { Sample } from '../Sample';

describe('CameraSampleBucket', () => {
  let bucket: CameraSampleBucket;
  let samples: Sample[];

  beforeEach(() => {
    bucket = new CameraSampleBucket();
    samples = Array.from({ length: 5 }, (_, i) =>
      new Sample({
        time: 1000 + i * 100,
        leftEye: new Uint8ClampedArray(2304).fill(128),
        rightEye: new Uint8ClampedArray(2304).fill(100),
        points: new Float32Array(956).fill(0.5),
        goal: { x: 0, y: 0 },
        userId: 'user1',
        placeId: 'place1',
        screenId: 'screen1',
        cameraId: 'cam1',
      })
    );
  });

  test('adds samples to bucket', () => {
    samples.forEach(s => bucket.add(s));
    expect(bucket.getCount()).toBe(5);
  });

  test('clears all samples', () => {
    samples.forEach(s => bucket.add(s));
    bucket.clear();
    expect(bucket.getCount()).toBe(0);
  });

  describe('extractByTimestamp()', () => {
    test('extracts samples within time range', () => {
      samples.forEach(s => bucket.add(s));
      // Extract samples with time >= 1100 and < 1300
      const { sent, remaining } = bucket.extractByTimestamp(1100, 1300, 10);
      expect(sent.length).toBe(2); // 1100, 1200
      expect(remaining.length).toBe(3); // 1000, 1300, 1400
    });

    test('respects maxSize parameter', () => {
      samples.forEach(s => bucket.add(s));
      const { sent, remaining } = bucket.extractByTimestamp(1000, 2000, 2);
      expect(sent.length).toBe(2);
      expect(remaining.length).toBe(3);
    });

    test('sorts samples by time before extraction', () => {
      // Add in reverse order
      [...samples].reverse().forEach(s => bucket.add(s));
      const { sent } = bucket.extractByTimestamp(1000, 2000, 10);
      // Should be sorted by time
      for (let i = 1; i < sent.length; i++) {
        expect(sent[i].time).toBeGreaterThanOrEqual(sent[i - 1].time);
      }
    });

    test('updates bucket contents after extraction', () => {
      samples.forEach(s => bucket.add(s));
      bucket.extractByTimestamp(1100, 1300, 10);
      expect(bucket.getCount()).toBe(3);
    });
  });
});

describe('SampleBuffer', () => {
  let buffer: SampleBuffer;
  let samples: Sample[];

  beforeEach(() => {
    buffer = new SampleBuffer();
    samples = Array.from({ length: 10 }, (_, i) =>
      new Sample({
        time: 1000 + i * 50,
        leftEye: new Uint8ClampedArray(2304).fill(128),
        rightEye: new Uint8ClampedArray(2304).fill(100),
        points: new Float32Array(956).fill(0.5),
        goal: { x: 0, y: 0 },
        userId: `user${i % 2}`,
        placeId: `place${i % 3}`,
        screenId: 'screen1',
        cameraId: `cam${i % 2}`,
      })
    );
  });

  test('adds samples to appropriate buckets', () => {
    samples.forEach(s => buffer.addSample(s));
    expect(buffer.getTotalSampleCount()).toBe(10);
  });

  test('creates separate buckets for different keys', () => {
    samples.forEach(s => buffer.addSample(s));
    expect(buffer.getBucketCount()).toBeGreaterThan(1);
  });

  test('getBucket() retrieves bucket by key', () => {
    buffer.addSample(samples[0]);
    const key = samples[0].bucket();
    const bucket = buffer.getBucket(key);
    expect(bucket).toBeTruthy();
    expect(bucket?.getCount()).toBe(1);
  });

  test('getBucket() returns null for missing key', () => {
    const bucket = buffer.getBucket('nonexistent|key');
    expect(bucket).toBeNull();
  });

  test('getAllBuckets() returns all buckets', () => {
    samples.forEach(s => buffer.addSample(s));
    const buckets = buffer.getAllBuckets();
    expect(buckets.length).toBeGreaterThan(0);
  });

  test('clear() removes all samples', () => {
    samples.forEach(s => buffer.addSample(s));
    buffer.clear();
    expect(buffer.getTotalSampleCount()).toBe(0);
    expect(buffer.getBucketCount()).toBe(0);
  });

  describe('extractFromBucket()', () => {
    test('extracts and removes samples from bucket', () => {
      samples.slice(0, 5).forEach(s => buffer.addSample(s));
      const key = samples[0].bucket();
      const bucket = buffer.getBucket(key)!;

      const before = buffer.getTotalSampleCount();
      buffer.extractFromBucket(bucket, 1000, 1500, 10);
      const after = buffer.getTotalSampleCount();

      expect(after).toBeLessThan(before);
    });
  });

  test('addToCount() manually adjusts total', () => {
    buffer.addToCount(5);
    expect(buffer.getTotalSampleCount()).toBe(5);
    buffer.addToCount(-3);
    expect(buffer.getTotalSampleCount()).toBe(2);
  });
});
