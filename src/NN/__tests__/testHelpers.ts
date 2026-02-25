/**
 * Test Helpers - Utility functions for neural network tests
 *
 * Provides tensor comparison utilities for testing neural network layers.
 */

import * as tf from '@tensorflow/tfjs';

/**
 * Assert that tensors are close within tolerance
 * Handles all tensor shapes (1D, 2D, 3D, 4D, 5D)
 */
export function assertTensorsClose(
  actual: tf.Tensor,
  expected: tf.Tensor,
  tolerance: number = 1e-5
): void {
  const actualData = actual.dataSync();
  let expectedData: any;

  if (expected instanceof tf.Tensor) {
    expectedData = expected.dataSync();
  } else {
    throw new Error(`Got ${expected}`);
  }

  // Check lengths match
  if (actualData.length !== expectedData.length) {
    throw new Error(
      `Data length mismatch: expected ${expectedData.length}, got ${actualData.length}`
    );
  }

  let diff = 0;
  for (let i = 0; i < actualData.length; i++) {
    diff += Math.abs(actualData[i] - expectedData[i]);
  }
  diff /= actualData.length;

  if (diff > tolerance) {
    // Check underlying components, compare with Python in /home/anton/Documents/Development/Alternative-input/
    throw new Error(`Value are different. Diff: ${diff}`);
  }
}
