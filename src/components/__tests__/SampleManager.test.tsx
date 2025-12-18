import { SampleManager } from '../Samples';
import { createMockSample } from './testHelpers';
import { worker } from './__mocks__/DataWorker';

describe('SampleManager', () => {
  let manager: SampleManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new SampleManager();
  });

  it('should store valid samples', () => {
    const now = Date.now();
    const sample = createMockSample();
    const result = manager.store(sample, { minTime: now - 3000, maxTime: now });
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject invalid samples', () => {
    const now = Date.now();
    const sample = createMockSample({ goal: { x: -3, y: 0 } });
    const result = manager.store(sample, { minTime: now - 3000, maxTime: now });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should auto-flush when threshold reached', () => {
    // Sample size is ~8440 bytes, so use small maxChunkSize to set low threshold
    const config = {
      maxChunkSize: 1024 * 100, // Small chunk size
    };
    const smallManager = new SampleManager(config);
    const maxSamplesPerBatch = Math.floor(config.maxChunkSize / 8440);
    const autoFlushThreshold = 2 * maxSamplesPerBatch;

    jest.clearAllMocks();
    const now = Date.now();

    // Store enough samples to exceed autoFlushThreshold
    // This triggers auto-flush in store(), which calls flush()
    // And flush will call worker if count > maxSamplesPerBatch
    for (let i = 0; i < autoFlushThreshold + 1; i++) {
      smallManager.store(
        createMockSample({ time: now - 5000 - i }),
        { minTime: now - 5000 - autoFlushThreshold, maxTime: now }
      );
    }

    // Should trigger auto-flush and call worker.postMessage
    // (because count > maxSamplesPerBatch after reaching autoFlushThreshold)
    expect(worker.postMessage).toHaveBeenCalled();
  });

  it('should flush samples', () => {
    const now = Date.now();
    // Store one sample and use flushAndClear to ensure it gets sent
    manager.store(createMockSample({ time: now - 5000 }), { minTime: now - 5000, maxTime: now });
    jest.clearAllMocks();
    manager.flushAndClear({ minTime: now - 5000, maxTime: now });
    expect(worker.postMessage).toHaveBeenCalled();
  });

  it('should flush and clear samples', () => {
    const now = Date.now();
    // Store one sample with time before maxTime
    manager.store(createMockSample({ time: now - 1000 }), { minTime: now - 3000, maxTime: now });
    const stats1 = manager.getStats();
    expect(stats1.totalSamples).toBeGreaterThan(0);

    jest.clearAllMocks();
    // flushAndClear should always call worker, regardless of count
    manager.flushAndClear({ minTime: now - 3000, maxTime: now });
    expect(worker.postMessage).toHaveBeenCalled();

    const stats2 = manager.getStats();
    expect(stats2.totalSamples).toBe(0);
  });

  it('should get statistics', () => {
    const now = Date.now();
    manager.store(createMockSample({ cameraId: 'camera1' }), { minTime: now - 3000, maxTime: now });
    manager.store(createMockSample({ cameraId: 'camera2' }), { minTime: now - 3000, maxTime: now });

    const stats = manager.getStats();
    expect(stats.totalSamples).toBeGreaterThanOrEqual(2);
    expect(stats.bucketCount).toBeGreaterThanOrEqual(1);
    expect(stats.bufferUtilization).toBeGreaterThanOrEqual(0);
  });

  it('should clear all samples', () => {
    const now = Date.now();
    manager.store(createMockSample(), { minTime: now - 3000, maxTime: now });
    manager.clear();
    expect(manager.getStats().totalSamples).toBe(0);
  });

  it('should handle errors with callbacks', () => {
    const errorHandler = jest.fn();
    manager.onError('validation', errorHandler);

    const now = Date.now();
    const badSample = createMockSample({ goal: { x: -3, y: 0 } });
    manager.store(badSample, { minTime: now - 3000, maxTime: now });
    expect(errorHandler).toHaveBeenCalled();
  });

  it('should accept custom configuration', () => {
    const config = {
      maxChunkSize: 2 * 1024 * 1024,
      uploadEndpoint: '/custom/endpoint',
      autoFlushThreshold: 500,
    };
    const customManager = new SampleManager(config);
    expect(customManager).toBeDefined();
  });

  it('should handle multiple concurrent stores', () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      const result = manager.store(createMockSample({ cameraId: `camera${i}` }), { minTime: now - 3000, maxTime: now });
      expect(result.success).toBe(true);
    }
    expect(manager.getStats().totalSamples).toBe(5);
  });

  it('should handle error callbacks for different error types', () => {
    const validationHandler = jest.fn();
    const storageHandler = jest.fn();

    manager.onError('validation', validationHandler);
    manager.onError('storage', storageHandler);

    // Trigger validation error
    const now = Date.now();
    const badSample = createMockSample({ goal: { x: -3, y: 0 } });
    manager.store(badSample, { minTime: now - 3000, maxTime: now });

    expect(validationHandler).toHaveBeenCalled();
    expect(storageHandler).not.toHaveBeenCalled();
  });

  it('should maintain separate error handlers', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    manager.onError('validation', handler1);
    manager.onError('validation', handler2);

    const now = Date.now();
    const badSample = createMockSample({ goal: { x: -3, y: 0 } });
    manager.store(badSample, { minTime: now - 3000, maxTime: now });

    // Last handler should override (only handler2 is registered)
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
  });

  describe('worker call threshold', () => {
    it('should only call worker if count in minTime<time<maxTime exceeds limit', () => {
      const config = {
        maxChunkSize: 1024 * 1024, // Large chunk size so we can control sample count
      };
      const thresholdManager = new SampleManager(config);
      const maxSamplesPerBatch = Math.floor(config.maxChunkSize / 8440); // Approximate sample size

      const now = Date.now();
      const minTime = now - 10000;
      const maxTime = now;

      // Store samples equal to the limit (should NOT trigger worker)
      for (let i = 0; i < maxSamplesPerBatch; i++) {
        thresholdManager.store(
          createMockSample({ time: now - 5000 - i }),
          { minTime, maxTime }
        );
      }

      jest.clearAllMocks();
      thresholdManager.flush({ minTime, maxTime });

      // Should NOT call worker since count == limit (not > limit)
      expect(worker.postMessage).not.toHaveBeenCalled();

      // Now store one more sample to exceed limit
      thresholdManager.store(createMockSample({ time: now - 6000 }), { minTime, maxTime });

      jest.clearAllMocks();
      thresholdManager.flush({ minTime, maxTime });

      // Should call worker now since count > limit
      expect(worker.postMessage).toHaveBeenCalled();
    });

    it('should always call worker in flushAndClear regardless of count', () => {
      const now = Date.now();
      const minTime = now - 3000;
      const maxTime = now - 500;

      // Store just one sample (below threshold)
      manager.store(createMockSample({ time: now - 1500 }), { minTime, maxTime });

      jest.clearAllMocks();
      // flushAndClear should always send, even with just 1 sample
      manager.flushAndClear({ minTime, maxTime });

      // Should call worker even though count is below limit
      expect(worker.postMessage).toHaveBeenCalled();

      // Buffer should be empty after flushAndClear
      const stats = manager.getStats();
      expect(stats.totalSamples).toBe(0);
    });
  });

  describe('sentAll flow integration', () => {
    it('should handle flushAndClear with sentAll=true in enqueueForUpload', () => {
      const now = Date.now();
      const config = { maxChunkSize: 1024 * 100 };
      const testManager = new SampleManager(config);
      const maxSamplesPerBatch = Math.floor(config.maxChunkSize / 8440);

      // Store samples below batch size
      for (let i = 0; i < 3; i++) {
        testManager.store(
          createMockSample({ time: now - 1000 - i }),
          { minTime: now - 3000, maxTime: now }
        );
      }

      jest.clearAllMocks();
      // flushAndClear should send all samples even if incomplete batch
      testManager.flushAndClear({ minTime: now - 3000, maxTime: now });

      // Should call worker at least once (all samples sent as incomplete batch with sentAll=true)
      expect(worker.postMessage).toHaveBeenCalled();
      const calls = (worker.postMessage as jest.Mock).mock.calls;
      // Should have received the incomplete batch
      expect(calls[0][0].samples.length).toBe(3);
    });

    it('should handle multiple incomplete batches with sentAll=true', () => {
      const now = Date.now();
      const config = { maxChunkSize: 1024 * 50 };
      const testManager = new SampleManager(config);
      const maxSamplesPerBatch = Math.floor(config.maxChunkSize / 8440);

      // Store multiple samples that will result in multiple incomplete batches
      const sampleCount = maxSamplesPerBatch + Math.floor(maxSamplesPerBatch / 2);
      for (let i = 0; i < sampleCount; i++) {
        testManager.store(
          createMockSample({ time: now - 1000 - i }),
          { minTime: now - 3000, maxTime: now }
        );
      }

      jest.clearAllMocks();
      testManager.flushAndClear({ minTime: now - 3000, maxTime: now });

      // With sentAll=true, all samples should be sent
      expect(worker.postMessage).toHaveBeenCalled();
      const calls = (worker.postMessage as jest.Mock).mock.calls;
      let totalSent = 0;
      for (const call of calls) {
        totalSent += call[0].samples.length;
      }
      expect(totalSent).toBe(sampleCount);
    });

    it('should properly use flush with normal enqueueForUpload (sentAll=false)', () => {
      const now = Date.now();
      const config = { maxChunkSize: 1024 * 100 };
      const testManager = new SampleManager(config);
      const maxSamplesPerBatch = Math.floor(config.maxChunkSize / 8440);

      // Store samples below batch size
      for (let i = 0; i < 3; i++) {
        testManager.store(
          createMockSample({ time: now - 1000 - i }),
          { minTime: now - 3000, maxTime: now }
        );
      }

      const statsBefore = testManager.getStats();
      expect(statsBefore.totalSamples).toBe(3);

      jest.clearAllMocks();
      // Regular flush with incomplete batch should NOT send (default sentAll=false)
      testManager.flush({ minTime: now - 3000, maxTime: now });

      // Should NOT call worker since count doesn't exceed limit and sentAll=false
      expect(worker.postMessage).not.toHaveBeenCalled();

      // Samples should still be in buffer
      const statsAfter = testManager.getStats();
      expect(statsAfter.totalSamples).toBe(3);
    });

    it('should differentiate between flush and flushAndClear behavior with sentAll', () => {
      const now = Date.now();
      const testManager = new SampleManager();

      // Store single sample
      testManager.store(
        createMockSample({ time: now - 1000 }),
        { minTime: now - 3000, maxTime: now }
      );

      const statsBefore = testManager.getStats();
      expect(statsBefore.totalSamples).toBe(1);

      jest.clearAllMocks();
      // flush() with sentAll=false (default) should not send single sample
      testManager.flush({ minTime: now - 3000, maxTime: now });
      expect(worker.postMessage).not.toHaveBeenCalled();

      jest.clearAllMocks();
      // flushAndClear() with sentAll=true should send the sample
      testManager.flushAndClear({ minTime: now - 3000, maxTime: now });
      expect(worker.postMessage).toHaveBeenCalled();

      // Buffer should be cleared
      const statsAfter = testManager.getStats();
      expect(statsAfter.totalSamples).toBe(0);
    });
  });

  describe('minTime/maxTime overlap edge cases', () => {
    it('should handle minTime equal to maxTime without error', () => {
      const now = Date.now();
      const sameTime = now - 2000;

      manager.store(createMockSample({ time: sameTime }), { minTime: sameTime, maxTime: sameTime });

      jest.clearAllMocks();
      // Should not throw when minTime === maxTime
      expect(() => {
        manager.store(createMockSample({ time: sameTime }), { minTime: sameTime, maxTime: sameTime });
      }).not.toThrow();
    });

    it('should handle minTime greater than maxTime in store', () => {
      const now = Date.now();
      const minTime = now - 1000;
      const maxTime = now - 2000; // maxTime < minTime

      jest.clearAllMocks();
      // Should not throw when minTime > maxTime
      expect(() => {
        manager.store(createMockSample({ time: now - 1500 }), { minTime, maxTime });
      }).not.toThrow();
    });

    it('should handle minTime greater than maxTime in flushAndClear', () => {
      const now = Date.now();
      manager.store(createMockSample({ time: now - 2000 }), { minTime: now - 3000, maxTime: now });

      const minTime = now - 1000;
      const maxTime = now - 2000; // maxTime < minTime

      jest.clearAllMocks();
      // Should not throw when minTime > maxTime
      expect(() => {
        manager.flushAndClear({ minTime, maxTime });
      }).not.toThrow();

      // Buffer should still be cleared
      expect(manager.getStats().totalSamples).toBe(0);
    });

    it('should handle minTime equal to maxTime in flushAndClear', () => {
      const now = Date.now();
      manager.store(createMockSample({ time: now - 2000 }), { minTime: now - 3000, maxTime: now });

      const sameTime = now - 2000;

      jest.clearAllMocks();
      // Should not throw when minTime === maxTime
      expect(() => {
        manager.flushAndClear({ minTime: sameTime, maxTime: sameTime });
      }).not.toThrow();

      // Buffer should still be cleared
      expect(manager.getStats().totalSamples).toBe(0);
    });

    it('should not send samples when minTime >= maxTime in flush', () => {
      const now = Date.now();
      // Store sample with valid time range first
      manager.store(createMockSample({ time: now - 2000 }), { minTime: now - 3000, maxTime: now });

      const initialSamples = manager.getStats().totalSamples;
      expect(initialSamples).toBeGreaterThan(0);

      jest.clearAllMocks();
      // Call flush with invalid range (minTime > maxTime)
      const minTime = now - 1000;
      const maxTime = now - 2000; // maxTime < minTime
      manager.flush({ minTime, maxTime });

      // Should not call worker when minTime > maxTime (no valid samples in range)
      expect(worker.postMessage).not.toHaveBeenCalled();

      // Samples may be cleared if dropSamplesBeforeTime removes them
      // The key is that no worker.postMessage was called
    });

    it('should not send samples when minTime equals maxTime in flush', () => {
      const now = Date.now();
      manager.store(createMockSample({ time: now - 2000 }), { minTime: now - 3000, maxTime: now });

      const sameTime = now - 2000;

      jest.clearAllMocks();
      manager.flush({ minTime: sameTime, maxTime: sameTime });

      // Should not call worker when minTime === maxTime (no valid samples in range)
      expect(worker.postMessage).not.toHaveBeenCalled();

      // Samples should remain in buffer (flush didn't clear)
      expect(manager.getStats().totalSamples).toBeGreaterThan(0);
    });
  });

  describe('minTime/maxTime filtering', () => {
    it('should respect maxTime boundary when extracting samples', () => {
      const now = Date.now();
      const minTime = now - 3000;
      const maxTime = now - 1000;

      // Store two samples, both within the minTime<time<maxTime range
      manager.store(createMockSample({ time: now - 2500 }), { minTime, maxTime });
      manager.store(createMockSample({ time: now - 500 }), { minTime, maxTime }); // After maxTime

      // Use flushAndClear to send regardless of count
      jest.clearAllMocks();
      manager.flushAndClear({ minTime, maxTime });

      // Should send the sample before maxTime, not the one after
      expect(worker.postMessage).toHaveBeenCalled();
      const callArgs = (worker.postMessage as jest.Mock).mock.calls[0][0];
      expect(callArgs.samples.length).toBe(1);
      expect(callArgs.samples[0].time).toBe(now - 2500);
    });

    it('should leave samples with time >= maxTime in buffer after flush if count below limit', () => {
      const now = Date.now();
      const minTime = now - 3000;
      const maxTime = now - 1000;

      // Store samples at different times - only 1 below threshold
      manager.store(createMockSample({ time: now - 2000 }), { minTime, maxTime });
      manager.store(createMockSample({ time: now }), { minTime, maxTime }); // >= maxTime

      const statsBefore = manager.getStats();
      expect(statsBefore.totalSamples).toBe(2);

      // Regular flush with count below limit should not extract
      manager.flush({ minTime, maxTime });

      // Both samples should remain since count doesn't exceed limit
      const statsAfter = manager.getStats();
      expect(statsAfter.totalSamples).toBe(2);
    });

    it('should call worker when samples in range exceed limit', () => {
      const config = {
        maxChunkSize: 1024 * 1024,
      };
      const thresholdManager = new SampleManager(config);
      const maxSamplesPerBatch = Math.floor(config.maxChunkSize / 8440);

      const now = Date.now();
      const minTime = now - 3000;
      const maxTime = now;

      // Store enough samples to exceed the limit
      for (let i = 0; i < maxSamplesPerBatch + 1; i++) {
        thresholdManager.store(
          createMockSample({ time: now - 2000 - i }),
          { minTime, maxTime }
        );
      }

      jest.clearAllMocks();
      thresholdManager.flush({ minTime, maxTime });

      // Should call worker since count > limit
      expect(worker.postMessage).toHaveBeenCalled();
    });

    it('flushAndClear should send all chunks and clear entire buffer', () => {
      const now = Date.now();
      const minTime = now - 5000;
      const maxTime = now;

      // Store samples at different times
      manager.store(createMockSample({ time: now - 3000 }), { minTime, maxTime });
      manager.store(createMockSample({ time: now - 2000 }), { minTime, maxTime });
      manager.store(createMockSample({ time: now - 500 }), { minTime, maxTime }); // Future sample

      const statsBefore = manager.getStats();
      expect(statsBefore.totalSamples).toBe(3);

      // flushAndClear should flush samples and then clear entire buffer
      jest.clearAllMocks();
      manager.flushAndClear({ minTime: now - 4000, maxTime: now - 1000 });

      // After flushAndClear, buffer should be completely cleared
      expect(worker.postMessage).toHaveBeenCalled();
      const statsAfter = manager.getStats();
      expect(statsAfter.totalSamples).toBe(0); // Buffer is completely cleared
    });
  });
});
