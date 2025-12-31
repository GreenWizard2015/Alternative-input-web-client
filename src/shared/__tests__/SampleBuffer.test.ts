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

  test('returns copy of samples', () => {
    bucket.add(samples[0]);
    const returned = bucket.getSamples();
    expect(returned).toEqual([samples[0]]);
    expect(returned).not.toBe(bucket.getSamples()); // Different array instance
  });

  test('clears all samples', () => {
    samples.forEach(s => bucket.add(s));
    bucket.clear();
    expect(bucket.getCount()).toBe(0);
  });

  test('isEmpty() works correctly', () => {
    expect(bucket.isEmpty()).toBe(true);
    bucket.add(samples[0]);
    expect(bucket.isEmpty()).toBe(false);
  });

  test('isFull() detects threshold', () => {
    samples.forEach(s => bucket.add(s));
    expect(bucket.isFull(3)).toBe(true);
    expect(bucket.isFull(5)).toBe(true);
    expect(bucket.isFull(6)).toBe(false);
  });

  describe('extractByTimestamp()', () => {
    test('extracts samples before time limit', () => {
      samples.forEach(s => bucket.add(s));
      const { sent, remaining } = bucket.extractByTimestamp(1250, 10);
      expect(sent.length).toBe(3); // 1000, 1100, 1200
      expect(remaining.length).toBe(2); // 1300, 1400
    });

    test('respects maxSize parameter', () => {
      samples.forEach(s => bucket.add(s));
      const { sent, remaining } = bucket.extractByTimestamp(2000, 2);
      expect(sent.length).toBe(2);
      expect(remaining.length).toBe(3);
    });

    test('sorts samples by time before extraction', () => {
      // Add in reverse order
      [...samples].reverse().forEach(s => bucket.add(s));
      const { sent } = bucket.extractByTimestamp(2000, 10);
      // Should be sorted by time
      for (let i = 1; i < sent.length; i++) {
        expect(sent[i].time).toBeGreaterThanOrEqual(sent[i - 1].time);
      }
    });

    test('updates bucket contents after extraction', () => {
      samples.forEach(s => bucket.add(s));
      bucket.extractByTimestamp(1250, 10);
      expect(bucket.getCount()).toBe(2);
    });
  });

  test('dropSamplesBeforeTime() removes old samples', () => {
    samples.forEach(s => bucket.add(s));
    const dropped = bucket.dropSamplesBeforeTime(1250);
    expect(dropped).toBe(3);
    expect(bucket.getCount()).toBe(2);
  });

  test('countSamplesInRange() counts correctly', () => {
    samples.forEach(s => bucket.add(s));
    const count = bucket.countSamplesInRange(1100, 1300);
    expect(count).toBe(2); // 1100, 1200
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

  test('dropSamplesBeforeTime() affects all buckets', () => {
    samples.forEach(s => buffer.addSample(s));
    const dropped = buffer.dropSamplesBeforeTime(1200);
    expect(dropped).toBeGreaterThan(0);
    expect(buffer.getTotalSampleCount()).toBeLessThan(10);
  });

  test('hasFullBuckets() detects full buckets', () => {
    // Create 5 samples with the same IDs to go into one bucket
    const sameBucketSamples = Array.from({ length: 5 }, (_, i) =>
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
    sameBucketSamples.forEach(s => buffer.addSample(s));
    expect(buffer.hasFullBuckets(3)).toBeTruthy();
    expect(buffer.hasFullBuckets(100)).toBeFalsy();
  });

  describe('extractFromBucket()', () => {
    test('extracts and removes samples from bucket', () => {
      samples.slice(0, 5).forEach(s => buffer.addSample(s));
      const key = samples[0].bucket();
      const bucket = buffer.getBucket(key)!;

      const before = buffer.getTotalSampleCount();
      buffer.extractFromBucket(bucket, Date.now(), 10);
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
