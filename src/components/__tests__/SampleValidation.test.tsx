import { SampleValidation } from '../Samples';
import { createMockSample } from './testHelpers';

describe('SampleValidation', () => {
  describe('validateGoal', () => {
    it('should return true for valid goals', () => {
      expect(SampleValidation.validateGoal({ x: 0, y: 0 })).toBe(true);
      expect(SampleValidation.validateGoal({ x: -1.9, y: 1.9 })).toBe(true);
      expect(SampleValidation.validateGoal({ x: 1.5, y: -1.5 })).toBe(true);
    });

    it('should return false for null or undefined goals', () => {
      expect(SampleValidation.validateGoal(null)).toBe(false);
      expect(SampleValidation.validateGoal(undefined)).toBe(false);
    });

    it('should return false for out-of-range goals', () => {
      expect(SampleValidation.validateGoal({ x: -2, y: 0 })).toBe(false);
      expect(SampleValidation.validateGoal({ x: 2, y: 0 })).toBe(false);
      expect(SampleValidation.validateGoal({ x: 0, y: -2 })).toBe(false);
      expect(SampleValidation.validateGoal({ x: 0, y: 2 })).toBe(false);
    });

    it('should return false for boundary edge cases', () => {
      expect(SampleValidation.validateGoal({ x: -2, y: 0 })).toBe(false);
      expect(SampleValidation.validateGoal({ x: 2, y: 0 })).toBe(false);
    });
  });

  describe('getGoalValidationError', () => {
    it('should return null for valid goals', () => {
      expect(SampleValidation.getGoalValidationError({ x: 0, y: 0 })).toBeNull();
      expect(SampleValidation.getGoalValidationError({ x: -1.5, y: 1.5 })).toBeNull();
    });

    it('should return error message for missing goal', () => {
      expect(SampleValidation.getGoalValidationError(null)).toBe('Goal is missing');
      expect(SampleValidation.getGoalValidationError(undefined)).toBe('Goal is missing');
    });

    it('should return error message for invalid x', () => {
      const error = SampleValidation.getGoalValidationError({ x: -2.5, y: 0 });
      expect(error).toContain('Invalid goal.x');
      expect(error).toContain('-2.5');
    });

    it('should return error message for invalid y', () => {
      const error = SampleValidation.getGoalValidationError({ x: 0, y: 2.5 });
      expect(error).toContain('Invalid goal.y');
      expect(error).toContain('2.5');
    });
  });

  describe('validateSample', () => {
    it('should return valid for good sample', () => {
      const sample = createMockSample();
      const result = SampleValidation.validateSample(sample);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for sample with bad goal', () => {
      const sample = createMockSample({ goal: { x: -3, y: 0 } });
      const result = SampleValidation.validateSample(sample);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validateUUIDed', () => {
    it('should return true for valid UUIDed objects', () => {
      expect(SampleValidation.validateUUIDed({ name: 'test', uuid: 'uuid123', samples: 10 })).toBe(true);
    });

    it('should return false for null', () => {
      expect(SampleValidation.validateUUIDed(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(SampleValidation.validateUUIDed(undefined)).toBe(false);
    });

    it('should return false for empty name or uuid', () => {
      expect(SampleValidation.validateUUIDed({ name: '', uuid: 'uuid123', samples: 10 })).toBe(false);
      expect(SampleValidation.validateUUIDed({ name: 'test', uuid: '', samples: 10 })).toBe(false);
    });
  });
});
