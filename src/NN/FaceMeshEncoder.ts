/**
 * FaceMeshEncoder - Encodes 478 facial landmarks into feature vectors.
 *
 * ⚠️ **REFACTORED TO MATCH PYTHON EXACTLY**
 * Python Reference: /NN/models/FaceMeshEncoder.py lines 30-191
 *
 * Encodes 478 facial landmarks into a latent vector using:
 * 1. Coordinate encoding with normalized indices
 * 2. Attention-weighted pooling to aggregate landmarks
 * 3. Final projection and normalization
 *
 * Input:  (B, FACE_MESH_POINTS=478, 2)  - Facial landmark points
 * Output: (B, latent_size)                - Encoded landmark features
 *
 * Usage:
 * ```typescript
 * const encoder = new FaceMeshEncoder({ latentSize: 64 });
 * const landmarks = tf.randomNormal([32, 478, 2]);
 * const encoded = encoder.apply(landmarks); // (32, 64)
 * ```
 */

import * as tf from '@tensorflow/tfjs';
import * as tfl from '@tensorflow/tfjs-layers';
import { CoordsEncodingLayer } from './CoordsEncodingLayer';
import { LinearAttentionMixer } from './LinearAttentionMixer';
import {
  ATTENTION_HEADS_DEFAULT,
  DEFAULT_POSITIONAL_ENCODING_CHANNELS,
  FACE_MESH_INVALID_VALUE,
  FACE_MESH_POINTS,
  STANDARD_NONNEGATIVE_ACTIVATION,
} from './Constants';
import { disposeAll, hashCode } from './utils/tensorflow';

export interface FaceMeshEncoderConfig {
  latentSize?: number; // Output dimension (default: 64)
  internalLatentSize?: number; // Internal latent dimension (default: 32)
  scaleMult?: number; // Scaling multiplier (default: 1.0)
  name: string;
}

export class FaceMeshEncoder {
  private latentSize: number;
  private internalLatentSize: number;
  private scaleMult: number;
  private name: string;
  private coordEncoding: CoordsEncodingLayer;
  private coordProjection: tfl.layers.Layer | null = null;
  private finalDense: tfl.layers.Layer | null = null;
  private attentionPool: LinearAttentionMixer | null = null;
  private invalidEmbedding: tf.Variable | null = null;
  private built: boolean = false;
  private namePrefix: string;

  constructor(config: FaceMeshEncoderConfig) {
    this.latentSize = config.latentSize ?? 64;
    this.internalLatentSize = config.internalLatentSize ?? 32;
    this.scaleMult = config.scaleMult ?? 1.0;
    this.name = config.name;

    if (this.scaleMult <= 0) {
      throw new Error(`scaleMult must be positive, got ${this.scaleMult}`);
    }
    this.namePrefix = `${hashCode(this.name)}_`;
  }

  /**
   * Build the computational graph.
   *
   * This method should be called after construction to build the model with
   * dummy input to initialize all layers properly.
   */
  build(inputShape?: number[]): void {
    console.log(
      `[FaceMeshEncoder.${this.name}] Building model with input shape: ${JSON.stringify(inputShape)}`
    );

    // ✅ FIXED: Common coordinate encoding (DEFAULT_POSITIONAL_ENCODING_CHANNELS dims from Python)
    // Use name directly for consistency with dont-change implementations
    // Set raw=true to match Python implementation and weight dimensions
    this.coordEncoding = new CoordsEncodingLayer({
      N: DEFAULT_POSITIONAL_ENCODING_CHANNELS,
      raw: true,
      name: `${this.name}/coord_encoding`,
    });

    // ✅ FIXED: Project to internal latent size (match Python naming: CoordProjection)
    this.coordProjection = tfl.layers.dense({
      units: this.internalLatentSize,
      name: `${this.namePrefix}CoordProjection`,
    });

    // ✅ FIXED: Final output projection with activation (match Python naming: Final)
    this.finalDense = tfl.layers.dense({
      units: this.latentSize,
      activation: STANDARD_NONNEGATIVE_ACTIVATION,
      name: `${this.namePrefix}Final`,
    });

    // ✅ FIXED: Attention pooling using LinearAttentionMixer
    // Use name directly for consistency
    this.attentionPool = new LinearAttentionMixer({
      n_outputs: 1,
      n_heads: ATTENTION_HEADS_DEFAULT,
      name: `${this.name}/attention_pool`,
    });

    // ✅ FIXED: Learnable embedding for invalid points (match Python naming: InvalidEmbedding)
    this.invalidEmbedding = tf.variable(
      tf.zeros([this.internalLatentSize]),
      true,
      `${this.namePrefix}InvalidEmbedding`
    );

    // Build coordinate encoding first - account for normalized indices (2 -> 3 dimensions)
    // Handle null/undefined in inputShape (from RolloutTimesteps)
    const batchDim = (inputShape && inputShape[0]) || 1;
    const pointsDim = (inputShape && inputShape[1]) || FACE_MESH_POINTS;
    const buildShape = [batchDim, pointsDim, 3];
    this.coordEncoding.build(buildShape);

    // Build attention pool with proper input shape
    const attentionInputShape = [1, FACE_MESH_POINTS, this.internalLatentSize];
    this.attentionPool!.build(attentionInputShape);

    // Set built flag before calling apply() to allow dummy input test
    this.built = true;
    const input = tf.zeros(
      inputShape.map(x => x || 1),
      'float32'
    );
    const res = this.apply(input, false);
    disposeAll([input, res]);

    console.log(`[FaceMeshEncoder.${this.name}] Model built successfully`);
  }

  /**
   * Add normalized landmark indices to coordinates.
   *
   * This helps the model learn position-dependent patterns by providing
   * explicit index information for each landmark.
   *
   * Args:
   *   points: Landmark coordinates of shape (B, N, 2)
   * Returns:
   *   Points with indices of shape (B, N, 3)
   */
  private addNormalizedIndices(points: tf.Tensor): tf.Tensor {
    return tf.tidy(() => {
      const batchSize = points.shape[0] as number;
      const numPoints = points.shape[1] as number;

      // Create normalized indices [0, 1]
      const range = tf.range(0, numPoints, 1, 'float32');
      const normIdx = tf.div(range, tf.cast(tf.sub(numPoints, 1), 'float32'));

      // Repeat for batch: (N,) -> (B, N)
      const normIdxBatch = tf.tile(tf.expandDims(normIdx, 0), [batchSize, 1]);

      // Expand to (B, N, 1)
      const normIdxExpanded = tf.expandDims(normIdxBatch, -1);

      // Concatenate with coordinates: (B, N, 2) + (B, N, 1) -> (B, N, 3)
      const pointsWithIdx = tf.concat([points, normIdxExpanded], -1);
      return pointsWithIdx;
    });
  }

  /**
   * Compute mask for valid (non-invalid) landmarks.
   *
   * Args:
   *   points: Landmark coordinates of shape (B, N, 2)
   * Returns:
   *   Boolean mask of shape (B, N, 1) where true = valid point
   */
  private getValidPointsMask(points: tf.Tensor): tf.Tensor {
    return tf.tidy(() => {
      // Check if all coordinates are not equal to FACE_MESH_INVALID_VALUE
      const isNotInvalid = tf.notEqual(points, tf.scalar(FACE_MESH_INVALID_VALUE));
      // Reduce across the coordinate dimension (axis -1)
      const mask = tf.all(isNotInvalid, -1, true); // Keep dimension
      return mask;
    });
  }

  /**
   * Encode facial landmarks with attention-weighted pooling.
   *
   * Pipeline:
   * 1. Add normalized indices to coordinates
   * 2. Encode with CoordsEncodingLayer (32 dims)
   * 3. Project to internal_latent_size
   * 4. Replace invalid points with learnable embedding
   * 5. Apply attention-weighted pooling
   * 6. Final projection to latent_size
   *
   * Args:
   *   landmarks: Facial landmark points of shape (B, FACE_MESH_POINTS, 2)
   *   training: Whether in training mode
   * Returns:
   *   Latent representation of shape (B, latent_size)
   */
  apply(landmarks: tf.Tensor, training: boolean): tf.Tensor {
    return tf.tidy(() => {
      if (!this.built) {
        throw new Error(
          `FaceMeshEncoder.${this.name} must be built before calling apply(). Call build() first.`
        );
      }

      const batchSize = landmarks.shape[0] as number;
      const numPoints = landmarks.shape[1] as number;

      // ✅ FIXED: Validate input shape
      if (landmarks.shape.length !== 3 || landmarks.shape[2] !== 2) {
        throw new Error(
          `FaceMeshEncoder expects input shape (batch, ${FACE_MESH_POINTS}, 2), got ${landmarks.shape}`
        );
      }

      // ✅ FIXED: Get valid points mask
      const validMask = this.getValidPointsMask(landmarks);

      // ✅ FIXED: Add normalized indices (matches Python exactly)
      const points = this.addNormalizedIndices(landmarks);

      // ✅ FIXED: Encode coordinates (matches Python exactly - passes 3D coordinates)
      let x = this.coordEncoding.apply(points, training);
      x = this.coordProjection!.apply(x, { training }) as tf.Tensor;

      // ✅ FIXED: Replace invalid points with learnable embedding
      const invalidEmbeddingBroadcast = tf.tile(
        tf.expandDims(tf.expandDims(this.invalidEmbedding!, 0), 0),
        [batchSize, numPoints, 1]
      );

      x = tf.where(validMask as tf.Tensor, x, invalidEmbeddingBroadcast);

      // ✅ FIXED: Attention-weighted pooling
      // Input: (B, N, internal_latent_size)
      // Output: (B, 1, internal_latent_size) from n_outputs=1
      let pooled = this.attentionPool!.apply(x, false) as tf.Tensor;

      // ✅ FIXED: Squeeze n_outputs dimension
      pooled = tf.squeeze(pooled, [1]);

      // ✅ FIXED: Final projection
      const output = this.finalDense!.apply(pooled, { training }) as tf.Tensor;

      return output;
    });
  }

  dispose(): void {
    disposeAll([
      this.coordEncoding,
      this.coordProjection,
      this.finalDense,
      this.attentionPool,
      this.invalidEmbedding,
    ]);
    this.coordEncoding = null as any;
    this.coordProjection = null;
    this.finalDense = null;
    this.attentionPool = null;
    this.invalidEmbedding = null;
  }

  /**
   * Load weights from pre-extracted zip contents.
   *
   * @param weightsMap Map of filename → tf.Tensor
   */
  async loadWeights(weightsMap: any): Promise<void> {
    if (!this.built) {
      throw new Error(`FaceMeshEncoder.${this.name} not built. Call build() first before apply().`);
    }
    console.log(`[FaceMeshEncoder.${this.name}] Loading weights`);

    // Load coordinate encoding weights
    if (this.coordEncoding) {
      await this.coordEncoding.loadWeights(weightsMap);
    }

    // Load coord projection weights using assignDense helper
    weightsMap.assignDense(`${this.name}/CoordProjection`, this.coordProjection!);
    console.log(`[FaceMeshEncoder.${this.name}] CoordProjection: ✓ Loaded`);

    // Load final dense weights using assignDense helper (match Python exactly)
    weightsMap.assignDense(`${this.name}/Final`, this.finalDense!);
    console.log(`[FaceMeshEncoder.${this.name}] Final: ✓ Loaded`);

    // Load attention pool weights with strict naming pattern
    if (this.attentionPool) {
      await this.attentionPool.loadWeights(weightsMap);
    } else {
      throw new Error(`[FaceMeshEncoder.${this.name}] attentionPool not initialized`);
    }

    // Load invalid embedding weight with strict naming pattern (match Python exactly)
    const invalidEmb = weightsMap.get(`weights/${this.name}/InvalidEmbedding`);
    if (this.invalidEmbedding && invalidEmb) {
      this.invalidEmbedding.assign(invalidEmb);
      console.log(`[FaceMeshEncoder.${this.name}] invalid_embedding: ✓ Loaded`);
    } else {
      throw new Error(`[FaceMeshEncoder.${this.name}] InvalidEmbedding not initialized`);
    }

    console.log(`[FaceMeshEncoder.${this.name}] ✅ All weights loaded`);
  }
}
