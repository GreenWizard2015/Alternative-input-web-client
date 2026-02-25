/**
 * EyeEncoder Integration Test
 *
 * Tests the complete EyeEncoder pipeline:
 * - Load test data from EyeEncoder.zip
 * - Run inference through EyeEncoder
 * - Validate outputs match Python reference implementation
 */

import { EyeEncoder } from '../EyeEncoder';
import { disposeAll, tensorsFromZip } from '../utils/tensorflow';
import { assertTensorsClose } from './testHelpers';
import * as tf from '@tensorflow/tfjs';
import { cleanupTensorFlow } from './setup';

describe('EyeEncoder - Complete Pipeline Integration', () => {
  beforeEach(() => {
    cleanupTensorFlow();
  });

  afterEach(() => {
    cleanupTensorFlow();
  });
  test('should run inference with ZIP data and validate outputs', async () => {
    // Initialize EyeEncoder with correct parameters based on Python ground truth
    // Python EyeEncoder uses latent_size=32, scale_mult=1.0
    // Name must match ZIP file: 'eye_encoder' not 'EyeEncoder'
    const model = new EyeEncoder({
      name: 'eye_encoder',
      latentSize: 32,
      scaleMult: 1.0,
    });
    const path = require('path');
    const zipPath = path.join(__dirname, '../__tests__/data/EyeEncoder.zip');

    // Load tensors from ZIP using utility function
    const tensors = await tensorsFromZip(zipPath);

    // Build the model first (required for weight loading)
    model.build([tensors.get('inputs/left_eye')!.shape, tensors.get('inputs/right_eye')!.shape]);
    // Load weights using fixed naming patterns
    await model.loadWeights(tensors);

    const output = model.apply(
      [tensors.get('inputs/left_eye')!, tensors.get('inputs/right_eye')!],
      false
    );
    assertTensorsClose(output, tensors.get('outputs/predictions')!);

    // Clean up
    tensors.dispose();
    output.dispose();
    model.dispose();
  });
});
