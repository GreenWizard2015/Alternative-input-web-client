import { CameraSampleBucket } from '../Samples';
import { createMockSample } from './testHelpers';

describe('CameraSampleBucket', () => {
  let bucket: CameraSampleBucket;

  beforeEach(() => {
    bucket = new CameraSampleBucket();
  });

  it('should add and retrieve samples', () => {
    const sample = createMockSample();
    bucket.add(sample);
    expect(bucket.getSamples()).toHaveLength(1);
    expect(bucket.getSamples()[0]).toEqual(sample);
  });

  it('should return correct count', () => {
    expect(bucket.getCount()).toBe(0);
    bucket.add(createMockSample());
    expect(bucket.getCount()).toBe(1);
    bucket.add(createMockSample());
    expect(bucket.getCount()).toBe(2);
  });

  it('should extract by timestamp', () => {
    const now = Date.now();
    const sample1 = createMockSample({ time: now - 2000 });
    const sample2 = createMockSample({ time: now - 1000 });
    const sample3 = createMockSample({ time: now + 1000 });

    bucket.add(sample1);
    bucket.add(sample2);
    bucket.add(sample3);

    // Extract samples with time < now, up to 10 items
    const result = bucket.extractByTimestamp(now, 10);
    expect(result.sent).toHaveLength(2); // sample1 and sample2
    expect(result.remaining).toHaveLength(1); // sample3
  });

  it('should respect maxSize limit', () => {
    for (let i = 0; i < 10; i++) {
      bucket.add(createMockSample({ time: Date.now() - 1000 }));
    }

    const result = bucket.extractByTimestamp(Date.now(), 5);
    expect(result.sent).toHaveLength(5);
    expect(result.remaining).toHaveLength(5);
  });

  it('should clear all samples', () => {
    bucket.add(createMockSample());
    bucket.add(createMockSample());
    expect(bucket.getCount()).toBe(2);
    bucket.clear();
    expect(bucket.getCount()).toBe(0);
  });

  it('should check if empty', () => {
    expect(bucket.isEmpty()).toBe(true);
    bucket.add(createMockSample());
    expect(bucket.isEmpty()).toBe(false);
  });

  it('should check if full', () => {
    expect(bucket.isFull(5)).toBe(false);
    for (let i = 0; i < 5; i++) {
      bucket.add(createMockSample());
    }
    expect(bucket.isFull(5)).toBe(true);
  });

  it('should drop samples before minTime', () => {
    const now = Date.now();
    const minTime = now - 3000;

    // Add samples with different times
    bucket.add(createMockSample({ time: now - 5000 })); // Before minTime - will be dropped
    bucket.add(createMockSample({ time: now - 2000 })); // After minTime - will be kept
    bucket.add(createMockSample({ time: now - 1000 })); // After minTime - will be kept

    expect(bucket.getCount()).toBe(3);

    // Drop samples before minTime
    const droppedCount = bucket.dropSamplesBeforeTime(minTime);

    expect(droppedCount).toBe(1);
    expect(bucket.getCount()).toBe(2);

    // Verify samples before minTime were removed
    const remaining = bucket.getSamples();
    expect(remaining.every((s) => s.time >= minTime)).toBe(true);
  });

  it('should return 0 dropped samples if all are after minTime', () => {
    const now = Date.now();
    const minTime = now - 5000;
    bucket.add(createMockSample({ time: now - 1000 }));
    bucket.add(createMockSample({ time: now - 2000 }));

    const droppedCount = bucket.dropSamplesBeforeTime(minTime);

    expect(droppedCount).toBe(0);
    expect(bucket.getCount()).toBe(2);
  });
});
