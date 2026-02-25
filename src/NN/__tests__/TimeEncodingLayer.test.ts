/**
 * TimeEncodingLayer Integration Test
 *
 * Tests the complete TimeEncodingLayer pipeline:
 * - Load test data from TimeEncodingLayer.zip
 * - Run inference through TimeEncodingLayer
 * - Validate outputs match Python reference implementation
 */

import { TimeEncodingLayer } from '../TimeEncodingLayer';
import { assertTensorsClose } from './testHelpers';
import { tensorsFromZip, disposeAll } from '../utils/tensorflow';
import { cleanupTensorFlow } from './setup';

describe('TimeEncodingLayer - Complete Pipeline Integration', () => {
  beforeEach(() => {
    cleanupTensorFlow();
  });

  afterEach(() => {
    cleanupTensorFlow();
  });
  test('should run inference with ZIP data and validate outputs', async () => {
    // Initialize TimeEncodingLayer with correct parameters based on Python ground truth
    // Python TimeEncodingLayer uses default constructor
    const model = new TimeEncodingLayer({
      name: 'TimeEncodingLayer_layer',
    });
    const path = require('path');
    const zipPath = path.join(__dirname, '../__tests__/data/TimeEncodingLayer.zip');

    // Load tensors from ZIP using utility function
    const tensors = await tensorsFromZip(zipPath);

    // Build model first with correct input shape
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
