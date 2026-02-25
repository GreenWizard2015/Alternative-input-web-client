/**
 * FaceMeshEncoder Integration Test
 *
 * Tests the complete FaceMeshEncoder pipeline:
 * - Load test data from FaceMeshEncoder.zip
 * - Run inference through FaceMeshEncoder
 * - Validate outputs match Python reference implementation
 */

import { FaceMeshEncoder } from '../FaceMeshEncoder';
import { assertTensorsClose } from './testHelpers';
import { tensorsFromZip, disposeAll } from '../utils/tensorflow';
import * as path from 'path';
import { cleanupTensorFlow } from './setup';

describe('FaceMeshEncoder - Complete Pipeline Integration', () => {
  beforeEach(() => {
    cleanupTensorFlow();
  });

  afterEach(() => {
    cleanupTensorFlow();
  });
  test('should run inference with ZIP data and validate outputs', async () => {
    // Initialize FaceMeshEncoder with correct parameters based on Python ground truth
    // FaceMeshEncoder uses latent_size=32, scale_mult=1.0
    const model = new FaceMeshEncoder({
      name: 'face_mesh_encoder',
      latentSize: 32,
      scaleMult: 1.0,
    });
    const zipPath = path.join(__dirname, './data/FaceMeshEncoder.zip');

    // Load tensors from ZIP using utility function
    const tensors = await tensorsFromZip(zipPath);
    // Build model before loading weights (like other models)
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
