/**
 * EyeEncoderConv Integration Test
 *
 * Tests the complete EyeEncoderConv pipeline:
 * - Load test data from EyeEncoderConv.zip
 * - Run inference through EyeEncoderConv
 * - Validate outputs match Python reference implementation
 */

import { EyeEncoderConv } from '../EyeEncoderConv';
import { disposeAll, tensorsFromZip } from '../utils/tensorflow';
import { assertTensorsClose } from './testHelpers';
import { cleanupTensorFlow } from './setup';

describe('EyeEncoderConv - Complete Pipeline Integration', () => {
  beforeEach(() => {
    cleanupTensorFlow();
  });

  afterEach(() => {
    cleanupTensorFlow();
  });
  test('should run inference with ZIP data and validate outputs', async () => {
    // Initialize EyeEncoderConv with correct parameters based on Python ground truth
    // Python EyeEncoderConv uses latent_size=256, scale_mult=1.0
    // Name must match ZIP file: 'eye_encoder_conv' not 'EyeEncoderConv'
    const model = new EyeEncoderConv({
      name: 'eye_encoder_conv',
      latentSize: 32,
      scaleMult: 1.0,
    });
    const path = require('path');
    const zipPath = path.join(__dirname, '../__tests__/data/EyeEncoderConv.zip');

    // Load tensors from ZIP using utility function
    const tensors = await tensorsFromZip(zipPath);
    model.build(tensors.get('inputs/eyes_input')!.shape);
    // Load weights using fixed naming patterns
    await model.loadWeights(tensors);

    // Apply model (returns array of tensors)
    const outputArray = model.apply(tensors.get('inputs/eyes_input')!);
    // Check that we have the expected number of outputs
    expect(outputArray.length).toBeGreaterThan(0);

    // Compare each output tensor with corresponding ground truth
    for (let i = 0; i < outputArray.length; i++) {
      const expectedOutput = tensors.get(`outputs/scale_${i}_latent`)!;
      assertTensorsClose(outputArray[i], expectedOutput);
    }

    // Clean up
    tensors.dispose();
    disposeAll(outputArray);
    model.dispose();
  });
});
