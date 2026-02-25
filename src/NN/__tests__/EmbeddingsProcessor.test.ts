/**
 * EmbeddingsProcessor Integration Test
 *
 * Tests the complete EmbeddingsProcessor pipeline:
 * - Load test data from EmbeddingsProcessor.zip
 * - Run inference through EmbeddingsProcessor
 * - Validate outputs match Python reference implementation
 */

import { EmbeddingsProcessor } from '../EmbeddingsProcessor';
import { assertTensorsClose } from './testHelpers';
import { tensorsFromZip, disposeAll } from '../utils/tensorflow';
import * as path from 'path';
import { cleanupTensorFlow } from './setup';

describe('EmbeddingsProcessor - Complete Pipeline Integration', () => {
  beforeEach(() => {
    cleanupTensorFlow();
  });

  afterEach(() => {
    cleanupTensorFlow();
  });
  test('should run inference with ZIP data and validate outputs', async () => {
    // Initialize EmbeddingsProcessor with correct parameters based on Python ground truth
    // EmbeddingsProcessor uses timesteps=10 (EYE_FACEMESH_SEQUENCE_LENGTH), embedding_size=64
    const model = new EmbeddingsProcessor({
      name: 'embeddings_processor',
      timesteps: 3,
      embeddingSize: 32,
      mixingMethod: 'attention',
    });
    const zipPath = path.join(__dirname, './data/EmbeddingsProcessor.zip');

    // Load tensors from ZIP using utility function
    const tensors = await tensorsFromZip(zipPath);
    // Build model before loading weights (like other models)
    model.build(tensors.get('inputs/concatenated_embeddings')!.shape);
    await model.loadWeights(tensors);

    const output = model.apply(tensors.get('inputs/concatenated_embeddings')!, false);
    assertTensorsClose(output, tensors.get('outputs/predictions')!);

    // Clean up
    tensors.get('inputs/shape');
    tensors.dispose();
    output.dispose();
    model.dispose();
  });
});
