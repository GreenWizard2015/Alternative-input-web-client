import { Sample } from '../Samples';

/**
 * Creates a mock sample with sensible defaults for testing.
 * Allows overriding any field via the overrides parameter.
 */
export function createMockSample(overrides: Partial<any> = {}): Sample {
  return new Sample({
    time: Date.now(),
    leftEye: new Uint8ClampedArray(48 * 48),
    rightEye: new Uint8ClampedArray(48 * 48),
    points: new Float32Array(478 * 2),
    goal: { x: 0.5, y: 0.5 },
    userId: 'user1',
    placeId: 'place1',
    screenId: 'screen1',
    cameraId: 'camera1',
    ...overrides,
  });
}
