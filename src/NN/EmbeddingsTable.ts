/**
 * EmbeddingsTable - Lookup table for categorical ID embeddings.
 *
 * Implements the same functionality as the Python EmbeddingsTable:
 * - Manages 5 separate embedding layers for userId, screenId, cameraId, monitorId, placeId
 * - Takes categorical IDs as input, returns concatenated embedding vectors
 * - Outputs shape: [batch, 1, 5 * embeddingSize]
 *
 * Usage:
 * ```typescript
 * const table = new EmbeddingsTable(vocab, embeddingSize);
 * await table.loadWeights('embeddingsTable.zip');
 * const embeddings = table.call(inputs);
 * ```
 */

import * as tf from '@tensorflow/tfjs';
import * as tfl from '@tensorflow/tfjs-layers';
import { TensorMap, disposeAll, hashCode } from './utils/tensorflow';

export interface EmbeddingsConfig {
  userId: number;
  screenId: number;
  cameraId: number;
  monitorId: number;
  placeId: number;
}

export interface EmbeddingsTableConfig {
  config: EmbeddingsConfig;
  embeddingSize?: number;
  name?: string;
}

export interface EmbeddingsInputs {
  userId?: tf.Tensor;
  screenId?: tf.Tensor;
  cameraId?: tf.Tensor;
  monitorId?: tf.Tensor;
  placeId?: tf.Tensor;
}

export interface DefaultIds {
  userId: number;
  screenId: number;
  cameraId: number;
  monitorId: number;
  placeId: number;
}

const HIERARCHY_LEVELS = ['userId', 'screenId', 'cameraId', 'monitorId', 'placeId'] as const;
type HierarchyLevel = (typeof HIERARCHY_LEVELS)[number];

export class EmbeddingsTable {
  private config: EmbeddingsConfig;
  private embeddingSize: number;
  private embeddings: Record<HierarchyLevel, tfl.layers.Layer>;
  private defaultIds: DefaultIds;
  private built: boolean = false;
  name: string;
  private namePrefix: string;

  constructor(config: EmbeddingsTableConfig) {
    this.config = config.config;
    this.embeddingSize = config.embeddingSize || 64;
    this.name = config.name;
    this.namePrefix = `${hashCode(this.name)}_`;

    // Initialize default IDs to 0 for all ID types
    this.defaultIds = {
      userId: 0,
      screenId: 0,
      cameraId: 0,
      monitorId: 0,
      placeId: 0,
    };

    // Create embedding layers for each ID type
    this.embeddings = {} as Record<HierarchyLevel, tfl.layers.Layer>;

    HIERARCHY_LEVELS.forEach(level => {
      this.embeddings[level] = tfl.layers.embedding({
        inputDim: this.config[level],
        outputDim: this.embeddingSize,
        inputLength: 1,
        name: `${this.namePrefix}${level}_embedding`,
      });
    });
  }

  /**
   * Load weights using exact pattern matching - NO SEARCHING
   */
  async loadWeights(weightsMap: TensorMap): Promise<void> {
    if (!this.built) {
      throw new Error(
        `EmbeddingsTable.${this.name} not built. Call build() first before loadWeights().`
      );
    }

    console.log(`[EmbeddingsTable.${this.name}] Loading weights`);
    const name = this.name ? `${this.name}/` : '';

    // Load weights for each embedding layer using exact pattern matching - NO SEARCHING
    HIERARCHY_LEVELS.forEach(level => {
      const kernelKey = `weights/${name}${level}_embedding/embeddings`;
      const kernel = weightsMap.get(kernelKey);
      if (!kernel) {
        throw new Error(
          `[EmbeddingsTable.${this.name}] ${level} embeddings not found at key: ${kernelKey}`
        );
      }

      const layer = this.embeddings[level];
      layer.setWeights([kernel]);
      console.log(`[EmbeddingsTable.${this.name}] ${level}: ✓ Set weights (${kernel.shape})`);
    });

    console.log(`[EmbeddingsTable.${this.name}] All weights loaded`);
  }

  /**
   * Forward pass - lookup embeddings for input IDs.
   *
   * @param inputs - Input tensors for each ID type
   * @param defaultIds - Default values for missing ID tensors (optional)
   * @param shape - Expected shape [batchSize, timesteps] (optional)
   * @returns Concatenated embeddings of shape [batchSize, 1, 5 * embeddingSize]
   */
  apply(
    inputs: EmbeddingsInputs,
    defaultIds: Partial<DefaultIds> = {},
    shape: [number, number] = [1, 1]
  ): tf.Tensor {
    if (!this.built) {
      throw new Error(`EmbeddingsTable.${this.name} not built. Call build() first before apply().`);
    }

    // Update default IDs if provided
    this.defaultIds = { ...this.defaultIds, ...defaultIds };

    const batchSize = shape[0];
    const embeddingsList: tf.Tensor[] = [];

    HIERARCHY_LEVELS.forEach(level => {
      let inputTensor = inputs[level];

      // Handle missing inputs by using defaults
      if (inputTensor == null) {
        inputTensor = tf.fill([batchSize, 1], this.defaultIds[level]);
      }

      // Ensure tensor is 2D [batchSize, 1]
      if (inputTensor.shape.length > 2) {
        // Take first timestep and squeeze last dimension: [batch, timesteps, 1] -> [batch, 1]
        inputTensor = inputTensor.slice([0, 0, 0], [-1, 1, -1]).squeeze([2]);
      }

      // Lookup embedding
      const embedding = this.embeddings[level].apply(inputTensor) as tf.Tensor;

      // Clean up input tensor after use
      inputTensor.dispose();

      embeddingsList.push(embedding);
    });

    // Concatenate all embeddings along the last axis
    const result = tf.concat(embeddingsList, -1);

    // Clean up individual embedding tensors
    embeddingsList.forEach(tensor => tensor.dispose());

    return result;
  }

  /**
   * Get model configuration.
   */
  getConfig(): { config: EmbeddingsConfig; embeddingSize: number } {
    return {
      config: this.config,
      embeddingSize: this.embeddingSize,
    };
  }

  /**
   * Dispose all resources and clean up model.
   * Only disposes layers that have been built (called at least once).
   */
  /**
   * Build computational graph
   */
  build(inputShape: number[]): void {
    if (this.built) {
      console.warn('EmbeddingsTable already built. Skipping.');
      return;
    }

    console.log(`[EmbeddingsTable.${this.name}] Building model with dummy input`);

    // Create dummy inputs for each embedding type
    const dummyInputs: EmbeddingsInputs = {};
    HIERARCHY_LEVELS.forEach(level => {
      dummyInputs[level as keyof EmbeddingsInputs] = tf.zeros([1, 1], 'int32');
    });

    // Set built flag first to allow apply() to work during build
    this.built = true;
    const dummyOutput = this.apply(dummyInputs);
    disposeAll(Object.values(dummyInputs));
    dummyOutput.dispose();
    console.log(`[EmbeddingsTable.${this.name}] Model built successfully`);
  }

  dispose(): void {
    const embeddingsToDispose = HIERARCHY_LEVELS.map(level => this.embeddings[level]);
    disposeAll(embeddingsToDispose);
    HIERARCHY_LEVELS.forEach(level => {
      this.embeddings[level] = null as any;
    });
  }
}
