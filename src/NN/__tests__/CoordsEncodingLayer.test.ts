/**
 * CoordsEncodingLayer Integration Test
 *
 * Tests the complete CoordsEncodingLayer pipeline:
 * - Load test data from CoordsEncodingLayer.zip
 * - Run inference through CoordsEncodingLayer
 * - Validate outputs match Python reference implementation
 */

import { CoordsEncodingLayer } from '../CoordsEncodingLayer';
import { assertTensorsClose } from './testHelpers';
import { tensorsFromZip, disposeAll } from '../utils/tensorflow';
import { cleanupTensorFlow } from './setup';

describe('CoordsEncodingLayer - Complete Pipeline Integration', () => {
  beforeEach(() => {
    cleanupTensorFlow();
  });

  afterEach(() => {
    cleanupTensorFlow();
  });
  test('should run inference with ZIP data and validate outputs', async () => {
    // Initialize CoordsEncodingLayer with correct parameters based on Python ground truth
    // Python CoordsEncodingLayer uses N=32, internalN=32 (freq_deltas has shape [32])
    const model = new CoordsEncodingLayer({
      name: 'CoordsEncodingLayer_layer',
      N: 32,
      hiddenN: 1.0, // Match actual internal dimension from weights
      raw: true,
    });

    const path = require('path');
    const zipPath = path.join(__dirname, '../__tests__/data/CoordsEncodingLayer.zip');

    // Load tensors from ZIP using utility function
    const tensors = await tensorsFromZip(zipPath);

    model.build(tensors.get('inputs/input')!.shape);
    // Load weights after building
    await model.loadWeights(tensors);

    const output = model.apply(tensors.get('inputs/input')!, false);
    assertTensorsClose(output, tensors.get('outputs/predictions')!);

    // Clean up
    tensors.dispose();
    output.dispose();
    model.dispose();
  });
});
