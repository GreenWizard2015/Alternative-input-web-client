/**
 * ShallowEncoderLayer - Shallow temporal encoding layer.
 *
 * ⚠️ **REFACTORED TO MATCH PYTHON EXACTLY**
 * Python Reference: /NN/layers/ShallowEncoderLayer.py lines 9-56
 *
 * Encodes temporal information using coordinate encoding and rollout timesteps.
 * Takes timestep values and encodes them using coordinate encoding scheme,
 * then rolls them out across the sequence dimension.
 *
 * Input:  (B, T, 1)  - Temporal values
 * Output: (B, T, 32) - Encoded temporal features
 *
 * Usage:
 * ```typescript
 * const encoder = new ShallowEncoderLayer();
 * const times = tf.randomNormal([32, 10, 1]);
 * const encoded = encoder.apply(times); // (32, 10, 32)
 * ```
 */

import * as tf from '@tensorflow/tfjs';
import { RolloutTimesteps, LayerFunction } from './RolloutTimesteps';
import { CoordsEncodingLayer } from './CoordsEncodingLayer';
import { TensorMap, disposeAll, hashCode } from './utils/tensorflow';

export interface ShallowEncoderLayerConfig {
  name: string;
}

export class ShallowEncoderLayer {
  private encoder: RolloutTimesteps;
  private name: string;
  private built: boolean = false;
  private namePrefix: string;

  /**
   * Initialize the shallow encoder layer.
   *
   * Creates a RolloutTimesteps wrapper around CoordsEncodingLayer(32).
   */
  constructor(config: ShallowEncoderLayerConfig) {
    this.name = config.name;
    this.namePrefix = `${hashCode(this.name)}_`;

    // Only store config, don't build encoder yet
  }

  /**
   * Build the shallow encoder layer.
   *
   * ✅ FIXED: Explicit build method following good patterns
   */
  public build(inputShape: number[]): void {
    if (this.built) {
      console.warn('ShallowEncoderLayer already built. Skipping.');
      return;
    }

    const namePrefix = this.namePrefix;

    // ✅ FIXED: Wrap in RolloutTimesteps to apply per-timestep
    const layerFactory: LayerFunction = (name: string) =>
      new CoordsEncodingLayer({
        N: 32,
        raw: false,
        name: `${name}/CoordsEncoding`,
      });
    this.encoder = new RolloutTimesteps(layerFactory, { name: `${this.name}/Encoder` });

    // Build the rollout encoder with the correct input shape
    this.encoder.build([null, inputShape[1], 1, inputShape[2]]);

    // Build the layers with dummy input to initialize computational graph
    this.built = true;
    const input = tf.zeros(
      inputShape.map(x => x || 1),
      'float32'
    );
    const res = this.apply(input, false);
    disposeAll([input, res]);
  }

  /**
   * Encode temporal input.
   *
   * Pipeline:
   * 1. Expand dims: (B, T, 1) -> (B, T, 1, 1) for CoordsEncodingLayer
   * 2. Apply RolloutTimesteps wrapper (flattens B*T, applies coords encoding, reshapes back)
   * 3. Reshape output: (B, T, 32)
   *
   * Args:
   *   data: Input tensor of shape (B, T, 1) containing time values
   *   training: Whether in training mode
   *
   * Returns:
   *   Encoded tensor of shape (B, T, 32)
   */
  apply(data: tf.Tensor, training: boolean): tf.Tensor {
    if (!this.built) {
      throw new Error(
        `ShallowEncoderLayer.${this.name} not built. Call build() first before apply().`
      );
    }

    return tf.tidy(() => {
      const batchSize = data.shape[0]!;
      const timestepsCount = data.shape[1]!;

      // ✅ FIXED: Expand dims for proper format: (B, T, 1) -> (B, T, 1, 1)
      // This creates 4D input which RolloutTimesteps will flatten to (B*T, 1, 1)
      // Then CoordsEncodingLayer processes it as (batch=B*T, points=1, coord_dim=1)
      const expanded = tf.expandDims(data, -2);

      // ✅ FIXED: Process through rollout encoder
      // After rollout flattening: (B*T, 1, 1)
      // After coords encoding: (B*T, 1, 32)
      // After rollout reshaping: (B, T, 1, 32)
      const encodedTimesteps = this.encoder.apply(expanded, training);

      // ✅ FIXED: Reshape to remove points dimension: (B, T, 1, 32) -> (B, T, 32)
      if (encodedTimesteps instanceof tf.Tensor) {
        return tf.reshape(encodedTimesteps, [batchSize, timestepsCount, 32]);
      }

      throw new Error('RolloutTimesteps should return a Tensor');
    });
  }

  /**
   * Load weights from TensorMap
   */
  async loadWeights(weightsMap: TensorMap): Promise<void> {
    if (!this.built) {
      throw new Error(
        `ShallowEncoderLayer.${this.name} not built. Call build() first before apply().`
      );
    }

    const name = this.name;

    console.log(`[ShallowEncoderLayer.${name}] Loading weights`);

    await this.encoder.loadWeights(weightsMap);

    console.log(`[ShallowEncoderLayer.${name}] ✓ All components loaded`);
  }

  dispose(): void {
    if (this.encoder) {
      disposeAll([this.encoder]);
      this.encoder = null as any;
    }
  }
}
