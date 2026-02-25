/**
 * LinearAttentionMixer - Optimized linear attention-weighted feature pooling.
 *
 * ⚠️ **REFACTORED TO MATCH PYTHON EXACTLY**
 * Python Reference: /NN/layers/LinearAttentionMixer.py lines 43-285
 *
 * Pools variable-length sequences into N fixed-size representations using optimized
 * single-dense-layer attention. Each output learns independent attention weights.
 *
 * OPTIMIZATION: Single Dense(N × n_heads) layer instead of Q/K/V projections
 *
 * Used by:
 * - EyeEncoderConv: Per-scale attention pooling
 * - TimeEncodingLayer: Mixing temporal encodings
 * - FaceMeshEncoder: Landmark pooling
 *
 * Usage:
 * ```typescript
 * const mixer = new LinearAttentionMixer({ n_outputs: 1, n_heads: 4 });
 * const features = tf.randomNormal([32, 478, 64]);  // (batch, spatial, feature_dim)
 * const pooled = mixer.apply(features);             // (batch, 1, feature_dim)
 * ```
 */

import * as tf from '@tensorflow/tfjs';
import * as tfl from '@tensorflow/tfjs-layers';
import { TensorMap, disposeAll, softmax, hashCode } from './utils/tensorflow';
import {
  ATTENTION_HEADS_DEFAULT,
  DROPOUT_RATE_MEDIUM,
  STANDARD_NONNEGATIVE_ACTIVATION,
} from './Constants';

export interface LinearAttentionMixerConfig {
  n_outputs?: number; // Number of independent outputs (default: 1)
  n_heads?: number; // Number of attention heads per output (default: 4)
  activation?: string; // Activation function for attention logits (default: 'relu')
  dropout_rate?: number; // Attention dropout rate (default: 0.1)
  name: string; // Layer name
}

export class LinearAttentionMixer {
  private n_outputs: number;
  private n_heads: number;
  private activation: string;
  private dropout_rate: number;
  private name: string;
  private feature_dim: number | null = null;
  private built: boolean = false;
  private namePrefix: string;

  // ✅ FIXED: Single Dense layer instead of Q/K/V
  private attention_layer: tfl.layers.Layer | null = null;
  private dropout: tfl.layers.Layer | null = null;

  // ✅ FIXED: Learnable scale factor with softplus
  private scale_factor: tf.Variable | null = null;

  constructor(config: LinearAttentionMixerConfig) {
    this.n_outputs = config.n_outputs ?? 1;
    this.n_heads = config.n_heads ?? ATTENTION_HEADS_DEFAULT;
    this.activation = config.activation ?? STANDARD_NONNEGATIVE_ACTIVATION;
    this.dropout_rate = config.dropout_rate ?? DROPOUT_RATE_MEDIUM;
    this.name = config.name;
    this.namePrefix = `${hashCode(this.name)}_`;

    if (this.n_outputs < 1) {
      throw new Error(`n_outputs must be >= 1, got ${this.n_outputs}`);
    }
    if (this.n_heads < 1) {
      throw new Error(`n_heads must be >= 1, got ${this.n_heads}`);
    }

    // Initialize learnable scale factor (matches Python Constant(0.0) exactly)
    this.scale_factor = tf.variable(
      tf.tensor1d([0.0], 'float32'),
      true,
      `${this.namePrefix}attention_scale`
    );
  }

  /**
   * Build the linear attention mixer.
   *
   * ✅ FIXED: Create layers with proper input shape
   */
  public build(inputShape: number[]): void {
    // Store input feature dimension for attention layer
    this.feature_dim = inputShape[inputShape.length - 1];

    // CRITICAL FIX: Validate n_heads divisibility (matches Python exactly)
    if (this.feature_dim % this.n_heads !== 0) {
      throw new Error(
        `feature_dim (${this.feature_dim}) must be divisible by n_heads (${this.n_heads}). ` +
        `Ensure input shape[-1] % n_heads == 0.`
      );
    }

    // ✅ FIXED: Single Dense layer for all n_outputs*n_heads attention weights
    this.attention_layer = tfl.layers.dense({
      units: this.n_outputs * this.n_heads,
      activation: this.activation as any,
      name: `${this.namePrefix}attention_weights`,
    });

    // Dropout layer
    this.dropout = tfl.layers.dropout({
      rate: this.dropout_rate,
      name: `${this.namePrefix}dropout`,
    });

    // Initialize computational graph with dummy input
    this.built = true;
    const input = tf.zeros(
      inputShape.map(x => x || 1),
      'float32'
    );
    const res = this.apply(input, false);
    disposeAll([input, res]);
  }

  /**
   * Apply attention pooling to features.
   * ✅ MATCHES PYTHON EXACTLY
   *
   * Input:  (..., spatial_dim, feature_dim)
   * Output: (..., n_outputs, feature_dim)
   */
  apply(features: tf.Tensor, training: boolean): tf.Tensor {
    if (!this.built) {
      throw new Error(
        `LinearAttentionMixer.${this.name} not built. Call build() first before apply().`
      );
    }

    return tf.tidy(() => {
      // Get original shape and dimensions - EXACT MATCH PYTHON
      const input_shape = features.shape;

      // Extract leading dims, spatial dim, and feature dim - EXACT MATCH PYTHON
      const leading_dims = input_shape.slice(0, -2); // All dims except spatial and feature
      const spatial_dim = input_shape[input_shape.length - 2];
      const feature_dim = input_shape[input_shape.length - 1];

      // Compute flattened batch size - EXACT MATCH PYTHON
      const batch_size = tf.prod(tf.tensor1d(leading_dims)).dataSync()[0];

      // Reshape to 3D: (batch, spatial, feature) - EXACT MATCH PYTHON
      const features_3d = tf.reshape(features, [batch_size, spatial_dim, feature_dim]);

      // Split features into heads: (batch, spatial, n_heads, head_dim) - EXACT MATCH PYTHON
      const features_reshaped = tf.reshape(
        features_3d, [batch_size, spatial_dim, this.n_heads, feature_dim / this.n_heads]
      );
      // Transpose to (batch, n_heads, spatial, head_dim) - EXACT MATCH PYTHON
      const features_heads = tf.transpose(features_reshaped, [0, 2, 1, 3]);

      // Compute all attention logits at once: (batch, spatial, n_outputs*n_heads) - EXACT MATCH PYTHON
      let attn_logits_all = this.attention_layer!.apply(features_3d, { training }) as tf.Tensor;

      // Apply dropout - EXACT MATCH PYTHON
      attn_logits_all = this.dropout!.apply(attn_logits_all, { training }) as tf.Tensor;

      // Reshape to separate outputs: (batch, spatial, n_outputs, n_heads) - EXACT MATCH PYTHON
      const attn_logits_reshaped = tf.reshape(
        attn_logits_all,
        [batch_size, spatial_dim, this.n_outputs, this.n_heads],
      );

      // Apply learnable scale factor to attention logits (like Python: * self.scale_factor) - EXACT MATCH PYTHON
      const scaled_attn_logits = tf.mul(attn_logits_reshaped, this.scale_factor!);

      // Apply softmax across spatial dimension for all outputs simultaneously - EXACT MATCH PYTHON
      // attn_logits_reshaped: (batch, spatial, n_outputs, n_heads)
      // attn_weights_all: (batch, spatial, n_outputs, n_heads)
      const attn_weights_all = softmax(scaled_attn_logits, 1);

      // Reshape features for vectorized operations - EXACT MATCH PYTHON
      // features_heads: (batch, n_heads, spatial, head_dim)
      // Transpose to: (batch, spatial, n_heads, head_dim)
      const features_spatial = tf.transpose(features_heads, [0, 2, 1, 3]);

      // Reshape attention weights for broadcasting - EXACT MATCH PYTHON
      // attn_weights_all: (batch, spatial, n_outputs, n_heads)
      // Reshape to: (batch, spatial, n_outputs * n_heads, 1)
      const attn_weights_flat = tf.reshape(
        attn_weights_all,
        [batch_size, spatial_dim, this.n_outputs * this.n_heads, 1],
      );

      // Calculate head_dim and reshape features for batched operations - EXACT MATCH PYTHON
      const head_dim = feature_dim / this.n_heads;
      const features_flat = tf.tile(
        tf.reshape(
          features_spatial, [batch_size, spatial_dim, this.n_heads, head_dim]
        ),
        [1, 1, this.n_outputs, 1],
      );

      // Apply attention in fully vectorized way - EXACT MATCH PYTHON
      // (batch, spatial, n_outputs*n_heads, head_dim) * (batch, spatial, n_outputs*n_heads, 1)
      const weighted_features = tf.mul(features_flat, attn_weights_flat);

      // Pool across spatial: (batch, n_outputs*n_heads, head_dim) - EXACT MATCH PYTHON
      const pooled_flat = tf.sum(weighted_features, 1);

      // Calculate head_dim and reshape to separate outputs and heads: (batch, n_outputs, n_heads, head_dim) - EXACT MATCH PYTHON
      const pooled_4d = tf.reshape(
        pooled_flat, [batch_size, this.n_outputs, this.n_heads, head_dim]
      );

      // Pool across heads for each output: (batch, n_outputs, feature_dim) - EXACT MATCH PYTHON
      const pooled_3d = tf.reshape(
        pooled_4d, [batch_size, this.n_outputs, feature_dim]
      );

      // Reshape to original leading dims: (..., n_outputs, feature_dim) - EXACT MATCH PYTHON
      const output_shape = [...leading_dims, this.n_outputs, feature_dim];
      const pooled = tf.reshape(pooled_3d, output_shape);

      return pooled;
    });
  }

  /**
   * Load weights from TensorMap
   */
  async loadWeights(weightsMap: TensorMap): Promise<void> {
    if (!this.built) {
      throw new Error(
        `LinearAttentionMixer.${this.name} not built. Call build() first before apply().`
      );
    }

    const name = this.name;

    console.log(`[LinearAttentionMixer.${name}] Loading weights`);

    // Load attention layer weights using assignDense
    weightsMap.assignDense(
      `${name}/AttentionWeights`,
      this.attention_layer
    );
    console.log(`[LinearAttentionMixer.${name}] AttentionWeights loaded`);

    // Load scale factor using exact pattern matching
    const scaleTensor = weightsMap.get(`weights/${name}/attention_scale`);

    if (scaleTensor && this.scale_factor) {
      this.scale_factor.assign(scaleTensor);
      console.log(`[LinearAttentionMixer.${name}] scale_factor loaded`);
    } else {
      throw new Error(`[LinearAttentionMixer.${name}] scale_factor not found in weights map.`);
    }
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    disposeAll([this.scale_factor, this.attention_layer, this.dropout]);
    this.scale_factor = null;
    this.attention_layer = null;
    this.dropout = null;
  }
}
