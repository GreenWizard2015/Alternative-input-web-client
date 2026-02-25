/**
 * EyeEncoderStage Integration Test
 *
 * Tests a single stage of the EyeEncoder pipeline:
 * - Load test data from EyeEncoderStage.zip
 * - Run inference through EyeEncoderStage
 * - Validate outputs match Python reference implementation
 *
 * NOTE: EyeEncoderStage.zip contains weights for a simplified encoder stage
 * This tests a single scale processing component of the multi-scale pipeline
 */

import { EyeEncoderStage } from '../EyeEncoderStage';
import { disposeAll, tensorsFromZip } from '../utils/tensorflow';
import { assertTensorsClose } from './testHelpers';
import { cleanupTensorFlow } from './setup';

describe('EyeEncoderStage - Single Stage Pipeline Integration', () => {
  beforeEach(() => {
    cleanupTensorFlow();
  });

  afterEach(() => {
    cleanupTensorFlow();
  });
  test('should run inference with ZIP data and validate outputs', async () => {
    // Initialize EyeEncoderStage with correct parameters based on test data
    // Name must match ZIP file: 'eye_encoder_stage'
    const model = new EyeEncoderStage({
      name: 'eye_encoder_stage',
      latentSize: 32, // From shapes.json
      numFilters: 32, // Match Python export
    });

    const path = require('path');
    const zipPath = path.join(__dirname, './data/EyeEncoderStage.zip');

    // Load tensors from ZIP using existing utility function
    const tensors = await tensorsFromZip(zipPath);
    // Build and load weights
    model.build(tensors.get('inputs/inputs')!.shape);
    await model.loadWeights(tensors);

    const output = model.apply(tensors.get('inputs/inputs')!, false);

    assertTensorsClose(output[0], tensors.get('outputs/feature_map')!); // output[0] = featureMap
    assertTensorsClose(output[1], tensors.get('outputs/latent')!); // output[1] = latent

    // Clean up
    tensors.dispose();
    disposeAll(output);
    model.dispose();
  });
});
