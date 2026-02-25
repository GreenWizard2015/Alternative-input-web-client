/**
 * ConvPE Integration Test
 *
 * Tests the complete ConvPE pipeline:
 * - Load test data from ConvPE.zip
 * - Run inference through ConvPE
 * - Validate outputs match Python reference implementation
 */

import { ConvPE } from '../ConvPE';
import { assertTensorsClose } from './testHelpers';
import { tensorsFromZip, disposeAll } from '../utils/tensorflow';
import { cleanupTensorFlow } from './setup';

describe('ConvPE - Complete Pipeline Integration', () => {
  beforeEach(() => {
    cleanupTensorFlow();
  });

  afterEach(() => {
    cleanupTensorFlow();
  });
  test('should run inference with ZIP data and validate outputs', async () => {
    // Initialize ConvPE with correct parameters based on Python ground truth
    // ConvPE uses channels=32 by default (matches Python weights)
    // Name must match ZIP file: 'ConvPE_layer' not 'ConvPE'
    const model = new ConvPE({ channels: 32, name: 'ConvPE_layer' });
    const path = require('path');
    const zipPath = path.join(__dirname, '../__tests__/data/ConvPE.zip');

    // Load tensors from ZIP using utility function
    const tensors = await tensorsFromZip(zipPath);
    model.build(tensors.get('inputs/input')!.shape);
    await model.loadWeights(tensors);

    // Apply ConvPE to input
    const output = model.apply(tensors.get('inputs/input')!, false);
    assertTensorsClose(output, tensors.get('outputs/predictions')!);

    // Clean up
    tensors.dispose();
    output.dispose();
    model.dispose();
  });
});
