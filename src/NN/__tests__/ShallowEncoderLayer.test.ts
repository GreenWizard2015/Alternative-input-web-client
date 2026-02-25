/**
 * ShallowEncoderLayer Integration Test
 *
 * Tests the complete ShallowEncoderLayer pipeline:
 * - Load test data from ShallowEncoderLayer.zip
 * - Run inference through ShallowEncoderLayer
 * - Validate outputs match Python reference implementation
 */

import { ShallowEncoderLayer } from '../ShallowEncoderLayer';
import { disposeAll, tensorsFromZip } from '../utils/tensorflow';
import { assertTensorsClose } from './testHelpers';
import { cleanupTensorFlow } from './setup';

describe('ShallowEncoderLayer - Complete Pipeline Integration', () => {
  beforeEach(() => {
    cleanupTensorFlow();
  });

  afterEach(() => {
    cleanupTensorFlow();
  });
  test('should run inference with ZIP data and validate outputs', async () => {
    // Initialize ShallowEncoderLayer with correct parameters based on Python ground truth
    // Python ShallowEncoderLayer uses default constructor
    const model = new ShallowEncoderLayer({
      name: 'ShallowEncoderLayer_layer',
    });
    const path = require('path');
    const zipPath = path.join(__dirname, '../__tests__/data/ShallowEncoderLayer.zip');

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
