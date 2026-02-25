/**
 * Global test setup for TensorFlow.js neural network tests
 *
 * This setup runs before each test to:
 * 1. Clean up any lingering TensorFlow variables from previous tests
 * 2. Ensure proper memory management
 * 3. Prevent memory leaks between tests
 */

import * as tf from '@tensorflow/tfjs';

/**
 * Clean up all TensorFlow variables and memory before each test
 * This function should be called in beforeEach hooks
 */
export function cleanupTensorFlow(): void {
  // Clean up all active tensors (those not disposed yet)
  tf.disposeVariables();

  // Force memory cleanup
  tf.tidy(() => {
    // This ensures any remaining tensors in memory are cleaned up
    tf.disposeVariables();
  });

  // Optional: Log memory usage for debugging (can be removed in production)
  const memoryInfo = tf.memory();
  if (memoryInfo.numTensors > 100) {
    console.warn(`[Test Setup] High number of tensors after cleanup: ${memoryInfo.numTensors}`);
  }
}

/**
 * Initialize TensorFlow environment before each test
 */
export function setupTensorFlow(): void {
  // Clean up before each test
  cleanupTensorFlow();
}

// Cleanup functions are already exported above
