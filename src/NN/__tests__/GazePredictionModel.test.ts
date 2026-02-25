/**
 * GazePredictionModel Integration Test
 *
 * Tests the complete GazePredictionModel pipeline:
 * - Load test data from GazePredictionModel.zip
 * - Run inference through GazePredictionModel
 * - Validate outputs match Python reference implementation
 */

import { GazePredictionModel } from '../GazePredictionModel';
import * as tf from '@tensorflow/tfjs';
import { assertTensorsClose } from './testHelpers';
import { tensorsFromZip, disposeAll } from '../utils/tensorflow';
import { TEMPORAL_TIMESTEPS, FACE_MESH_POINTS } from '../Constants';
import * as path from 'path';
import { cleanupTensorFlow } from './setup';

describe('GazePredictionModel - Complete Pipeline Integration', () => {
  beforeEach(() => {
    cleanupTensorFlow();
  });

  afterEach(() => {
    cleanupTensorFlow();
  });
  test('should run inference with ZIP data and validate outputs', async () => {
    // Initialize GazePredictionModel with parameters that match the weight creation
    const model = new GazePredictionModel({
      name: 'gaze_prediction_model',
      latentSize: 64,
      scaleMult: 1.0,
    });
    const zipPath = path.join(__dirname, '../__tests__/data/GazePredictionModel.zip');

    // Load tensors from ZIP using the utility function
    const tensors = await tensorsFromZip(zipPath);

    // Log input shapes before building
    console.log('Input tensor shapes:');
    console.log('points:', tensors.get('inputs/points')!.shape);
    console.log('left eye:', tensors.get('inputs/left eye')!.shape);
    console.log('right eye:', tensors.get('inputs/right eye')!.shape);
    console.log('time:', tensors.get('inputs/time')!.shape);
    console.log('embeddings:', tensors.get('inputs/embeddings')!.shape);

    model.build({
      points: tensors.get('inputs/points')!.shape,
      leftEye: tensors.get('inputs/left eye')!.shape,
      rightEye: tensors.get('inputs/right eye')!.shape,
      time: tensors.get('inputs/time')!.shape,
      embeddings: tensors.get('inputs/embeddings')!.shape,
    });

    // Load weights from the ZIP data
    await model.loadWeights(tensors);

    const output = model.apply(
      {
        points: tensors.get('inputs/points'),
        leftEye: tensors.get('inputs/left eye'),
        rightEye: tensors.get('inputs/right eye'),
        time: tensors.get('inputs/time'),
        embeddings: tensors.get('inputs/embeddings'),
      },
      false
    );

    assertTensorsClose(output.intermediateLatent, tensors.get('outputs/intermediate_latent')!);
    assertTensorsClose(output.finalLatent, tensors.get('outputs/final_latent')!);

    // Clean up
    tensors.dispose();
    output.intermediateLatent.dispose();
    output.finalLatent.dispose();
    model.dispose();
  });
});
