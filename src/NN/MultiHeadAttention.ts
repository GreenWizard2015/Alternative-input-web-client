/**
 * MultiHeadAttention - Scaled dot-product multi-head attention mechanism.
 *
 * Core attention mechanism for transformer architectures.
 * Used by TransformerEncoderBlock in Step2LatentModel.
 *
 * Architecture:
 * - Projects input to Query, Key, Value
 * - Splits into multiple heads
 * - Computes scaled dot-product attention per head
 * - Concatenates and projects back to original dimension
 *
 * Usage:
 * ```typescript
 * const attention = new MultiHeadAttention({
 *   featureSize: 64,
 *   nHeads: 8
 * });
 * const output = attention.apply(queries, keys, values);
 * ```
 */

import * as tf from '@tensorflow/tfjs';
import * as tfl from '@tensorflow/tfjs-layers';
import { TensorMap, disposeAll, hashCode } from './utils/tensorflow';
import { ATTENTION_MASK_VALUE } from './Constants';

export interface MultiHeadAttentionConfig {
  featureSize: number; // Total feature size
  nHeads: number; // Number of attention heads
  d_model?: number; // Alias for featureSize (for compatibility)
  headSize?: number; // Size per head (default: featureSize / nHeads)
  useBias?: boolean; // Use bias in projections (default: true)
  dropout?: number; // Attention dropout rate (default: 0.0)
  hypersphere?: boolean; // Use hypersphere attention (default: false)
  name: string; // Layer name (required)
}

export class MultiHeadAttention {
  private config: MultiHeadAttentionConfig;
  private featureSize: number;
  private nHeads: number;
  private headSize: number;
  private dropout: number;
  private built: boolean = false;
  private name: string;
  private namePrefix: string;

  // Layer components
  private queryDense: tfl.layers.Layer | null = null;
  private keyDense: tfl.layers.Layer | null = null;
  private valueDense: tfl.layers.Layer | null = null;
  private outputDense: tfl.layers.Layer | null = null;
  private dropoutLayer: tfl.layers.Layer | null = null;

  // Attention scale factor (learnable parameter)
  private scaleFactor: tf.Variable | null = null;

  constructor(config: MultiHeadAttentionConfig) {
    this.validateConfig(config);
    this.name = config.name; // Initialize name property
    this.namePrefix = `${hashCode(this.name)}_`;

    // Map d_model to featureSize for compatibility
    const featureSize = config.d_model || config.featureSize;
    this.config = {
      ...config,
      featureSize,
    };
    this.featureSize = featureSize;
    this.nHeads = config.nHeads;
    this.headSize = config.headSize ?? Math.floor(featureSize / config.nHeads);
    this.dropout = config.dropout ?? 0.0;

    if (this.headSize * this.nHeads !== this.featureSize) {
      throw new Error(
        `featureSize (${this.featureSize}) must be divisible by nHeads (${this.nHeads})`
      );
    }
  }

  /**
   * Validate configuration parameters
   */
  private validateConfig(config: MultiHeadAttentionConfig): void {
    if (config.featureSize < 1) throw new Error('featureSize must be >= 1');
    if (config.nHeads < 1) throw new Error('nHeads must be >= 1');
    if (config.headSize && config.headSize < 1) throw new Error('headSize must be >= 1');
    if (config.dropout && (config.dropout < 0 || config.dropout > 1)) {
      throw new Error('dropout must be between 0 and 1');
    }
  }

  /**
   * Load weights from TensorMap
   */
  async loadWeights(weightsMap: TensorMap): Promise<void> {
    if (!this.built) {
      throw new Error(
        `MultiHeadAttention.${this.name} not built. Call build() first before apply().`
      );
    }

    const name = this.config.name;

    // Load attention scale (scalar weight)
    const attentionScale = weightsMap.get(`weights/${name}/attention_scale`);
    if (!attentionScale) {
      throw new Error(`[MultiHeadAttention.${name}] scaleFactor not initialized`);
    }
    this.scaleFactor.assign(attentionScale);
    console.log(`[MultiHeadAttention.${name}] attention_scale: ✓ Loaded`);

    // Load weights for each projection layer using assignDense
    weightsMap.assignDense(`${name}/query_projection`, this.queryDense);
    weightsMap.assignDense(`${name}/key_projection`, this.keyDense);
    weightsMap.assignDense(`${name}/value_projection`, this.valueDense);
    weightsMap.assignDense(`${name}/output_projection`, this.outputDense);
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    disposeAll([
      this.queryDense,
      this.keyDense,
      this.valueDense,
      this.outputDense,
      this.dropoutLayer,
    ]);
    this.queryDense = null;
    this.keyDense = null;
    this.valueDense = null;
    this.outputDense = null;
    this.dropoutLayer = null;
  }

  /**
   * Build the MultiHeadAttention (mark as built)
   */
  public build(queryShape: number[], keyShape: number[], valueShape: number[]): void {
    if (this.built) {
      console.warn('MultiHeadAttention already built. Skipping.');
      return;
    }
    const name = this.config.name;

    const namePrefix = this.namePrefix;

    // Query, Key, Value projections
    this.queryDense = tfl.layers.dense({
      units: this.featureSize,
      useBias: this.config.useBias ?? true,
      name: `${namePrefix}query`,
    });

    this.keyDense = tfl.layers.dense({
      units: this.featureSize,
      useBias: this.config.useBias ?? true,
      name: `${namePrefix}key`,
    });

    this.valueDense = tfl.layers.dense({
      units: this.featureSize,
      useBias: this.config.useBias ?? true,
      name: `${namePrefix}value`,
    });

    // Output projection
    this.outputDense = tfl.layers.dense({
      units: this.featureSize,
      useBias: this.config.useBias ?? true,
      name: `${namePrefix}output`,
    });

    // Dropout for attention weights
    if (this.dropout > 0) {
      this.dropoutLayer = tfl.layers.dropout({
        rate: this.dropout,
        name: `${namePrefix}dropout`,
      });
    }

    // Initialize learnable scale factor (wrapped with softplus for numerical stability)
    // Initialize so that softplus(init_val) ≈ 1/sqrt(headSize)
    const targetScale = 1.0 / Math.sqrt(this.headSize);
    const initVal = Math.log(Math.exp(targetScale) - 1.0);
    this.scaleFactor = tf.variable(
      tf.tensor1d([initVal], 'float32'),
      this.config.hypersphere, // Only trainable if hypersphere=True (match Python)
      `${this.namePrefix}attention_scale`
    );

    // Set built flag BEFORE calling apply() to allow dummy input test
    this.built = true;
    const inputs = [
      tf.zeros(
        queryShape.map(x => x || 1),
        'float32'
      ),
      tf.zeros(
        keyShape.map(x => x || 1),
        'float32'
      ),
      tf.zeros(
        valueShape.map(x => x || 1),
        'float32'
      ),
    ];
    const res = this.apply(inputs[0], inputs[1], inputs[2], false);
    disposeAll([...inputs, res]);
  }

  /**
   * Forward pass - compute multi-head attention.
   */
  apply(
    queries: tf.Tensor,
    keys: tf.Tensor,
    values: tf.Tensor,
    training: boolean,
    mask?: tf.Tensor
  ): tf.Tensor {
    if (!this.built) {
      throw new Error('MultiHeadAttention must be built before calling apply().');
    }
    if (!this.queryDense || !this.keyDense || !this.valueDense || !this.outputDense) {
      throw new Error('MultiHeadAttention layers not initialized.');
    }

    return tf.tidy(() => {
      // Project inputs to query, key, value spaces
      const q = this.queryDense.apply(queries) as tf.Tensor;
      const k = this.keyDense.apply(keys) as tf.Tensor;
      const v = this.valueDense.apply(values) as tf.Tensor;

      // Reshape for multi-head attention: [batch, seq, features] → [batch, seq, heads, headSize]
      const q_reshaped = tf.reshape(q, [q.shape[0], q.shape[1], this.nHeads, this.headSize]);
      const k_reshaped = tf.reshape(k, [k.shape[0], k.shape[1], this.nHeads, this.headSize]);
      const v_reshaped = tf.reshape(v, [v.shape[0], v.shape[1], this.nHeads, this.headSize]);

      // Transpose to [batch, heads, seq, headSize] for attention computation
      const qTransposed = tf.transpose(q_reshaped, [0, 2, 1, 3]);
      const kTransposed = tf.transpose(k_reshaped, [0, 2, 1, 3]);
      const vTransposed = tf.transpose(v_reshaped, [0, 2, 1, 3]);

      // Apply hypersphere normalization if enabled
      let queryNorm = qTransposed;
      let keyNorm = kTransposed;
      if (this.config.hypersphere) {
        queryNorm = tf.div(qTransposed, tf.norm(qTransposed, 2, -1, true));
        keyNorm = tf.div(kTransposed, tf.norm(kTransposed, 2, -1, true));
      }

      // Compute scaled dot-product attention
      // scores = Q * K^T / sqrt(d_k)
      const scores = tf
        .matMul(queryNorm, keyNorm, false, true)
        .div(tf.scalar(Math.sqrt(this.headSize), 'float32'));

      // Apply attention scale with softplus for numerical stability (match Python)
      if (this.scaleFactor) {
        const learnableScale = tf.softplus(this.scaleFactor);
        scores.mul(learnableScale);
      }

      // Apply mask if provided
      if (mask) {
        // Add mask to scores (before softmax)
        scores.add(mask);
      }

      // Apply softmax to get attention weights
      const attentionWeights = tf.softmax(scores);

      // Apply dropout if in training mode
      let attentionOutput = attentionWeights;
      if (this.dropoutLayer && training) {
        attentionOutput = this.dropoutLayer.apply(attentionWeights, { training }) as tf.Tensor;
      }

      // Apply attention to values: Attention * V
      const attended = tf.matMul(attentionOutput, vTransposed);

      // Transpose back to [batch, seq, heads, headSize]
      const attendedTransposed = tf.transpose(attended, [0, 2, 1, 3]);

      // Reshape to [batch, seq, features] for output projection
      const output = tf.reshape(attendedTransposed, [
        attendedTransposed.shape[0],
        attendedTransposed.shape[1],
        this.featureSize,
      ]);

      // Final output projection
      return this.outputDense.apply(output) as tf.Tensor;
    });
  }
}
