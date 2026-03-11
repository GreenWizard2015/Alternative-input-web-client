/**
 * EmbeddingsProcessor - Processes concatenated embeddings from EmbeddingsTable.
 *
 * Implements:
 * - Takes input [batch, 1, 5*embedding_size] (concatenated from 5 tables)
 * - Applies mixing (dense or attention) → [batch, 1, embedding_size]
 * - Performs temporal expansion → [batch, timesteps, embedding_size]
 * - Applies final dense transformation with tanh activation
 *
 * Usage:
 * ```typescript
 * const processor = new EmbeddingsProcessor({
 *   timesteps: 5,
 *   embeddingSize: 64,
 *   mixingMethod: 'attention'
 * });
 * const result = processor.apply(concatenatedEmbeddings);
 * ```
 */

import * as tf from '@tensorflow/tfjs';
import * as tfl from '@tensorflow/tfjs-layers';
import { LinearAttentionMixer } from './LinearAttentionMixer';
import { TensorMap, disposeAll, hashCode } from './utils/tensorflow';
import {
  ATTENTION_HEADS_DEFAULT,
  DROPOUT_RATE_MEDIUM,
  STANDARD_NONNEGATIVE_ACTIVATION,
} from './Constants';

export interface EmbeddingsProcessorConfig {
  timesteps: number; // Number of timesteps for expansion
  embeddingSize?: number; // Output embedding size (default: 64)
  mixingMethod?: 'dense' | 'attention'; // Mixing strategy (default: 'attention')
  name?: string; // Layer name for compatibility
  latentSize?: number; // Latent size for compatibility
}

export class EmbeddingsProcessor {
  private timesteps: number;
  private embeddingSize: number;
  private mixingMethod: 'dense' | 'attention';
  private built: boolean = false;
  private name: string;
  private namePrefix: string;

  // Layer components
  private mixer: LinearAttentionMixer | null = null;
  private mixingDense: tfl.layers.Layer | null = null;
  private finalDense: tfl.layers.Layer | null = null;

  constructor(config: EmbeddingsProcessorConfig) {
    this.validateConfig(config);

    this.timesteps = config.timesteps;
    this.embeddingSize = config.embeddingSize ?? 64;
    this.mixingMethod = config.mixingMethod ?? 'attention';
    this.name = config.name || 'embeddings_processor';
    this.namePrefix = `${hashCode(this.name)}_`;

    // Only store config, don't build layers in constructor
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: EmbeddingsProcessorConfig): void {
    if (config.timesteps < 1) {
      throw new Error('timesteps must be >= 1');
    }
    if (config.embeddingSize && config.embeddingSize < 1) {
      throw new Error('embeddingSize must be >= 1');
    }
  }

  /**
   * Build computational graph
   */
  public build(inputShape: number[]): void {
    if (this.built) {
      console.warn('EmbeddingsProcessor already built. Skipping.');
      return;
    }

    console.log(
      `[EmbeddingsProcessor.${this.name}] Building model with input shape: ${JSON.stringify(inputShape)}`
    );

    const namePrefix = this.namePrefix;

    // Initialize layers based on mixing method
    if (this.mixingMethod === 'attention') {
      // Attention-based mixing using LinearAttentionMixer
      // Pools 5 embeddings → 1 output with ATTENTION_HEADS_DEFAULT heads
      this.mixer = new LinearAttentionMixer({
        n_outputs: 1, // Pool multiple embeddings to 1 output
        max_dim: 16, // Use max_dim=16 to get similar head calculation
        activation: STANDARD_NONNEGATIVE_ACTIVATION,
        dropout_rate: DROPOUT_RATE_MEDIUM,
        name: `${this.name}/mixer_attention`,
      });
    } else {
      // Dense-based mixing
      this.mixingDense = tfl.layers.dense({
        units: this.embeddingSize,
        activation: 'tanh',
        name: `${namePrefix}embeddings_mixer_dense`,
      });
    }

    // Final dense layer
    this.finalDense = tfl.layers.dense({
      units: this.embeddingSize,
      activation: 'tanh',
      name: `${namePrefix}final_dense`,
    });

    // Build mixer separately first
    if (this.mixer) {
      // The mixer expects input shape [batch, spatial_dim, feature_dim]
      // where spatial_dim=5 (number of embeddings to pool) and feature_dim=embeddingSize
      const mixerInputShape = [1, 5, this.embeddingSize];
      this.mixer.build(mixerInputShape);
    }

    // Initialize computational graph with dummy input
    this.built = true;
    const input = tf.zeros(
      inputShape.map(x => x || 1),
      'float32'
    );
    const res = this.apply(input, false);
    disposeAll([input, res]);
    console.log(`[EmbeddingsProcessor.${this.name}] Model built successfully`);
  }

  /**
   * Load weights using exact pattern matching - NO SEARCHING
   */
  async loadWeights(weightsMap: TensorMap): Promise<void> {
    if (!this.built) {
      throw new Error(
        `EmbeddingsProcessor.${this.name} not built. Call build() first before loadWeights().`
      );
    }

    console.log(`[EmbeddingsProcessor.${this.name}] Loading weights`);

    // Load final dense layer weights using assignDense
    weightsMap.assignDense(`${this.name}/final_dense`, this.finalDense);
    console.log(`[EmbeddingsProcessor.${this.name}] final_dense: ✓ Loaded weights`);

    // Load mixer weights if using attention
    if (this.mixer) {
      await this.mixer.loadWeights(weightsMap);
      console.log(`[EmbeddingsProcessor.${this.name}] mixer weights loaded`);
    }

    console.log(`[EmbeddingsProcessor.${this.name}] All weights loaded`);
  }

  /**
   * Apply method - call the predict method (for consistency with other components)
   */
  apply(concatenatedEmbeddings: tf.Tensor, training: boolean): tf.Tensor {
    if (!this.built) {
      throw new Error('EmbeddingsProcessor not built. Call build() first before predict().');
    }

    return tf.tidy(() => {
      const shape = concatenatedEmbeddings.shape;
      const batchSize = shape[0];
      const timesteps = shape[1];
      const totalFeatures = shape[2];

      // Step 1: Apply mixing to reduce from 5*embedding_size → embedding_size
      let mixed: tf.Tensor;
      if (this.mixer) {
        // LinearAttentionMixer expects (batch, spatial, feature_dim) where spatial=5
        // Reshape [batch, timesteps, 5*embedding_size] → [batch*timesteps, 5, embedding_size]
        const actualEmbeddingSize = totalFeatures / 5;
        const reshaped = tf.reshape(concatenatedEmbeddings, [
          batchSize * timesteps,
          5,
          actualEmbeddingSize,
        ]);

        // Apply mixer: [batch*timesteps, 5, embedding_size] → [batch*timesteps, 1, embedding_size]
        const mixedReshaped = this.mixer.apply(reshaped, false) as tf.Tensor;

        // Squeeze n_outputs dimension: [batch*timesteps, 1, embedding_size] → [batch*timesteps, embedding_size]
        const squeezed = tf.squeeze(mixedReshaped, [1]);

        // Reshape back to [batch, timesteps, embedding_size]
        mixed = tf.reshape(squeezed, [batchSize, timesteps, actualEmbeddingSize]);
      } else if (this.mixingDense) {
        mixed = this.mixingDense.apply(concatenatedEmbeddings) as tf.Tensor;
      } else {
        throw new Error('No mixing layer initialized');
      }

      // Step 2: Temporal expansion via tf.tile() (if needed)
      let expanded: tf.Tensor;
      if (mixed.shape[1] === 1 && this.timesteps > 1) {
        // [batch, 1, embedding_size] → [batch, timesteps, embedding_size]
        expanded = tf.tile(mixed, [1, this.timesteps, 1]);
      } else {
        expanded = mixed;
      }

      // Step 3: Apply final dense transformation
      const output = this.finalDense.apply(expanded) as tf.Tensor;

      return output;
    });
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    disposeAll([this.mixer, this.mixingDense, this.finalDense]);
    this.mixer = null;
    this.mixingDense = null;
    this.finalDense = null;
  }
}
