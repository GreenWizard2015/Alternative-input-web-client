/**
 * LearnablePositionalEncoding Integration Test
 *
 * Tests the complete LearnablePositionalEncoding pipeline:
 * - Load test data from LearnablePositionalEncoding.zip
 * - Run inference through LearnablePositionalEncoding
 * - Validate outputs match Python reference implementation
 */

import { LearnablePositionalEncoding } from '../PositionalEncodings';
import { assertTensorsClose } from './testHelpers';
import { tensorsFromZip, disposeAll } from '../utils/tensorflow';
import { cleanupTensorFlow } from './setup';

describe('LearnablePositionalEncoding - Complete Pipeline Integration', () => {
  beforeEach(() => {
    cleanupTensorFlow();
  });

  afterEach(() => {
    cleanupTensorFlow();
  });
  test('should run inference with ZIP data and validate outputs', async () => {
    // Initialize LearnablePositionalEncoding with correct parameters
    const model = new LearnablePositionalEncoding({
      channels: 32, // Match actual weights shape
      name: 'LearnablePositionalEncoding_layer',
    });
    const path = require('path');
    const zipPath = path.join(__dirname, '../__tests__/data/LearnablePositionalEncoding.zip');

    // Load tensors from ZIP using utility function
    const tensors = await tensorsFromZip(zipPath);

    // Build the layer based on input shape
    const inputShape = tensors.get('inputs/input')!.shape as number[];
    model.build(inputShape);

    // Load weights
    await model.loadWeights(tensors);

    const output = model.apply(tensors.get('inputs/input')!, false);
    assertTensorsClose(output, tensors.get('outputs/predictions')!);

    // Clean up
    tensors.dispose();
    output.dispose();
    model.dispose();
  });
});
