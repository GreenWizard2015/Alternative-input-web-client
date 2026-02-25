/**
 * EmbeddingsTable Integration Test
 *
 * Tests the complete EmbeddingsTable pipeline:
 * - Load test data from EmbeddingsTable.zip
 * - Run inference through EmbeddingsTable
 * - Validate outputs match Python reference implementation
 */

import { EmbeddingsTable } from '../EmbeddingsTable';
import { assertTensorsClose } from './testHelpers';
import { tensorsFromZip, disposeAll } from '../utils/tensorflow';
import * as path from 'path';
import { cleanupTensorFlow } from './setup';

describe('EmbeddingsTable - Complete Pipeline Integration', () => {
  beforeEach(() => {
    cleanupTensorFlow();
  });

  afterEach(() => {
    cleanupTensorFlow();
  });
  test('should run inference with ZIP data and validate outputs', async () => {
    // Initialize EmbeddingsTable with correct parameters based on Python ground truth
    // EmbeddingsTable uses vocab sizes for userId, screenId, cameraId, monitorId, placeId
    const model = new EmbeddingsTable({
      config: {
        userId: 2,
        screenId: 2,
        cameraId: 2,
        monitorId: 2,
        placeId: 2,
      },
      embeddingSize: 32,
      name: '',
    });
    const zipPath = path.join(__dirname, './data/EmbeddingsTable.zip');

    // Load tensors from ZIP using utility function
    const tensors = await tensorsFromZip(zipPath);

    // Build model before loading weights (like other models)
    model.build(tensors.get('inputs/userId')!.shape);
    await model.loadWeights(tensors);

    // Prepare inputs (all ID tensors are optional)
    const inputs = {
      userId: tensors.get('inputs/userId'),
      screenId: tensors.get('inputs/screenId'),
      cameraId: tensors.get('inputs/cameraId'),
      monitorId: tensors.get('inputs/monitorId'),
      placeId: tensors.get('inputs/placeId'),
    };

    const output = model.apply(inputs, {}, [1, 1]);
    assertTensorsClose(output, tensors.get('outputs/predictions')!);

    // Clean up
    tensors.get('inputs/shape');
    tensors.dispose();
    output.dispose();
    model.dispose();
  });
});
