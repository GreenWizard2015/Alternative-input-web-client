import { Sample } from '../Samples';
import { createMockSample } from './testHelpers';

describe('Sample', () => {
  it('should create sample with all fields', () => {
    const sample = createMockSample();
    expect(sample.time).toBeDefined();
    expect(sample.leftEye).toBeDefined();
    expect(sample.rightEye).toBeDefined();
    expect(sample.points).toBeDefined();
    expect(sample.goal).toBeDefined();
    expect(sample.userId).toBe('user1');
    expect(sample.placeId).toBe('place1');
    expect(sample.screenId).toBe('screen1');
    expect(sample.cameraId).toBe('camera1');
  });

  it('should generate correct bucket key', () => {
    const sample = createMockSample({
      userId: 'user1',
      placeId: 'place1',
      screenId: 'screen1',
      cameraId: 'camera1',
    });
    expect(sample.bucket()).toBe('user1|place1|screen1|camera1');
  });

  it('should handle special characters in bucket key', () => {
    const sample = createMockSample({
      userId: 'user-1',
      placeId: 'place_1',
      screenId: 'screen.1',
      cameraId: 'camera-2',
    });
    expect(sample.bucket()).toBe('user-1|place_1|screen.1|camera-2');
  });

  it('should preserve all sample data', () => {
    const time = Date.now();
    const leftEye = new Uint8ClampedArray(48 * 48);
    const rightEye = new Uint8ClampedArray(48 * 48);
    const points = new Float32Array(478 * 2);

    leftEye[0] = 100;
    rightEye[0] = 200;
    points[0] = 0.5;

    const goal = { x: 0.1, y: 0.2 };
    const userId = 'testUser';
    const placeId = 'testPlace';
    const screenId = 'testScreen';
    const cameraId = 'testCamera';

    const sample = new Sample({
      time,
      leftEye,
      rightEye,
      points,
      goal,
      userId,
      placeId,
      screenId,
      cameraId,
    });

    expect(sample.time).toBe(time);
    expect(sample.leftEye![0]).toBe(100);
    expect(sample.rightEye![0]).toBe(200);
    expect(sample.points[0]).toBe(0.5);
    expect(sample.goal).toEqual(goal);
    expect(sample.userId).toBe(userId);
    expect(sample.placeId).toBe(placeId);
    expect(sample.screenId).toBe(screenId);
    expect(sample.cameraId).toBe(cameraId);
  });

  it('should handle null eye data', () => {
    const sample = createMockSample({
      leftEye: null,
      rightEye: null,
    });
    expect(sample.leftEye).toBeNull();
    expect(sample.rightEye).toBeNull();
  });

  it('should create unique bucket keys for different cameras', () => {
    const sample1 = createMockSample({ cameraId: 'camera1' });
    const sample2 = createMockSample({ cameraId: 'camera2' });

    expect(sample1.bucket()).not.toBe(sample2.bucket());
    expect(sample1.bucket()).toContain('camera1');
    expect(sample2.bucket()).toContain('camera2');
  });

  it('should create unique bucket keys for different users', () => {
    const sample1 = createMockSample({ userId: 'user1' });
    const sample2 = createMockSample({ userId: 'user2' });

    expect(sample1.bucket()).not.toBe(sample2.bucket());
    expect(sample1.bucket()).toContain('user1');
    expect(sample2.bucket()).toContain('user2');
  });

  it('should preserve bucket key format with pipe separators', () => {
    const sample = createMockSample({
      userId: 'u1',
      placeId: 'p1',
      screenId: 's1',
      cameraId: 'c1',
    });
    const key = sample.bucket();
    const parts = key.split('|');

    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('u1');
    expect(parts[1]).toBe('p1');
    expect(parts[2]).toBe('s1');
    expect(parts[3]).toBe('c1');
  });
});
