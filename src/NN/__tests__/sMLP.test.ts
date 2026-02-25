/**
 * sMLP Integration Test
 *
 * Tests the complete sMLP pipeline:
 * - Load test data from sMLP.zip
 * - Run inference through sMLP
 * - Validate outputs match Python reference implementation
 *
 * NOTE: sMLP.zip contains only input/output tensors, no weights
 * This test validates the architecture and forward pass work correctly
 */

import { sMLP } from '../sMLP';
import { assertTensorsClose } from './testHelpers';
import { tensorsFromZip, disposeAll } from '../utils/tensorflow';
import { cleanupTensorFlow } from './setup';

describe('sMLP - Complete Pipeline Integration', () => {
  beforeEach(() => {
    cleanupTensorFlow();
  });

  afterEach(() => {
    cleanupTensorFlow();
  });
  test('should run inference with ZIP data and validate outputs', async () => {
    // Initialize sMLP with correct parameters based on Python ground truth
    // Python sMLP uses sizes=[64, 32] which means 2 layers: 64→32→32
    const model = new sMLP({
      name: 'sMLP_layer',
      sizes: [64, 32],
      activation: 'linear',
      dropout: 0.0,
    });
    const path = require('path');
    const zipPath = path.join(__dirname, '../__tests__/data/sMLP.zip');

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
