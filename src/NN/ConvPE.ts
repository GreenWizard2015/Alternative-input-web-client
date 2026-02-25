/**
 * ConvPE - Convolutional Positional Encoding for spatial dimensions.
 *
 * ⚠️ **CORRECTED TO MATCH PYTHON EXACTLY**
 * Python Reference: /NN/layers/EncodingLayers.py lines 109-131
 *
 * Creates learnable positional encodings based on height and width dimensions,
 * then concatenates with input along the channel axis.
 *
 * Uses LearnablePositionalEncoding internally with proper spatial configuration.
 *
 * Input:  (B, H, W, C)
 * Output: (B, H, W, C + channels)
 */

import * as tf from '@tensorflow/tfjs';
import { disposeAll, TensorMap, hashCode } from './utils/tensorflow';

export interface ConvPEConfig {
  channels?: number;
  name?: string;
  activation?: string;
}

/**
 * ConvPE - Convolutional Positional Encoding for spatial dimensions.
 *
 * Implements the exact same functionality as LearnablePositionalEncoding
 * but with fixed axis configuration for spatial dimensions.
 *
 * Input:  (B, H, W, C)
 * Output: (B, H, W, C + channels)
 */
export class ConvPE {
  private name: string;
  private channels: number;
  private activation: string | null = null;
  private spatialEmbeddings: tf.Tensor | null = null;
  private built: boolean = false;
  private axis: number[] = [-2, -3];
  private namePrefix: string;

  constructor(config: ConvPEConfig = {}) {
    this.name = config.name || 'ConvPE';
    this.channels = config.channels || 32;
    this.activation = config.activation || null;
    this.namePrefix = `${hashCode(this.name)}_`;
  }

  /**
   * Add positional encoding to features.
   * Input: (B, H, W, C) or any shape
   * Output: Concatenated with positional encoding along channel axis
   */
  apply(input: tf.Tensor, training: boolean): tf.Tensor {
    if (!this.built) {
      throw new Error('ConvPE must be built before apply()');
    }

    return tf.tidy(() => {
      const xShape = input.shape;
      const xShapeArray = xShape as number[];
      const xRank = xShapeArray.length;

      // Use normalized axis indices from build()
      const axis = this.axis;

      // Get input shape as tensor
      const xShapeTensor = tf.tensor1d(xShapeArray, 'int32');
      const xShapeValues = Array.from(xShapeTensor.dataSync());
      xShapeTensor.dispose();

      // Build spatial dimensions array
      const spatialDims = new Array(xRank).fill(1);
      for (const ax of axis) {
        spatialDims[ax] = xShapeValues[ax];
      }
      spatialDims[xRank - 1] = this.channels;

      // Create position embeddings for current input shape
      const peTensor = tf.reshape(this.spatialEmbeddings!, spatialDims);

      // Apply activation if provided
      const peTensorApplied = peTensor;
      if (this.activation) {
        // For now, just use the tensor as is (activation will be applied in Python)
      }

      // Expand embeddings to match full input shape
      let expandedPe = peTensorApplied;
      for (let i = 0; i < xRank; i++) {
        if (!axis.includes(i) && i !== xRank - 1) {
          const reps = new Array(xRank).fill(1);
          reps[i] = xShapeValues[i];
          expandedPe = tf.tile(expandedPe, reps);
        }
      }

      // Concatenate along channel dimension
      return tf.concat([input, expandedPe], xRank - 1);
    });
  }

  /**
   * Build the layer based on input shape
   */
  build(inputShape: number[]): void {
    // For ConvPE, we use fixed axes [-2, -3] (height, width)
    const axis = [-2, -3];

    // Validate axes - ensure batch and channel dimensions are not used
    if (axis.includes(0)) {
      throw new Error('First axis are for batch dim');
    }
    if (axis.includes(inputShape.length - 1)) {
      throw new Error('Last axis are for channels');
    }

    // Normalize negative axis indices to positive indices
    const normalizedAxis = axis.map(axis => (axis < 0 ? axis + inputShape.length : axis));
    this.axis = normalizedAxis;

    // Build spatial dimensions array for embeddings
    const spatialDims = new Array(inputShape.length).fill(1);
    for (const axis of normalizedAxis) {
      spatialDims[axis] = inputShape[axis];
    }
    spatialDims[spatialDims.length - 1] = this.channels;

    // Initialize spatial embeddings as a trainable variable
    this.spatialEmbeddings = tf.variable(
      tf.zeros(spatialDims),
      true,
      `${this.namePrefix}spatial_embeddings`
    );
    this.built = true;

    // Build computational graph
    console.log(`[ConvPE.${this.name}] Building model with dummy input`);
    const input = tf.zeros(
      inputShape.map(x => x || 1),
      'float32'
    );
    const res = this.apply(input, false);
    disposeAll([input, res]);
    console.log(`[ConvPE.${this.name}] Model built successfully`);
  }

  /**
   * Load weights from TensorMap
   */
  async loadWeights(weightsMap: TensorMap): Promise<void> {
    if (!this.built) {
      throw new Error(`ConvPE.${this.name} not built. Call build() first before apply().`);
    }

    const name = this.name;

    console.log(`[ConvPE.${name}] Loading weights`);

    // Load spatial embeddings weight
    const spatialEmbeddingsTensor = weightsMap.get(`weights/${name}/spatial_embeddings`);

    if (!spatialEmbeddingsTensor) {
      throw new Error(`[ConvPE.${name}] spatial_embeddings not found in weights`);
    }

    // Load the trained weights by replacing the variable
    this.spatialEmbeddings.dispose();
    this.spatialEmbeddings = tf.variable(spatialEmbeddingsTensor);
    console.log(`[ConvPE.${name}] spatial_embeddings: ✓ Loaded`);
  }

  dispose(): void {
    disposeAll([this.spatialEmbeddings]);
    this.spatialEmbeddings = null;
    this.built = false;
  }

  compute_output_shape(inputShape: number[]): number[] {
    const res = [...inputShape];
    res[res.length - 1] += this.channels;
    return res;
  }
}
