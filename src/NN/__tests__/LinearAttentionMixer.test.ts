/**
 * LinearAttentionMixer Integration Test
 *
 * Tests the complete LinearAttentionMixer pipeline:
 * - Load test data from LinearAttentionMixer.zip
 * - Run inference through LinearAttentionMixer
 * - Validate outputs match Python reference implementation
 */

import { LinearAttentionMixer } from '../LinearAttentionMixer';
import { assertTensorsClose } from './testHelpers';
import { tensorsFromZip, disposeAll } from '../utils/tensorflow';
import { cleanupTensorFlow } from './setup';

describe('LinearAttentionMixer - Complete Pipeline Integration', () => {
  beforeEach(() => {
    cleanupTensorFlow();
  });

  afterEach(() => {
    cleanupTensorFlow();
  });
  test('should run inference with ZIP data and validate outputs', async () => {
    // Initialize LinearAttentionMixer with correct parameters based on Python ground truth
    // Python LinearAttentionMixer uses default constructor
    const model = new LinearAttentionMixer({
      name: 'LinearAttentionMixer_layer',
    });
    const path = require('path');
    const zipPath = path.join(__dirname, '../__tests__/data/LinearAttentionMixer.zip');

    // Load tensors from ZIP using utility function
    const tensors = await tensorsFromZip(zipPath);
    model.build(tensors.get('inputs/input')!.shape);
    await model.loadWeights(tensors);

    const output = model.apply(tensors.get('inputs/input')!, false);
    assertTensorsClose(output, tensors.get('outputs/predictions')!);

    // Clean up
    tensors.dispose();
    output.dispose();
    model.dispose();
  });
});
