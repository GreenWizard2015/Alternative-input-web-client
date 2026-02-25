/**
 * GazeModel (ModelWrapper) Integration Test
 *
 * Tests the complete GazeModel pipeline:
 * - Load test data from ModelWrapper.zip
 * - Run inference through GazeModel (JS equivalent of Python ModelWrapper)
 * - Validate outputs match Python reference implementation
 */

import { GazeModel } from '../GazeModel';
import { assertTensorsClose } from './testHelpers';
import { tensorsFromZip } from '../utils/tensorflow';
import * as path from 'path';
import { cleanupTensorFlow } from './setup';

describe('GazeModel (ModelWrapper) - Complete Pipeline Integration', () => {
  beforeEach(() => {
    cleanupTensorFlow();
  });

  afterEach(() => {
    cleanupTensorFlow();
  });
  test('should run inference with ZIP data and validate outputs', async () => {
    // Initialize GazeModel with correct parameters based on Python ModelWrapper ground truth
    const model = new GazeModel({
      latentSize: 128,
      embeddingSize: 64,
      scaleMult: 1.0,
      vocab: {
        userId: 3,
        screenId: 2,
        cameraId: 2,
        monitorId: 2,
        placeId: 2,
      },
      name: 'ModelWrapper',
    });
    const zipPath = path.join(__dirname, '../__tests__/data/ModelWrapper.zip');

    // Load tensors from ZIP using utility function
    const tensors = await tensorsFromZip(zipPath);
    // Build model first before loading weights
    model.build({
      points: tensors.get('inputs/points')!.shape,
      leftEye: tensors.get('inputs/left eye')!.shape,
      rightEye: tensors.get('inputs/right eye')!.shape,
      time: tensors.get('inputs/time')!.shape,
      userId: tensors.get('inputs/userId')!.shape,
      screenId: tensors.get('inputs/screenId')!.shape,
      cameraId: tensors.get('inputs/cameraId')!.shape,
      monitorId: tensors.get('inputs/monitorId')!.shape,
      placeId: tensors.get('inputs/placeId')!.shape,
    });
    await model.loadWeights(tensors);

    const output = model.apply(
      {
        points: tensors.get('inputs/points')!,
        leftEye: tensors.get('inputs/left eye')!,
        rightEye: tensors.get('inputs/right eye')!,
        time: tensors.get('inputs/time')!,
        userId: tensors.get('inputs/userId')!,
        screenId: tensors.get('inputs/screenId')!,
        cameraId: tensors.get('inputs/cameraId')!,
        monitorId: tensors.get('inputs/monitorId')!,
        placeId: tensors.get('inputs/placeId')!,
      },
      false
    );
    assertTensorsClose(output.result, tensors.get('outputs/predictions')!);

    // Clean up
    tensors.dispose();
    output.result.dispose();
    if (output.intermediateLatent) output.intermediateLatent.dispose();
    if (output.finalLatent) output.finalLatent.dispose();
    model.dispose();
  });
});
