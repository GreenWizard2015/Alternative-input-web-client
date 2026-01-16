/**
 * SampleValidation.test.ts - Unit tests for validation logic
 */

import { SampleValidation } from '../SampleValidation';
import { Sample, Position } from '../Sample';

describe('SampleValidation', () => {
  describe('validateGoal()', () => {
    test('accepts goal in valid range', () => {
      const goal: Position = { x: 0, y: 0 };
      expect(SampleValidation.validateGoal(goal)).toBe(true);
    });

    test('accepts goal near boundaries', () => {
      expect(SampleValidation.validateGoal({ x: -1.99, y: 1.99 })).toBe(true);
    });

    test('rejects goal with x too negative', () => {
      const goal: Position = { x: -2.1, y: 0 };
      expect(SampleValidation.validateGoal(goal)).toBe(false);
    });

    test('rejects goal with x too positive', () => {
      const goal: Position = { x: 2.1, y: 0 };
      expect(SampleValidation.validateGoal(goal)).toBe(false);
    });

    test('rejects goal with y too negative', () => {
      const goal: Position = { x: 0, y: -2.1 };
      expect(SampleValidation.validateGoal(goal)).toBe(false);
    });

    test('rejects goal with y too positive', () => {
      const goal: Position = { x: 0, y: 2.1 };
      expect(SampleValidation.validateGoal(goal)).toBe(false);
    });

    test('rejects null goal', () => {
      expect(SampleValidation.validateGoal(null)).toBe(false);
    });

    test('rejects undefined goal', () => {
      expect(SampleValidation.validateGoal(undefined)).toBe(false);
    });
  });

  describe('getGoalValidationError()', () => {
    test('returns null for valid goal', () => {
      const goal: Position = { x: 0.5, y: -0.5 };
      const error = SampleValidation.getGoalValidationError(goal);
      expect(error).toBeNull();
    });

    test('returns error message for invalid x', () => {
      const error = SampleValidation.getGoalValidationError({ x: -2.5, y: 0 });
      expect(error).toContain('goal.x');
    });

    test('returns error message for invalid y', () => {
      const error = SampleValidation.getGoalValidationError({ x: 0, y: 2.5 });
      expect(error).toContain('goal.y');
    });

    test('returns error for missing goal', () => {
      const error = SampleValidation.getGoalValidationError(null);
      expect(error).toContain('missing');
    });
  });

  describe('validateSample()', () => {
    let validSample: Sample;

    beforeEach(() => {
      validSample = new Sample({
        time: Date.now(),
        leftEye: new Uint8ClampedArray(2304).fill(128),
        rightEye: new Uint8ClampedArray(2304).fill(100),
        points: new Float32Array(956).fill(0.5),
        goal: { x: 0.1, y: -0.1 },
        userId: 'user1',
        placeId: 'place1',
        screenId: 'screen1',
        cameraId: 'cam1',
        monitorId: 'monitor1',
      });
    });

    test('validates correct sample', () => {
      const result = SampleValidation.validateSample(validSample);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('rejects sample with invalid goal', () => {
      validSample.goal = { x: 5, y: 5 };
      const result = SampleValidation.validateSample(validSample);
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('validateUUIDed()', () => {
    test('validates object with name and uuid', () => {
      const obj = { name: 'Test', uuid: 'abc-123', samples: 10 };
      expect(SampleValidation.validateUUIDed(obj)).toBe(true);
    });

    test('rejects object without name', () => {
      const obj = JSON.parse('{"uuid":"abc-123","samples":10}');
      expect(SampleValidation.validateUUIDed(obj)).toBe(false);
    });

    test('rejects object without uuid', () => {
      const obj = JSON.parse('{"name":"Test","samples":10}');
      expect(SampleValidation.validateUUIDed(obj)).toBe(false);
    });

    test('rejects null', () => {
      expect(SampleValidation.validateUUIDed(null)).toBe(false);
    });

    test('rejects object with empty name', () => {
      const obj = { name: '', uuid: 'abc-123', samples: 10 };
      expect(SampleValidation.validateUUIDed(obj)).toBe(false);
    });

    test('rejects object with empty uuid', () => {
      const obj = { name: 'Test', uuid: '', samples: 10 };
      expect(SampleValidation.validateUUIDed(obj)).toBe(false);
    });
  });
});
