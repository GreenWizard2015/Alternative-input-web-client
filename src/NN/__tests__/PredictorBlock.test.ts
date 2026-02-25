/**
 * PredictorBlock Integration Test
 *
 * Tests the complete PredictorBlock pipeline:
 * - Load test data from PredictorBlock.zip
 * - Run inference through PredictorBlock
 * - Validate outputs match Python reference implementation
 *
 * NOTE: PredictorBlock.zip contains only input/output tensors, no weights
 * This test validates the architecture and forward pass work correctly
 */

import * as tf from '@tensorflow/tfjs';
import { PredictorBlock } from '../PredictorBlock';
import { assertTensorsClose } from './testHelpers';
import { tensorsFromZip, disposeAll } from '../utils/tensorflow';
import { cleanupTensorFlow } from './setup';

describe('PredictorBlock - Complete Pipeline Integration', () => {
  beforeEach(() => {
    cleanupTensorFlow();
  });

  afterEach(() => {
    cleanupTensorFlow();
  });

  test('should run inference with ZIP data and validate outputs', async () => {
    // Initialize PredictorBlock with correct parameters based on Python ground truth
    const model = new PredictorBlock({
      latentSize: 64, // Matches the latent size from GazePredictionModel
      name: 'PredictorBlock',
    });

    const path = require('path');
    const zipPath = path.join(__dirname, '../__tests__/data/PredictorBlock.zip');

    // Load tensors from ZIP using utility function
    const tensors = await tensorsFromZip(zipPath);

    // Build the model with input shapes
    model.build({
      latents: tensors.get('inputs/input')!.shape,
    });

    // Load weights (even though we're testing with ZIP data, the loadWeights method sets up the structure)
    await model.loadWeights(tensors);

    // Test the pipeline with loaded data
    const inputs = {
      latents: tensors.get('inputs/input')!,
    };

    const output = model.apply(inputs, false);
    assertTensorsClose(output.result, tensors.get('outputs/result')!);

    // Clean up
    tensors.dispose();
    output.result.dispose();
    model.dispose();
  });
});
