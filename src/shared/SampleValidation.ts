/**
 * SampleValidation.ts - Centralized sample validation logic
 *
 * Moved from: src/components/Samples.tsx (lines 9-36)
 *
 * Handles validation of Sample objects and UUID objects for use in both
 * component and worker contexts.
 */

import { Sample, Position, UUIDed } from './Sample';

/**
 * SampleValidation - Centralized validation for samples and UUIDs
 *
 * Validates:
 * - Sample goal position is within valid range
 * - UUIDs and names are present and non-empty
 */
export class SampleValidation {
  private static readonly GOAL_MIN = -2;
  private static readonly GOAL_MAX = 2;

  /**
   * Get validation error for goal position
   * @returns Error message if invalid, null if valid
   */
  static getGoalValidationError(goal: Position | null | undefined): string | null {
    if (!goal) return 'Goal is missing';
    // Validate inclusive bounds [-2, 2]
    if (!(this.GOAL_MIN <= goal.x && goal.x <= this.GOAL_MAX)) {
      return `Invalid goal.x: ${goal.x} (must be in range [${this.GOAL_MIN}, ${this.GOAL_MAX}])`;
    }
    if (!(this.GOAL_MIN <= goal.y && goal.y <= this.GOAL_MAX)) {
      return `Invalid goal.y: ${goal.y} (must be in range [${this.GOAL_MIN}, ${this.GOAL_MAX}])`;
    }
    return null;
  }

  /**
   * Validate goal position
   * @returns true if goal is valid, false otherwise
   */
  static validateGoal(goal: Position | null | undefined): boolean {
    return !this.getGoalValidationError(goal);
  }

  /**
   * Validate complete sample
   * @returns Object with valid boolean and optional error message
   */
  static validateSample(sample: Sample): { valid: boolean; error?: string } {
    const goalError = this.getGoalValidationError(sample.goal);
    return goalError ? { valid: false, error: goalError } : { valid: true };
  }

  /**
   * Validate UUIded object (has name and uuid)
   * @returns true if valid, false otherwise
   */
  static validateUUIDed(obj: UUIDed | null): boolean {
    return !!(obj && obj.name && obj.uuid && obj.name.length > 0 && obj.uuid.length > 0);
  }
}

/**
 * Helper function for filtering UUIded objects
 * Shorter name for common validation use case
 */
export const validate = (obj: UUIDed | null): boolean => {
  return SampleValidation.validateUUIDed(obj);
};
