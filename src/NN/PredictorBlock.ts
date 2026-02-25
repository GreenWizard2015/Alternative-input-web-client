/**
 * PredictorBlock - Final prediction layer for gaze outputs.
 *
 * Simplified implementation that only outputs 2D gaze points:
 * - Takes latents from GazePredictionModel as input
 * - Processes through shared MLP and gaze prediction head
 * - Outputs only 2D gaze points with shift(0.5) normalization
 *
 * Simplified architecture:
 * - Shared MLP processes latents into features using [128, 128, 128] architecture
 * - PredictorGaze: Processes features through sMLP → Dense(2) + shift(0.5)
 *
 * ⚠️ **IMPLEMENTATION DIFFERENCES FROM PYTHON**:
 * - Python uses separate layer classes: PredictorGaze, PredictorEyes, PredictorFace
 * - TypeScript uses tf.sequential MLP for shared processing + dedicated PredictorGaze class
 * - Both produce identical output shapes for gaze predictions
 * - **Risk**: Low - Only gaze prediction is implemented
 * - **Python Ref**: /NN/models/PredictorBlock.py (and PredictorGaze.py)
 *
 * Usage:
 * ```typescript
 * const predictor = new PredictorBlock({ latentSize: 64 });
 * await predictor.loadWeights('predictorBlock.zip');
 * const results = predictor.call(latents);
 * ```
 */

import * as tf from '@tensorflow/tfjs';
import * as tfl from '@tensorflow/tfjs-layers';
import { disposeAll, hashCode, TensorMap } from './utils/tensorflow';
import { PredictorGaze } from './PredictorGaze';
import { sMLP } from './sMLP';
import {
  PREDICTOR_BLOCK_MLP_SIZES,
  PREDICTOR_BLOCK_SHIFT,
  PREDICTOR_BLOCK_OUTPUT_DIMS,
  DROPOUT_RATE_LOW,
  MLP_SIZES_SMALL,
} from './Constants';

export interface PredictorBlockConfig {
  latentSize: number;
  name?: string; // Optional name for layer naming
}

export interface PredictorBlockInputs<T> {
  latents: T; // [batch, timesteps, latentSize]
}

export interface PredictorBlockResult {
  result: tf.Tensor; // [batch, timesteps, 2] - gaze points
}

export class PredictorBlock {
  private config: PredictorBlockConfig;
  private sharedMLP: sMLP;
  private mlpNorm: tfl.layers.Layer;
  private predictorGaze: PredictorGaze;
  private name: string;
  private built: boolean = false;

  constructor(config: PredictorBlockConfig) {
    this.config = config;
    this.name = config.name || 'predictor_block';
  }

  /**
   * Apply forward pass (with built check).
   *
   * @param inputs - Input latents
   * @param training - Whether in training mode
   * @returns Predictions based on mode
   */
  apply(inputs: PredictorBlockInputs<tf.Tensor>, training: boolean): PredictorBlockResult {
    if (!this.built) {
      throw new Error('PredictorBlock not built. Call build() first before apply().');
    }

    // Use tf.tidy to automatically clean up intermediate tensors
    return tf.tidy(() => {
      const originalShape = inputs.latents.shape;
      const batchSize = originalShape[0];
      const timesteps = originalShape[1];
      const latentSize = originalShape[2];

      // Process through shared MLP
      const reshapedLatents = tf.reshape(inputs.latents, [batchSize * timesteps, latentSize]);
      const mlpOutput = this.sharedMLP.apply(reshapedLatents, training) as tf.Tensor;

      // Apply batch normalization (matches Python implementation)
      const normalizedFeatures = this.mlpNorm.apply(mlpOutput, { training }) as tf.Tensor;

      // Reshape features back to [batch, timesteps, feature_dim] for PredictorGaze
      const reshapedFeatures = tf.reshape(normalizedFeatures, [
        batchSize,
        timesteps,
        MLP_SIZES_SMALL[2],
      ]);

      // Process through PredictorGaze (handles shift internally)
      const gazeResult = this.predictorGaze.apply(reshapedFeatures, training);

      return { result: gazeResult };
    });
  }

  /**
   * Load weights
   */
  async loadWeights(weightsData: TensorMap): Promise<void> {
    if (!this.built) {
      throw new Error('PredictorBlock not built. Call build() first before loadWeights().');
    }

    // Load shared MLP weights
    await this.loadSharedMLPWeights(weightsData);

    // Load PredictorGaze weights
    await this.predictorGaze.loadWeights(weightsData);

    // Load normalization weights for batch normalization layer
    await this.loadNormalizationWeights(weightsData);
  }

  /**
   * Load shared MLP weights using sMLP class.
   */
  private async loadSharedMLPWeights(weightsData: TensorMap): Promise<void> {
    // The sMLP class expects the full TensorMap with proper key access tracking
    await this.sharedMLP.loadWeights(weightsData);
  }

  /**
   * Load normalization weights for batch normalization layer
   */
  private async loadNormalizationWeights(weightsData: TensorMap): Promise<void> {
    if (!this.mlpNorm) {
      throw new Error('MLP normalization layer not built. Call build() first.');
    }

    // Load normalization weights using assignNorm (works with both layer norm and batch norm)
    weightsData.assignNorm(`${this.name}/MLPNorm`, this.mlpNorm);
    console.log(`Loaded normalization weights for ${this.name}/MLPNorm layer`);
  }

  /**
   * Dispose all resources and clean up model.
   */
  dispose(): void {
    disposeAll([this.sharedMLP, this.mlpNorm, this.predictorGaze]);

    // Clear references
    this.sharedMLP = null as any;
    this.mlpNorm = null as any;
    this.predictorGaze = null as any;
  }

  /**
   * Build the model with input shapes.
   */
  build(inputShapes: PredictorBlockInputs<number[]>): void {
    // Calculate the 2D shape for shared MLP (batch * timesteps, latent_size)
    const batchSize = inputShapes.latents[0];
    const timesteps = inputShapes.latents[1];
    const latentSize = inputShapes.latents[2];
    const mlpInputShape = [batchSize * timesteps, latentSize];

    // Create shared MLP
    this.sharedMLP = new sMLP({
      sizes: [...MLP_SIZES_SMALL],
      activation: 'relu',
      dropout: DROPOUT_RATE_LOW,
      useBatchNorm: false,
      name: `${this.name}/MLP`,
    });
    this.sharedMLP.build(mlpInputShape);

    // Create batch normalization layer (matches Python implementation)
    this.mlpNorm = tfl.layers.batchNormalization({
      name: `${hashCode(this.name)}_MLPNorm`,
    });

    // Build batch normalization layer
    this.mlpNorm.build([batchSize * timesteps, MLP_SIZES_SMALL[2]]);

    // Create PredictorGaze
    this.predictorGaze = new PredictorGaze({
      name: `${this.name}/PredictorGaze`,
      shift: PREDICTOR_BLOCK_SHIFT,
    });

    // Build PredictorGaze with the expected input shape [batch, timesteps, feature_dim]
    const featureDim = MLP_SIZES_SMALL[2]; // Output from shared MLP
    this.predictorGaze.build([inputShapes.latents[0], inputShapes.latents[1], featureDim]);

    // Test the pipeline with dummy inputs
    const dummyInputs: PredictorBlockInputs<tf.Tensor> = {
      latents: tf.zeros(inputShapes.latents),
    };

    // Set built flag BEFORE calling apply() to allow dummy input test
    this.built = true;
    this.apply(dummyInputs, false);
    console.log('PredictorBlock built successfully');
  }
}
