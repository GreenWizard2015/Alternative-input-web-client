import { sampleManager, Sample } from '../Samples';
import { createMockSample } from './testHelpers';
import { worker } from './__mocks__/DataWorker';

describe('Samples Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sampleManager.clear();
  });

  it('should handle complete workflow', () => {
    const now = Date.now();

    // Store multiple samples
    for (let i = 0; i < 5; i++) {
      const result = sampleManager.store(
        createMockSample({
          time: now - 1000 + i * 100,
          cameraId: `camera${i % 2}`,
        }),
        { minTime: now - 3000, maxTime: now }
      );
      expect(result.success).toBe(true);
    }

    // Check stats
    const stats = sampleManager.getStats();
    expect(stats.totalSamples).toBe(5);
    expect(stats.bucketCount).toBeGreaterThanOrEqual(2);

    // Flush and verify cleared
    sampleManager.flushAndClear({ minTime: now - 3000, maxTime: now });
    expect(sampleManager.getStats().totalSamples).toBe(0);
  });

  it('should maintain separate buckets per camera', () => {
    const now = Date.now();

    const sample1 = new Sample({
      time: now,
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
      time: now,
      leftEye: null,
      rightEye: null,
      points: new Float32Array(478 * 2),
      goal: { x: 0, y: 0 },
      userId: 'user1',
      placeId: 'place1',
      screenId: 'screen1',
      cameraId: 'camera2',
    });

    sampleManager.store(sample1, { minTime: now - 3000, maxTime: now });
    sampleManager.store(sample2, { minTime: now - 3000, maxTime: now });

    const buffer = sampleManager.getBuffer();
    expect(buffer.getBucket(sample1.bucket())?.getCount()).toBe(1);
    expect(buffer.getBucket(sample2.bucket())?.getCount()).toBe(1);
  });

  it('singleton sampleManager should work correctly', () => {
    const now = Date.now();
    const result = sampleManager.store(createMockSample(), { minTime: now - 3000, maxTime: now });
    expect(result.success).toBe(true);
  });

  it('should aggregate stats correctly across multiple cameras', () => {
    const now = Date.now();

    // Add samples from 3 different cameras
    for (let cameraId = 1; cameraId <= 3; cameraId++) {
      for (let i = 0; i < 2; i++) {
        sampleManager.store(
          createMockSample({ cameraId: `camera${cameraId}` }),
          { minTime: now - 3000, maxTime: now }
        );
      }
    }

    const stats = sampleManager.getStats();
    expect(stats.totalSamples).toBe(6);
    expect(stats.bucketCount).toBe(3);
  });

  it('should handle mixed valid and invalid samples', () => {
    const now = Date.now();

    // Add valid sample
    const validResult = sampleManager.store(
      createMockSample(),
      { minTime: now - 3000, maxTime: now }
    );
    expect(validResult.success).toBe(true);

    // Add invalid sample
    const invalidResult = sampleManager.store(
      createMockSample({ goal: { x: -3, y: 0 } }),
      { minTime: now - 3000, maxTime: now }
    );
    expect(invalidResult.success).toBe(false);

    // Only valid sample should be stored
    const stats = sampleManager.getStats();
    expect(stats.totalSamples).toBe(1);
  });

  it('should flush only samples before cutoff time', () => {
    const now = Date.now();
    const oldTime = now - 2000;
    const newTime = now - 500;

    // Add old sample (will be flushed if count exceeds limit)
    sampleManager.store(
      createMockSample({ time: oldTime }),
      { minTime: oldTime - 3000, maxTime: oldTime + 1000 }
    );

    // Add new sample (will remain if in range)
    sampleManager.store(
      createMockSample({ time: newTime }),
      { minTime: newTime - 3000, maxTime: newTime + 1000 }
    );

    jest.clearAllMocks();
    // Use flushAndClear to ensure we send regardless of count
    sampleManager.flushAndClear({ minTime: now - 3000, maxTime: now - 1000 });

    // Worker should have been called for samples before maxTime
    expect(worker.postMessage).toHaveBeenCalled();

    // Buffer should be empty after flushAndClear
    const stats = sampleManager.getStats();
    expect(stats.totalSamples).toBe(0);
  });

  it('should support error handling across different error types', () => {
    const validationErrors: Error[] = [];
    const storageErrors: Error[] = [];

    sampleManager.onError('validation', (error) => validationErrors.push(error));
    sampleManager.onError('storage', (error) => storageErrors.push(error));

    // Trigger validation error
    const now = Date.now();
    sampleManager.store(
      createMockSample({ goal: { x: -3, y: 0 } }),
      { minTime: now - 3000, maxTime: now }
    );

    expect(validationErrors.length).toBe(1);
    expect(storageErrors.length).toBe(0);
  });

  it('should handle rapid sequential operations', () => {
    const now = Date.now();

    // Rapid sequential stores
    for (let i = 0; i < 10; i++) {
      const result = sampleManager.store(
        createMockSample({ time: now + i }),
        { minTime: now - 3000, maxTime: now + i }
      );
      expect(result.success).toBe(true);
    }

    const stats = sampleManager.getStats();
    expect(stats.totalSamples).toBe(10);

    // Clear all
    sampleManager.clear();
    expect(sampleManager.getStats().totalSamples).toBe(0);
  });

  it('should maintain buffer utilization reporting', () => {
    const now = Date.now();

    for (let i = 0; i < 50; i++) {
      sampleManager.store(createMockSample(), { minTime: now - 3000, maxTime: now });
    }

    const stats = sampleManager.getStats();
    expect(stats.bufferUtilization).toBeGreaterThan(0);
    expect(stats.bufferUtilization).toBeLessThanOrEqual(100);
  });

  it('should handle getBuffer accessor', () => {
    const now = Date.now();
    sampleManager.store(createMockSample(), { minTime: now - 3000, maxTime: now });
    const buffer = sampleManager.getBuffer();

    expect(buffer).toBeDefined();
    expect(buffer.getTotalSampleCount()).toBeGreaterThan(0);
  });
});
