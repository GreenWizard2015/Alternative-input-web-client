/**
 * MultiHeadAttention Integration Test
 *
 * Tests the complete MultiHeadAttention pipeline:
 * - Load test data from MultiHeadAttention.zip
 * - Run inference through MultiHeadAttention
 * - Validate outputs match Python reference implementation
 */

import { MultiHeadAttention } from '../MultiHeadAttention';
import { assertTensorsClose } from './testHelpers';
import { tensorsFromZip, disposeAll } from '../utils/tensorflow';
import * as path from 'path';
import { cleanupTensorFlow } from './setup';

describe('MultiHeadAttention - Complete Pipeline Integration', () => {
  beforeEach(() => {
    cleanupTensorFlow();
  });

  afterEach(() => {
    cleanupTensorFlow();
  });
  test('should run inference with ZIP data and validate outputs', async () => {
    // Initialize MultiHeadAttention with correct parameters based on Python ground truth
    // Python MultiHeadAttention uses d_model=64
    const model = new MultiHeadAttention({
      name: 'MultiHeadAttention_layer',
      featureSize: 64,
      nHeads: 8,
      hypersphere: false,
    });
    const zipPath = path.join(__dirname, '../__tests__/data/MultiHeadAttention.zip');

    // Load tensors from ZIP using utility function
    const tensors = await tensorsFromZip(zipPath);
    model.build(
      tensors.get('inputs/query')!.shape,
      tensors.get('inputs/key')!.shape,
      tensors.get('inputs/value')!.shape
    );
    await model.loadWeights(tensors);

    const output = model.apply(
      tensors.get('inputs/query')!,
      tensors.get('inputs/key')!,
      tensors.get('inputs/value')!,
      false,
      undefined
    );
    assertTensorsClose(output, tensors.get('outputs/predictions')!);

    // Clean up
    tensors.dispose();
    output.dispose();
    model.dispose();
  });
});
