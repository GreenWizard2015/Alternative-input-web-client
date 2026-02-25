/**
 * TransformerEncoderBlock Integration Test
 *
 * Tests the complete TransformerEncoderBlock pipeline:
 * - Load test data from TransformerEncoderBlock.zip
 * - Run inference through TransformerEncoderBlock
 * - Validate outputs match Python reference implementation
 */

import * as tf from '@tensorflow/tfjs';
import { TransformerEncoderBlock } from '../TransformerEncoderBlock';
import { assertTensorsClose } from './testHelpers';
import { disposeAll, TensorMap } from '../utils/tensorflow';
import { cleanupTensorFlow } from './setup';

describe('TransformerEncoderBlock - Complete Pipeline Integration', () => {
  beforeEach(() => {
    cleanupTensorFlow();
  });

  afterEach(() => {
    cleanupTensorFlow();
  });
  test('should run inference with ZIP data and validate outputs', async () => {
    // Initialize TransformerEncoderBlock with correct parameters based on Python ground truth
    // Python TransformerEncoderBlock uses d_model=64
    const model = new TransformerEncoderBlock({
      name: 'TransformerEncoderBlock_layer',
      d_model: 64,
      num_heads: 8, // Required parameter
      dropout_rate: 0,
    });
    const path = require('path');
    const zipPath = path.join(__dirname, '../__tests__/data/TransformerEncoderBlock.zip');

    // Load tensors from ZIP using utility function
    const tensorMap = await loadTensorMapFromZip(zipPath);
    model.build(tensorMap.get('inputs/input')!.shape);
    await model.loadWeights(tensorMap);

    const output = model.apply(tensorMap.get('inputs/input')!, false);
    assertTensorsClose(output, tensorMap.get('outputs/predictions')!);

    // Clean up
    disposeAll(tensorMap);
    output.dispose();
    model.dispose();
  });
});

/**
 * Load TensorMap from ZIP file (using tensorflow utility)
 */
async function loadTensorMapFromZip(zipPath: string): Promise<TensorMap> {
  const { tensorsFromZip: tensorflow } = await import('../utils/tensorflow');
  return tensorflow(zipPath);
}
