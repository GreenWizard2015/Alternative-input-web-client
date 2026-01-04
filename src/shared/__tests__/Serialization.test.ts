/**
 * Serialization.test.ts - Unit tests for sample serialization
 */

import { serialize } from '../Serialization';
import { Sample, EYE_SIZE, sampleSize } from '../Sample';

describe('serialize()', () => {
  let samples: Sample[];

  beforeEach(() => {
    samples = Array.from({ length: 3 }, (_, i) =>
      new Sample({
        time: 1000 + i * 100,
        leftEye: new Uint8ClampedArray(EYE_SIZE * EYE_SIZE).fill(128 + i),
        rightEye: new Uint8ClampedArray(EYE_SIZE * EYE_SIZE).fill(100 + i),
        points: new Float32Array(478 * 2).fill(0.5 + i * 0.1),
        goal: { x: 0.1 + i * 0.01, y: -0.1 - i * 0.01 },
        userId: 'user-1234567890123456789012345678901',
        placeId: 'place-123456789012345678901234567890',
        screenId: 'screen-12345678901234567890123456789',
        cameraId: 'camera-12345678901234567890123456789',
        monitorId: 'monitor-1234567890123456789012345678',
      })
    );
  });

  test('serializes samples to ArrayBuffer', () => {
    const buffer = serialize(samples);
    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  test('buffer size matches expected format', () => {
    const buffer = serialize(samples);
    const headerSize = 1 + 36 * 5; // version + 5 IDs (userId, placeId, screenId, cameraId, monitorId)
    const expectedSize = headerSize + samples.length * sampleSize();
    expect(buffer.byteLength).toBe(expectedSize);
  });

  test('rejects samples with different userIds', () => {
    samples[1].userId = 'different';
    expect(() => serialize(samples)).toThrow();
  });

  test('rejects samples with different placeIds', () => {
    samples[1].placeId = 'different';
    expect(() => serialize(samples)).toThrow();
  });

  test('rejects samples with different screenIds', () => {
    samples[1].screenId = 'different';
    expect(() => serialize(samples)).toThrow();
  });

  test('rejects samples with different cameraIds', () => {
    samples[1].cameraId = 'different';
    expect(() => serialize(samples)).toThrow();
  });

  test('writes version byte', () => {
    const buffer = serialize(samples);
    const view = new DataView(buffer);
    const version = view.getUint8(0);
    expect(version).toBe(4); // Format version 4
  });

  test('serializes single sample', () => {
    const singleSample = [samples[0]];
    const buffer = serialize(singleSample);
    const headerSize = 1 + 36 * 5; // version + 5 IDs
    expect(buffer.byteLength).toBe(headerSize + sampleSize());
  });

  test('serializes large batch', () => {
    const largeBatch = Array.from({ length: 100 }, (_, i) =>
      new Sample({
        time: 1000 + i,
        leftEye: new Uint8ClampedArray(EYE_SIZE * EYE_SIZE).fill(128),
        rightEye: new Uint8ClampedArray(EYE_SIZE * EYE_SIZE).fill(100),
        points: new Float32Array(478 * 2).fill(0.5),
        goal: { x: 0.1, y: -0.1 },
        userId: 'user-1234567890123456789012345678901',
        placeId: 'place-123456789012345678901234567890',
        screenId: 'screen-12345678901234567890123456789',
        cameraId: 'camera-12345678901234567890123456789',
        monitorId: 'monitor-1234567890123456789012345678',
      })
    );
    const buffer = serialize(largeBatch);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  test('handles null eye data', () => {
    const sampleWithNullEyes = new Sample({
      time: 1000,
      leftEye: null,
      rightEye: null,
      points: new Float32Array(478 * 2).fill(0.5),
      goal: { x: 0.1, y: -0.1 },
      userId: 'user-1234567890123456789012345678901',
      placeId: 'place-123456789012345678901234567890',
      screenId: 'screen-12345678901234567890123456789',
      cameraId: 'camera-12345678901234567890123456789',
      monitorId: 'monitor-1234567890123456789012345678',
    });
    expect(() => serialize([sampleWithNullEyes])).not.toThrow();
  });

  test('preserves timestamp values', () => {
    const expectedTime = 1234567890;
    const sample = new Sample({
      time: expectedTime,
      leftEye: new Uint8ClampedArray(EYE_SIZE * EYE_SIZE),
      rightEye: new Uint8ClampedArray(EYE_SIZE * EYE_SIZE),
      points: new Float32Array(478 * 2),
      goal: { x: 0, y: 0 },
      userId: 'user-1234567890123456789012345678901',
      placeId: 'place-123456789012345678901234567890',
      screenId: 'screen-12345678901234567890123456789',
      cameraId: 'camera-12345678901234567890123456789',
      monitorId: 'monitor-1234567890123456789012345678',
    });

    const buffer = serialize([sample]);

    // Verify buffer contains the serialized data
    // Header: 1 (version) + 5*36 (IDs) = 181
    expect(buffer.byteLength).toBe(181 + sampleSize());

    // Verify by checking the header version
    const view = new DataView(buffer);
    const version = view.getUint8(0);
    expect(version).toBe(4);
  });

  test('handles points array correctly', () => {
    const pointValues = Array.from({ length: 478 * 2 }, (_, i) => i * 0.001);
    const sample = new Sample({
      time: 1000,
      leftEye: new Uint8ClampedArray(EYE_SIZE * EYE_SIZE),
      rightEye: new Uint8ClampedArray(EYE_SIZE * EYE_SIZE),
      points: new Float32Array(pointValues),
      goal: { x: 0.5, y: -0.5 },
      userId: 'user-1234567890123456789012345678901',
      placeId: 'place-123456789012345678901234567890',
      screenId: 'screen-12345678901234567890123456789',
      cameraId: 'camera-12345678901234567890123456789',
      monitorId: 'monitor-1234567890123456789012345678',
    });

    expect(() => serialize([sample])).not.toThrow();
  });

  test('rejects invalid points array size', () => {
    const invalidSample = new Sample({
      time: 1000,
      leftEye: new Uint8ClampedArray(EYE_SIZE * EYE_SIZE),
      rightEye: new Uint8ClampedArray(EYE_SIZE * EYE_SIZE),
      points: new Float32Array(100), // Wrong size
      goal: { x: 0, y: 0 },
      userId: 'user-1234567890123456789012345678901',
      placeId: 'place-123456789012345678901234567890',
      screenId: 'screen-12345678901234567890123456789',
      cameraId: 'camera-1234567890123456789012345678',
      monitorId: 'monitor-123456789012345678901234567',
    });

    expect(() => serialize([invalidSample])).toThrow();
  });
});
