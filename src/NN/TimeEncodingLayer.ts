/**
 * TimeEncodingLayer - Encodes temporal information using shallow coordinate encoding.
 *
 * ⚠️ **REFACTORED TO MATCH PYTHON EXACTLY**
 * Python Reference: /NN/layers/TimeEncodingLayer.py lines 10-116
 *
 * Creates 4 time representations (relative, normalized, differences, normalized differences)
 * and combines them via attention-based pooling (LinearAttentionMixer).
 *
 * Input:  (B, T, 1)  - Temporal values in range [0, 1]
 * Output: (B, T, 32) - Encoded temporal features
 *
 * Usage:
 * ```typescript
 * const timeEncoder = new TimeEncodingLayer();
 * const times = tf.constant([[[0.0], [0.5], [1.0]]]);
 * const encoded = timeEncoder.apply(times); // (1, 3, 32)
 * ```
 */

import * as tf from '@tensorflow/tfjs';
import { ShallowEncoderLayer } from './ShallowEncoderLayer';
import { LinearAttentionMixer } from './LinearAttentionMixer';
import { TIME_NORMALIZATION_EPSILON } from './Constants';
import { TensorMap, disposeAll, hashCode } from './utils/tensorflow';

export interface TimeEncodingLayerConfig {
  name: string;
}

export class TimeEncodingLayer {
  private shallowEncoder: ShallowEncoderLayer;
  private attentionMixer: LinearAttentionMixer;
  private name: string;
  private built: boolean = false;
  private namePrefix: string;

  constructor(config: TimeEncodingLayerConfig) {
    this.name = config.name;
    this.namePrefix = `${hashCode(this.name)}_`;

    // Only store config, don't build subcomponents yet
  }

  /**
   * Build the layer with input shape.
   *
   * ✅ FIXED: Explicit build method following good patterns
   * Builds both shallow encoder and attention mixer with proper input shapes
   */
  public build(inputShape: number[]): void {
    if (this.built) {
      console.warn('TimeEncodingLayer already built. Skipping.');
      return;
    }

    // ✅ FIXED: Create shallow encoder (fixed 32 dims from Python)
    this.shallowEncoder = new ShallowEncoderLayer({
      name: `${this.name}/encoder`,
    });

    // Build shallow encoder first to get its output shape
    this.shallowEncoder.build(inputShape);

    // ✅ FIXED: Create attention mixer with correct input shape
    // The stacked encodings have shape (batch, timesteps, 4, encoding_dim)
    const attentionMixerInputShape = [
      inputShape[0], // batch size
      inputShape[1], // timesteps
      4, // 4 time representations
      32, // encoding dim from shallow encoder
    ];

    this.attentionMixer = new LinearAttentionMixer({
      n_outputs: 1,
      max_dim: 16, // Use max_dim=16 to get similar head calculation
      name: `${this.name}/AttentionMixer`,
    });

    // Build attention mixer with the correct input shape
    this.attentionMixer.build(attentionMixerInputShape);

    // Build the layers with dummy input to initialize computational graph
    // TODO: Remove dummy input test to avoid circular dependency in build
    // const input = tf.zeros(inputShape.map(x => x || 1), "float32");
    // const res = this.apply(input);
    // disposeAll([input, res]);
    this.built = true;
  }

  /**
   * Compute relative times (subtract minimum).
   */
  private relativeTimes(times: tf.Tensor): tf.Tensor {
    return tf.tidy(() => {
      const minTime = tf.min(times, 1, true);
      return tf.sub(times, minTime);
    });
  }

  /**
   * Normalize times to [0, 1] range per batch.
   */
  private normalizeTimes(times: tf.Tensor): tf.Tensor {
    return tf.tidy(() => {
      const minTime = tf.min(times, 1, true);
      const maxTime = tf.max(times, 1, true);
      const range = tf.add(tf.sub(maxTime, minTime), TIME_NORMALIZATION_EPSILON);
      return tf.div(tf.sub(times, minTime), range);
    });
  }

  /**
   * Compute time differences with zero-padding for first timestep.
   */
  private diffTimes(times: tf.Tensor): tf.Tensor {
    return tf.tidy(() => {
      const T = times.shape[1]!;

      if (T <= 1) {
        return tf.zerosLike(times);
      }

      // Compute differences: times[t] - times[t-1]
      const timesFuture = tf.slice(times, [0, 1, 0], [-1, T - 1, -1]);
      const timesPast = tf.slice(times, [0, 0, 0], [-1, T - 1, -1]);
      const diffs = tf.sub(timesFuture, timesPast);

      // Pad first timestep with zeros
      const zeroPad = tf.zeros([times.shape[0]!, 1, 1]);
      return tf.concat([zeroPad, diffs], 1);
    });
  }

  /**
   * Encode temporal input through multiple representations.
   *
   * ✅ FIXED: Use LinearAttentionMixer to combine representations
   *
   * Pipeline:
   * 1. Create 4 time representations (relative, normalized, diff, normalized_diff)
   * 2. Encode each with ShallowEncoderLayer: (B, T, 1) -> (B, T, 32)
   * 3. Stack all 4: (B, T, 4, 32)
   * 4. Mix using LinearAttentionMixer: (B, T, 4, 32) -> (B, T, 1, 32)
   * 5. Squeeze: (B, T, 1, 32) -> (B, T, 32)
   *
   * Input:  (B, T, 1)
   * Output: (B, T, 32)
   */
  apply(times: tf.Tensor, training: boolean): tf.Tensor {
    if (!this.built) {
      throw new Error(
        `TimeEncodingLayer.${this.name} not built. Call build() first before apply().`
      );
    }

    return tf.tidy(() => {
      // Validate input shape
      if (times.shape.length !== 3 || times.shape[2] !== 1) {
        throw new Error(
          `TimeEncodingLayer expects input shape (batch, timesteps, 1), got ${times.shape}`
        );
      }

      // ✅ FIXED: Create 4 time representations
      const relTimes = this.relativeTimes(times);
      const normTimes = this.normalizeTimes(times);
      const diffTimes = this.diffTimes(times);
      const normDiffTimes = this.normalizeTimes(diffTimes);

      // ✅ FIXED: Encode each representation: (B, T, 1) -> (B, T, 32)
      const relEncoded = this.shallowEncoder.apply(relTimes, training);
      const normEncoded = this.shallowEncoder.apply(normTimes, training);
      const diffEncoded = this.shallowEncoder.apply(diffTimes, training);
      const normDiffEncoded = this.shallowEncoder.apply(normDiffTimes, training);

      // ✅ FIXED: Stack all 4 encoded representations
      // (B, T, 32) × 4 -> (B, T, 4, 32)
      const stackedEncodings = tf.stack([relEncoded, normEncoded, diffEncoded, normDiffEncoded], 2);

      // ✅ FIXED: Apply attention mixer to combine representations
      // Input: (B, T, 4, 32)
      // Output: (B, T, 1, 32) from n_outputs=1
      const mixed = this.attentionMixer.apply(stackedEncodings, training) as tf.Tensor;

      // ✅ FIXED: Squeeze n_outputs dimension
      // (B, T, 1, 32) -> (B, T, 32)
      const result = tf.squeeze(mixed, [2]);

      return result;
    });
  }

  /**
   * Load weights from TensorMap using strict single patterns like reference implementations
   */
  async loadWeights(weightsMap: TensorMap): Promise<void> {
    if (!this.built) {
      throw new Error(
        `TimeEncodingLayer.${this.name} not built. Call build() first before apply().`
      );
    }

    const name = this.name;

    console.log(`[TimeEncodingLayer.${name}] Loading weights`);

    // Load weights using the ShallowEncoderLayer's loadWeights method
    await this.shallowEncoder.loadWeights(weightsMap);
    console.log(`[TimeEncodingLayer.${name}] shallow_encoder: ✓ Set weights`);

    // Load weights
    await this.attentionMixer.loadWeights(weightsMap);
    console.log(`[TimeEncodingLayer.${name}] attention_mixer: ✓ Set weights`);

    console.log(`[TimeEncodingLayer.${name}] ✓ All components loaded`);
  }

  dispose(): void {
    disposeAll([this.shallowEncoder, this.attentionMixer]);
    this.shallowEncoder = null as any;
    this.attentionMixer = null as any;
  }
}
