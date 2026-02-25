/**
 * sMLP - Simple Multi-Layer Perceptron.
 *
 * MLP implementation using individual MLPStage objects for cleaner architecture.
 * Used by:
 * - TransformerEncoderBlock (feed-forward network)
 * - PredictorBlock (gaze/eyes/face prediction)
 * - EyeEncoder (feature extraction)
 *
 * Supports configurable depth, width, activation, and dropout.
 *
 * Usage:
 * ```typescript
 * const mlp = new sMLP({
 *   sizes: [64, 256, 64],
 *   activation: 'relu',
 *   dropout: 0.1
 * });
 * const output = mlp.apply(inputs);  // [batch, seq, 64] → [batch, seq, 64]
 * ```
 */

import * as tf from '@tensorflow/tfjs';
import * as tfl from '@tensorflow/tfjs-layers';

// Import TensorMap type from utils
import { TensorMap, disposeAll, hashCode } from './utils/tensorflow';
import { STANDARD_NONNEGATIVE_ACTIVATION } from './Constants';

export interface sMLPConfig {
  sizes?: number[]; // List of layer sizes (Python-style: [384, 256, 128])
  activation?: string; // Activation function (default: STANDARD_NONNEGATIVE_ACTIVATION)
  dropout?: number; // Dropout rate (default: 0.0, range 0-1)
  useBatchNorm?: boolean; // Use layer normalization (default: false) - named for Python compatibility
  name: string; // Layer name
}

interface MLPStage {
  dense: tfl.layers.Layer;
  dropout?: tfl.layers.Layer;
  norm?: tfl.layers.Layer;
}

export class sMLP {
  private config: sMLPConfig;
  private nLayers: number;
  private activation: string;
  private dropout: number;
  private sizes: number[]; // Layer sizes (like Python)
  private built: boolean = false;
  private outputShape: number[] | null = null;
  private name: string;
  private namePrefix: string;

  // Array of MLPStage objects
  private stages: MLPStage[] = [];

  constructor(config: sMLPConfig) {
    this.validateConfig(config);
    this.config = config;
    this.name = config.name; // Initialize name property
    this.namePrefix = `${hashCode(this.name)}_`;

    // Use Python-style sizes approach
    this.sizes = config.sizes;
    this.nLayers = this.sizes.length;
    this.activation = config.activation ?? STANDARD_NONNEGATIVE_ACTIVATION;
    this.dropout = config.dropout ?? 0.0;
  }

  /**
   * Build the MLPStage objects (like Python reference)
   */
  public build(inputShape): void {
    if (this.built) {
      console.warn('Layer already built. Skipping.');
      return;
    }

    for (let i = 0; i < this.nLayers; i++) {
      const size = this.sizes[i];
      const stage: MLPStage = {
        dense: tfl.layers.dense({
          units: size,
          activation: this.activation as any,
          name: `${this.namePrefix}dense-${i}`,
        }),
      };

      // Add normalization if enabled
      if (this.config.useBatchNorm) {
        stage.norm = tfl.layers.layerNormalization({
          axis: -1, // Use -1 for last dimension (features) - works for any tensor rank
          name: `${this.namePrefix}norm-${i}`,
        });
      }

      // Dropout (optional, before dense like Python)
      if (this.dropout > 0) {
        stage.dropout = tfl.layers.dropout({
          rate: this.dropout,
          name: `${this.namePrefix}dropout-${i}`,
        });
      }

      this.stages.push(stage);
    }

    // Set built flag before building computational graph
    this.built = true;

    // BAD BUT WORKING - build computational graph
    console.log(`[sMLP.${this.config.name}] Building model with dummy input`);
    const input = tf.zeros(
      inputShape.map(x => x || 1),
      'float32'
    );
    const res = this.apply(input, false);
    disposeAll([input, res]);
    console.log(`[sMLP.${this.config.name}] Model built successfully`);

    // Store output shape after building
    this.outputShape = [inputShape[0], inputShape[1], this.sizes[this.sizes.length - 1]];
  }

  /**
   * Validate configuration parameters
   */
  private validateConfig(config: sMLPConfig): void {
    if (config.sizes) {
      if (config.sizes.some(s => s < 1)) throw new Error('All sizes must be >= 1');
    }
    if (config.dropout && (config.dropout < 0 || config.dropout > 1)) {
      throw new Error('dropout must be between 0 and 1');
    }
  }

  /**
   * Forward pass through MLP.
   *
   * @param inputs - Tensor of shape [batch, seq, inputSize]
   * @param training - Whether in training mode (affects dropout)
   * @returns Tensor of shape [batch, seq, outputSize]
   */
  apply(inputs: tf.Tensor, training: boolean): tf.Tensor {
    if (!this.built) {
      throw new Error("Layer aren't built. Call build first.");
    }
    if (this.stages.length === 0) {
      throw new Error('sMLP not initialized');
    }

    return tf.tidy(() => {
      let x = inputs;

      // Apply each stage in sequence
      for (const stage of this.stages) {
        // Apply dropout if present and in training mode
        if (stage.dropout && training) {
          x = stage.dropout.apply(x) as tf.Tensor;
        }

        // Apply dense layer
        x = stage.dense.apply(x) as tf.Tensor;

        // Apply normalization if present
        if (stage.norm) {
          x = stage.norm.apply(x) as tf.Tensor;
        }
      }

      return x;
    });
  }

  /**
   * Load weights from TensorMap (using MLPStage objects)
   */
  async loadWeights(weightsMap: TensorMap): Promise<void> {
    if (!this.built) {
      throw new Error(`sMLP.${this.name} not built. Call build() first before apply().`);
    }

    console.log(`[sMLP.${this.name}] Loading weights`);
    const name = this.name ? `${this.name}/` : '';

    // Load weights for each dense layer
    for (let i = 0; i < this.stages.length; i++) {
      const stage = this.stages[i];
      const layerName = `dense-${i}`;

      // Load dense layer weights using assignDense
      weightsMap.assignDense(`${name}_F/${layerName}`, stage.dense);
      console.log(`[sMLP.${this.name}] dense-${i}: ✓ Set weights`);
      
      // Load layer normalization weights using assignNorm
      if (stage.norm) {
        weightsMap.assignNorm(`${name}_F/${layerName}`, stage.norm);
        console.log(
          `[sMLP.${this.name}] norm-${i}: ✓ Set weights`
        );
      }
    }

    console.log(`[sMLP.${this.name}] All weights loaded`);
  }

  /**
   * Get output shape (stored during build)
   */
  output_shape(): number[] {
    if (this.outputShape === null) {
      throw new Error('sMLP not built. Call build first.');
    }
    return this.outputShape;
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    if (this.stages.length > 0) {
      const layersToDispose = this.stages.flatMap(stage => [
        stage.dense,
        ...(stage.dropout ? [stage.dropout] : []),
        stage.norm,
      ]);
      disposeAll(layersToDispose);
      this.stages = [];
    }
  }
}
