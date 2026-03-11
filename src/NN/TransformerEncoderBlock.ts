/**
 * TransformerEncoderBlock - Complete transformer encoder with self-attention and feed-forward.
 *
 * Combines:
 * - Multi-head self-attention
 * - Residual connections
 * - Layer normalization
 * - Feed-forward MLP
 *
 * Used by Step2LatentModel for temporal sequence processing.
 *
 * Architecture:
 * x → LayerNorm → MultiHeadAttention → Residual → LayerNorm → sMLP → Residual → output
 *
 * Note: num_heads is calculated dynamically in build() method based on d_model
 *
 * Usage:
 * ```typescript
 * const block = new TransformerEncoderBlock({
 *   d_model: 64,
 *   dff: 256
 * });
 * const output = block.apply(inputs);
 * ```
 */

import * as tf from '@tensorflow/tfjs';
import * as tfl from '@tensorflow/tfjs-layers';
import { MultiHeadAttention } from './MultiHeadAttention';
import { disposeAll, TensorMap } from './utils/tensorflow';

export interface TransformerEncoderBlockConfig {
  d_model: number; // Embedding dimension (model size)
  dff?: number; // Feed-forward dimension (default: 4 * d_model)
  dropout_rate?: number; // Dropout rate (default: 0.1)
  name: string; // Layer name
}

export class TransformerEncoderBlock {
  private config: TransformerEncoderBlockConfig;
  private d_model: number;
  private num_heads: number;
  private dff: number;
  private dropout_rate: number;
  private built: boolean = false;

  // Layer components
  private ln1: tfl.layers.Layer | null = null;
  private attention: MultiHeadAttention | null = null;
  private dropout1: tfl.layers.Layer | null = null;

  private ln2: tfl.layers.Layer | null = null;
  private ff: tf.Sequential | null = null;
  private dropout2: tfl.layers.Layer | null = null;

  constructor(config: TransformerEncoderBlockConfig) {
    this.validateConfig(config);

    this.config = config;
    this.d_model = config.d_model;
    this.dff = config.dff ?? 4 * config.d_model;
    this.dropout_rate = config.dropout_rate ?? 0.1;

    // num_heads will be calculated dynamically in build() method like Python
    this.initializeLayers();
  }

  /**
   * Validate configuration parameters
   */
  private validateConfig(config: TransformerEncoderBlockConfig): void {
    if (config.d_model < 1) throw new Error('d_model must be >= 1');
    if (config.dff && config.dff < 1) throw new Error('dff must be >= 1');
    if (config.dropout_rate && (config.dropout_rate < 0 || config.dropout_rate > 1)) {
      throw new Error('dropout_rate must be between 0 and 1');
    }
  }

  /**
   * Initialize layer components
   */
  private initializeLayers(): void {
    // Layer normalization for self-attention (exact Python names)
    this.ln1 = tfl.layers.layerNormalization({
      epsilon: 1e-6, // ✅ Match Python TransformerEncoderBlock (epsilon=1e-6)
      name: 'layernorm1', // ✅ FIXED: Exact Python name
    });

    // Multi-head self-attention - as per reference
    this.attention = new MultiHeadAttention({
      featureSize: this.d_model,
      nHeads: this.num_heads,
      dropout: this.dropout_rate, // ✅ FIXED: Use actual dropout rate to match Python
      hypersphere: true, // ✅ Match Python reference
      name: `${this.config.name}/multi_head_attention`, // ✅ FIXED: Full path to match weights
    });

    // Dropout after attention (exact Python names)
    if (this.dropout_rate > 0) {
      this.dropout1 = tfl.layers.dropout({
        rate: this.dropout_rate,
        name: 'dropout1', // ✅ FIXED: Exact Python name
      });
      this.dropout2 = tfl.layers.dropout({
        rate: this.dropout_rate,
        name: 'dropout2', // ✅ FIXED: Exact Python name
      });
    }

    // Layer normalization for feed-forward (exact Python names)
    this.ln2 = tfl.layers.layerNormalization({
      epsilon: 1e-6, // ✅ Match Python TransformerEncoderBlock (epsilon=1e-6)
      name: 'layernorm2', // ✅ FIXED: Exact Python name
    });

    // Feed-forward network with 3 layers like Python (Dense → Dense → Dropout)
    const layers: tfl.layers.Layer[] = [
      tfl.layers.dense({
        units: this.dff,
        activation: 'relu',
        name: 'ffn_inner',
        inputShape: [this.d_model],
      }),
      tfl.layers.dense({
        units: this.d_model,
        name: 'ffn_output',
      }),
    ];

    if (this.dropout_rate > 0) {
      layers.push(
        tfl.layers.dropout({
          rate: this.dropout_rate,
          name: 'dropout3', // Different name to avoid conflict with residual dropouts
        })
      );
    }

    this.ff = tf.sequential({
      name: 'feed_forward_network', // ✅ FIXED: Exact Python name
      layers: layers,
    });

    // Dropout for residual connections - already created above
  }

  /**
   * Forward pass through transformer block.
   *
   * Uses post-normalization (residual → LayerNorm) pattern matching Python exactly.
   * Architecture: x → Attention → Dropout → Residual → LayerNorm → FFN → Dropout → Residual → LayerNorm → output
   *
   * Python reference:
   * - attn_output = self.mha(x, x, x, mask, training)  # line 133-139
   * - attn_output = self.dropout1(attn_output, training=training)  # line 140
   * - out1 = self.layernorm1(x + attn_output)  # line 141 (residual THEN norm)
   * - ffn_output = self.ffn(out1, training=training)  # line 144
   * - ffn_output = self.dropout2(ffn_output, training=training)  # line 145
   * - out2 = self.layernorm2(out1 + ffn_output)  # line 146 (residual THEN norm)
   *
   * @param inputs - Tensor of shape [batch, seqLen, d_model]
   * @param training - Whether in training mode (affects dropout)
   * @param mask - Optional attention mask [batch, seqLen, seqLen]
   * @returns Tensor of shape [batch, seqLen, d_model]
   */
  apply(inputs: tf.Tensor, training: boolean, mask?: tf.Tensor): tf.Tensor {
    if (!this.built) {
      throw new Error('TransformerEncoderBlock must be built before calling apply()');
    }
    if (!this.ln1 || !this.attention || !this.ln2 || !this.ff) {
      throw new Error('TransformerEncoderBlock not initialized');
    }

    return tf.tidy(() => {
      // Multi-head self-attention with residual connection (POST-NORMALIZATION like Python)
      const attn_output = this.attention.apply(inputs, inputs, inputs, training, mask);

      // Apply dropout to attention output (like Python line 140)
      let attn_dropped = attn_output;
      if (this.dropout1) {
        attn_dropped = this.dropout1.apply(attn_output, { training }) as tf.Tensor;
      }

      // Residual connection then layer normalization (POST-NORMALIZATION like Python line 141)
      // ✅ Python uses: x + attn_output (original input + attention output, dropout applied separately)
      const residual1 = tf.add(inputs, attn_dropped);
      const norm1 = this.ln1.apply(residual1) as tf.Tensor;

      // Feed-forward network with residual connection (POST-NORMALIZATION like Python)
      const ff_output = this.ff.apply(norm1, { training }) as tf.Tensor;

      // Apply dropout to FFN output (like Python line 145)
      let ff_dropped = ff_output;
      if (this.dropout2) {
        ff_dropped = this.dropout2.apply(ff_output, { training }) as tf.Tensor;
      }

      // Final residual connection then layer normalization (POST-NORMALIZATION like Python line 146)
      // ✅ Python uses: out1 + ffn_output (norm1 + FFN output with dropout)
      const residual2 = tf.add(norm1, ff_dropped);
      const output = this.ln2.apply(residual2) as tf.Tensor;

      return output;
    });
  }

  /**
   * Load weights from TensorMap (similar to Python model_to_dict pattern)
   */
  async loadWeights(weightsMap: TensorMap): Promise<void> {
    if (!this.built) {
      throw new Error('TransformerEncoderBlock must be built before calling loadWeights()');
    }
    const name = this.config.name ?? 'transformer_block';
    const allKeys = Object.keys((weightsMap as any).tensors);

    console.log(`[TransformerBlock.${name}] Checking weights. Available keys: ${allKeys.length}`);

    // Find weights using Python naming convention
    const ln1Gamma = weightsMap.get(`weights/${name}/layernorm1/gamma`);
    const ln1Beta = weightsMap.get(`weights/${name}/layernorm1/beta`);
    const ln2Gamma = weightsMap.get(`weights/${name}/layernorm2/gamma`);
    const ln2Beta = weightsMap.get(`weights/${name}/layernorm2/beta`);

    console.log(`[TransformerBlock.${name}] ln1: gamma=${!!ln1Gamma}, beta=${!!ln1Beta}`);
    console.log(`[TransformerBlock.${name}] ln2: gamma=${!!ln2Gamma}, beta=${!!ln2Beta}`);

    // Set layernorm weights using assignNorm (checks how many weights layer expects)
    if (this.ln1) {
      weightsMap.assignNorm(`${name}/layernorm1`, this.ln1);
      console.log(`[TransformerBlock.${name}] ln1: weights SET`);
    } else {
      throw new Error(`[TransformerBlock.${name}] Layer normalization component ln1 is not initialized`);
    }

    if (this.ln2) {
      weightsMap.assignNorm(`${name}/layernorm2`, this.ln2);
      console.log(`[TransformerBlock.${name}] ln2: weights SET`);
    } else {
      throw new Error(`[TransformerBlock.${name}] Layer normalization component ln2 is not initialized`);
    }

    if (this.attention) {
      // MultiHeadAttention now expects TensorMap directly
      await this.attention.loadWeights(weightsMap);
    } else {
      throw new Error(`[TransformerBlock.${name}] MultiHeadAttention component is not initialized`);
    }
    if (this.ff) {
      // Sequential model feed-forward network - load weights directly
      this.loadFFWeights(weightsMap);
    } else {
      throw new Error(
        `[TransformerBlock.${name}] Feed-forward network component is not initialized`
      );
    }
  }

  /**
   * Load weights for feed-forward network (sequential model)
   */
  private loadFFWeights(weightsMap: TensorMap): void {
    const name = this.config.name ?? 'transformer_block';

    console.log(`[TransformerBlock.${name}] Loading FF weights with name: ${name}`);

    // Use assignDense for both dense layers
    weightsMap.assignDense(`${name}/feed_forward_network/ffn_inner`, this.ff.layers[0]);
    console.log(`[TransformerBlock.${name}] ffn_inner: weights SET`);
    weightsMap.assignDense(`${name}/feed_forward_network/ffn_output`, this.ff.layers[1]);
    console.log(`[TransformerBlock.${name}] ffn_output: weights SET`);
  }

  /**
   * Build the TransformerEncoderBlock (mark as built)
   */
  public build(inputShape: number[]): void {
    if (this.built) {
      console.warn(`TransformerEncoderBlock.${this.config.name} already built. Skipping.`);
      return;
    }

    // Calculate num_heads dynamically like Python (find maximum possible heads)
    // Python implementation: for possible_dim in range(self.d_model, 1, -1):
    //                          if self.d_model % possible_dim == 0:
    //                              self.num_heads = self.d_model // possible_dim
    //                              break
    this.num_heads = 0;
    for (let possible_dim = this.d_model; possible_dim > 1; possible_dim--) {
      if (this.d_model % possible_dim === 0) {
        this.num_heads = this.d_model / possible_dim;
        break;
      }
    }
    if (this.num_heads === 0) {
      this.num_heads = 1; // Fallback to single head
    }

    console.log(`[TransformerEncoderBlock.${this.config.name}] Calculated num_heads: ${this.num_heads}`);

    // ✅ FIXED: Pass the correct feature dimension to MultiHeadAttention
    const featureShape = [...inputShape];
    featureShape[featureShape.length - 1] = this.d_model;

    // Build internal MultiHeadAttention component with correct feature dimension
    if (this.attention) {
      this.attention.build(featureShape, featureShape, featureShape);
    }

    // Set built flag BEFORE calling apply() to allow dummy input test
    this.built = true;
    const input = tf.zeros(
      inputShape.map(x => x || 1),
      'float32'
    );
    const res = this.apply(input, false);
    disposeAll([input, res]);
    console.log(`[TransformerEncoderBlock.${this.config.name}] Model built successfully`);
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    disposeAll([this.ln1, this.attention, this.dropout1, this.ln2, this.ff, this.dropout2]);
    this.ln1 = null;
    this.attention = null;
    this.dropout1 = null;
    this.ln2 = null;
    this.ff = null;
    this.dropout2 = null;
  }
}
