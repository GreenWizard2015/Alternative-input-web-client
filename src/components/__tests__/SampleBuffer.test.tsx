import { SampleBuffer, Sample } from '../Samples';
import { createMockSample } from './testHelpers';

describe('SampleBuffer', () => {
  let buffer: SampleBuffer;

  beforeEach(() => {
    buffer = new SampleBuffer();
  });

  it('should add samples to correct buckets', () => {
    const sample1 = createMockSample({ userId: 'user1', cameraId: 'camera1' });
    const sample2 = createMockSample({ userId: 'user1', cameraId: 'camera2' });
    const sample3 = createMockSample({ userId: 'user2', cameraId: 'camera1' });

    buffer.addSample(sample1);
    buffer.addSample(sample2);
    buffer.addSample(sample3);

    expect(buffer.getBucketCount()).toBe(3);
    expect(buffer.getTotalSampleCount()).toBe(3);
  });

  it('should retrieve bucket by key', () => {
    const sample = createMockSample();
    buffer.addSample(sample);

    const key = sample.bucket();
    const bucket = buffer.getBucket(key);
    expect(bucket).not.toBeNull();
    expect(bucket?.getCount()).toBe(1);
  });

  it('should return null for non-existent bucket', () => {
    const bucket = buffer.getBucket('non-existent-key');
    expect(bucket).toBeNull();
  });

  it('should get all buckets', () => {
    buffer.addSample(createMockSample({ userId: 'user1' }));
    buffer.addSample(createMockSample({ userId: 'user2' }));

    const allBuckets = buffer.getAllBuckets();
    expect(allBuckets).toHaveLength(2);
  });

  it('should calculate utilization', () => {
    for (let i = 0; i < 50; i++) {
      buffer.addSample(createMockSample());
    }
    const utilization = buffer.getUtilization(100);
    expect(utilization).toBe(50);
  });

  it('should detect full buckets', () => {
    // Add 2 samples to same bucket (same camera)
    buffer.addSample(createMockSample({ cameraId: 'camera1' }));
    buffer.addSample(createMockSample({ cameraId: 'camera1' }));
    // Check if any bucket has >= 2 samples
    expect(buffer.hasFullBuckets(2)).toBe(true);
    // Check if any bucket has >= 5 samples
    expect(buffer.hasFullBuckets(5)).toBe(false);
  });

  it('should clear all buckets', () => {
    buffer.addSample(createMockSample());
    buffer.addSample(createMockSample());
    expect(buffer.getTotalSampleCount()).toBe(2);
    buffer.clear();
    expect(buffer.getTotalSampleCount()).toBe(0);
  });

  it('should maintain separate buckets per sample identifier', () => {
    const sample1 = new Sample({
      time: Date.now(),
      leftEye: null,
      rightEye: null,
      points: new Float32Array(478 * 2),
      goal: { x: 0, y: 0 },
      userId: 'user1',
      placeId: 'place1',
      screenId: 'screen1',
      cameraId: 'camera1',
    });

    const sample2 = new Sample({
      time: Date.now(),
      leftEye: null,
      rightEye: null,
      points: new Float32Array(478 * 2),
      goal: { x: 0, y: 0 },
      userId: 'user1',
      placeId: 'place1',
      screenId: 'screen1',
      cameraId: 'camera2',
    });

    buffer.addSample(sample1);
    buffer.addSample(sample2);

    expect(buffer.getBucket(sample1.bucket())?.getCount()).toBe(1);
    expect(buffer.getBucket(sample2.bucket())?.getCount()).toBe(1);
    expect(buffer.getBucketCount()).toBe(2);
  });

  it('should drop samples before minTime from all buckets', () => {
    const now = Date.now();
    const minTime = now - 5000;

    // Add samples to different buckets
    buffer.addSample(createMockSample({ time: now - 8000, cameraId: 'camera1' })); // Before minTime
    buffer.addSample(createMockSample({ time: now - 3000, cameraId: 'camera1' })); // After minTime
    buffer.addSample(createMockSample({ time: now - 7000, cameraId: 'camera2' })); // Before minTime
    buffer.addSample(createMockSample({ time: now - 2000, cameraId: 'camera2' })); // After minTime

    expect(buffer.getTotalSampleCount()).toBe(4);

    // Drop samples before minTime
    const droppedCount = buffer.dropSamplesBeforeTime(minTime);

    expect(droppedCount).toBe(2);
    expect(buffer.getTotalSampleCount()).toBe(2);
  });
});
