/**
 * Step2LatentModel Integration Test
 *
 * Tests the complete Step2LatentModel pipeline:
 * - Load test data from Step2LatentModel.zip
 * - Run inference through Step2LatentModel
 * - Validate outputs match Python reference implementation
 *
 * NOTE: Step2LatentModel.zip contains only input/output tensors, no weights
 * This test validates the architecture and forward pass work correctly
 */

import { Step2LatentModel } from '../Step2LatentModel';
import { assertTensorsClose } from './testHelpers';
import { tensorsFromZip, disposeAll } from '../utils/tensorflow';
import * as path from 'path';
import { cleanupTensorFlow } from './setup';

describe('Step2LatentModel - Complete Pipeline Integration', () => {
  beforeEach(() => {
    cleanupTensorFlow();
  });

  afterEach(() => {
    cleanupTensorFlow();
  });
  test('should run inference with ZIP data and validate outputs', async () => {
    // Initialize Step2LatentModel with correct parameters based on actual input dimensions
    const model = new Step2LatentModel({
      name: 'step2_latent_model',
      latentSize: 32, // Matches actual input tensor dimension [2,5,32]
      scaleMult: 1.0,
    });
    const zipPath = path.join(__dirname, './data/Step2LatentModel.zip');

    // Load tensors from ZIP using utility function
    const tensors = await tensorsFromZip(zipPath);

    // Build model first before loading weights
    model.build({
      latent: tensors.get('inputs/latent')!.shape,
      time: tensors.get('inputs/time')!.shape,
      embeddings: tensors.get('inputs/embeddings')!.shape,
    });

    await model.loadWeights(tensors);

    const output = model.apply(
      {
        latent: tensors.get('inputs/latent')!,
        time: tensors.get('inputs/time')!,
        embeddings: tensors.get('inputs/embeddings')!,
      },
      false
    );
    assertTensorsClose(output, tensors.get('outputs/predictions')!);

    // Clean up
    tensors.dispose();
    output.dispose();
    model.dispose();
  });
});
