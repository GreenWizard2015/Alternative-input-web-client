/**
 * Positional Encoding Layers
 *
 * - LearnablePositionalEncoding: Learnable absolute position embeddings
 * - ConvPE: Convolutional positional encoding for spatial dimensions
 *
 * LearnablePositionalEncoding:
 * - Creates learnable positional embeddings based on specified axes
 * - Supports multi-dimensional spatial encoding (not just 1D sequence positions)
 * - Uses trainable tf.Variable for spatial_embeddings
 * - Follows Python implementation from /home/anton/Documents/Development/Alternative-input/NN/layers/EncodingLayers.py
 *
 * Usage:
 * ```typescript
 * // Basic usage with default parameters
 * const posEnc = new LearnablePositionalEncoding({
 *   name: 'my_positional_encoding'
 * });
 *
 * // With custom parameters
 * const posEnc = new LearnablePositionalEncoding({
 *   channels: 64,          // Number of positional encoding channels
 *   activation: 'relu',     // Optional activation function
 *   axis: [-2, -1],        // Spatial axes (width, height for 2D)
 *   name: 'spatial_pe'
 * });
 *
 * // Build layer and apply
 * posEnc.build(inputShape);  // inputShape = [batch, height, width, channels]
 * const encoded = posEnc.apply(inputFeatures);
 *
 * // Load trained weights from TensorMap
 * await posEnc.loadWeights(weightsMap);
 * ```
 */

import * as tf from '@tensorflow/tfjs';
import * as tfl from '@tensorflow/tfjs-layers';
import { disposeAll, TensorMap } from './utils/tensorflow';
import { DEFAULT_POSITIONAL_ENCODING_CHANNELS } from './Constants';

/**
 * LearnablePositionalEncoding - Learnable absolute position embeddings.
 * Similar to nn.Embedding in PyTorch.
 */
export interface LearnablePositionalEncodingConfig {
  channels?: number; // Number of positional encoding channels (default: DEFAULT_POSITIONAL_ENCODING_CHANNELS)
  activation?: string | null; // Optional activation function (default: None)
  axis?: number | number[]; // Axes used to build embeddings. Can be single int or list of ints.
  // Negative indices refer to dimensions from the end.
  // For input (B, H, W, C), -2 uses width dimension (default: -2)
  name: string; // Layer name (required)
}

export class LearnablePositionalEncoding {
  private name: string;
  private channels: number;
  private axis: number[];
  private activation: string | null = null;
  private spatialEmbeddings: tf.Tensor | null = null;
  private built: boolean = false;

  constructor(config: LearnablePositionalEncodingConfig) {
    this.name = config.name;
    this.channels = config.channels || DEFAULT_POSITIONAL_ENCODING_CHANNELS;

    // Handle axis parameter
    this.axis = Array.isArray(config.axis)
      ? config.axis
      : config.axis !== undefined
        ? [config.axis]
        : [-2];

    // Set up activation if provided
    this.activation = config.activation || null;
  }

  /**
   * Add positional encoding to features.
   * Input: (B, H, W, C) or (B, T, H, W, C) or any shape
   * Output: Concatenated with positional encoding along channel axis
   */
  apply(input: tf.Tensor, training: boolean): tf.Tensor {
    if (!this.built) {
      throw new Error('LearnablePositionalEncoding must be built before apply()');
    }

    return tf.tidy(() => {
      const xShape = input.shape;
      const xShapeArray = xShape as number[];
      const xRank = xShapeArray.length;

      // Get input shape as tensor
      const xShapeTensor = tf.tensor1d(xShapeArray, 'int32');
      const xShapeValues = Array.from(xShapeTensor.dataSync());
      xShapeTensor.dispose();

      // Build spatial dimensions array
      const spatialDims = new Array(xRank).fill(1);
      for (const axis of this.axis) {
        spatialDims[axis] = xShapeValues[axis];
      }
      spatialDims[xRank - 1] = this.channels;

      // Create position embeddings for current input shape
      const peTensor = tf.reshape(this.spatialEmbeddings!, spatialDims);

      // Apply activation if provided
      const peTensorApplied = peTensor;
      if (this.activation) {
        // For now, just use the tensor as is (activation will be applied in Python)
        // We could implement activation functions here if needed
      }

      // Expand embeddings to match full input shape
      let expandedPe = peTensorApplied;
      for (let i = 0; i < xRank; i++) {
        if (!this.axis.includes(i) && i !== xRank - 1) {
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
    // Normalize negative axis indices to positive indices
    const normalizedAxis = this.axis.map(axis => (axis < 0 ? axis + inputShape.length : axis));

    // Validate axes - ensure batch and channel dimensions are not used
    if (normalizedAxis.includes(0)) {
      throw new Error('First axis are for batch dim');
    }
    if (normalizedAxis.includes(inputShape.length - 1)) {
      throw new Error('Last axis are for channels');
    }

    // Update our axis
    this.axis = normalizedAxis;

    // Build spatial dimensions array for embeddings
    const spatialDims = new Array(inputShape.length).fill(1);
    for (const axis of this.axis) {
      spatialDims[axis] = inputShape[axis];
    }
    spatialDims[spatialDims.length - 1] = this.channels;

    // Initialize spatial embeddings as a trainable variable
    this.spatialEmbeddings = tf.variable(tf.zeros(spatialDims));
    this.built = true;

    // BAD BUT WORKING - build computational graph
    console.log(`[LearnablePositionalEncoding.${this.name}] Building model with dummy input`);
    const input = tf.zeros(
      inputShape.map(x => x || 1),
      'float32'
    );
    const res = this.apply(input, false);
    disposeAll([input, res]);
    console.log(`[LearnablePositionalEncoding.${this.name}] Model built successfully`);
  }

  /**
   * Load weights from TensorMap
   */
  async loadWeights(weightsMap: TensorMap): Promise<void> {
    if (!this.built) {
      throw new Error(
        `LearnablePositionalEncoding.${this.name} not built. Call build() first before apply().`
      );
    }

    const name = this.name;

    console.log(`[LearnablePositionalEncoding.${name}] Loading weights`);

    // Load spatial embeddings weight
    const spatialEmbeddingsTensor = weightsMap.get(`weights/${name}/spatial_embeddings`);

    if (!spatialEmbeddingsTensor) {
      throw new Error(
        `[LearnablePositionalEncoding.${name}] spatial_embeddings not found in weights`
      );
    }

    // Load the trained weights by replacing the variable
    this.spatialEmbeddings.dispose();
    this.spatialEmbeddings = tf.variable(spatialEmbeddingsTensor);
    this.built = true;
    console.log(`[LearnablePositionalEncoding.${name}] spatial_embeddings: ✓ Loaded`);
  }

  dispose(): void {
    disposeAll([this.spatialEmbeddings]);
    this.spatialEmbeddings = null;
    this.built = false;
  }
}
