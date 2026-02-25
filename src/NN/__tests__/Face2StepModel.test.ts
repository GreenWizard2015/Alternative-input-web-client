/**
 * Face2StepModel Integration Test
 *
 * Tests the complete Face2StepModel pipeline:
 * - Load test data from Face2StepModel.zip
 * - Run inference through Face2StepModel
 * - Validate outputs match Python reference implementation
 */

import { Face2StepModel, Face2StepModelInputs } from '../Face2StepModel';
import { assertTensorsClose } from './testHelpers';
import { tensorsFromZip, disposeAll } from '../utils/tensorflow';
import * as path from 'path';
import { cleanupTensorFlow } from './setup';

describe('Face2StepModel - Complete Pipeline Integration', () => {
  beforeEach(() => {
    cleanupTensorFlow();
  });

  afterEach(() => {
    cleanupTensorFlow();
  });
  test('should run inference with ZIP data and validate outputs', async () => {
    // Initialize Face2StepModel with correct parameters based on Python ground truth
    // Python Face2StepModel uses latent_size=32, scale_mult=1.0
    const model = new Face2StepModel({
      name: 'face2_step_model',
      latentSize: 32,
      scaleMult: 1.0,
    });
    const zipPath = path.join(__dirname, './data/Face2StepModel.zip');

    // Build model first before loading weights - use the actual input shape from ZIP data
    // Using the shape from points tensor: [2, 1, 478, 2]
    const inputShapes: Face2StepModelInputs<number[]> = {
      points: [2, 1, 478, 2],
      leftEye: [2, 1, 32, 32, 1],
      rightEye: [2, 1, 32, 32, 1],
      embeddings: [2, 1, 32],
    };
    model.build(inputShapes);

    // Load tensors from ZIP using utility function
    const tensors = await tensorsFromZip(zipPath);
    await model.loadWeights(tensors);

    const output = model.apply(
      {
        points: tensors.get('inputs/points')!,
        leftEye: tensors.get('inputs/left eye')!,
        rightEye: tensors.get('inputs/right eye')!,
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
