/**
 * EyeEncoderStage - Single stage eye encoder component.
 *
 * Processes stereo eye images through a single scale stage:
 * - Convolutional feature extraction
 * - Spatial downsampling
 * - Latent feature mixing
 *
 * This represents one scale stage from the multi-scale EyeEncoder pipeline.
 *
 * Input:  stereoEyeImages (B, 32, 32, 2)
 * Output: { featureMap: (B, 16, 16, 32), latent: (B, 32) }
 */

import * as tf from '@tensorflow/tfjs';
import * as tfl from '@tensorflow/tfjs-layers';
import { TensorMap, disposeAll, hashCode } from './utils/tensorflow';
import { LinearAttentionMixer } from './LinearAttentionMixer';
import {
  STANDARD_NONNEGATIVE_ACTIVATION,
  CONV_KERNEL_SIZE_3,
  CONV_KERNEL_SIZE_2,
  CONV_KERNEL_SIZE_1,
  EYE_SIZE,
} from './Constants';

export interface EyeEncoderStageConfig {
  latentSize?: number; // Output latent dimension (default: 128)
  numFilters?: number; // Number of filters for convolutional layers (default: 32)
  name: string;
}

export class EyeEncoderStage {
  private conv1: tfl.layers.Layer;
  private conv2: tfl.layers.Layer;
  private convLatent: tfl.layers.Layer;
  private downsample: tfl.layers.Layer;
  private mixer: LinearAttentionMixer;
  private name: string;
  private built: boolean = false;
  private latentSize: number;
  private numFilters: number;
  private namePrefix: string;

  constructor(config: EyeEncoderStageConfig) {
    this.name = config.name;
    this.latentSize = config.latentSize ?? 128; // Default to 128 to match weights
    this.numFilters = config.numFilters ?? 32;
    this.namePrefix = `${hashCode(this.name)}_`;
  }

  /**
   * Build the EyeEncoderStage model structure - MATCH PYTHON AUTO-INFERENCES
   */
  public build(inputShape: number[]): void {
    if (this.built) {
      console.warn(`EyeEncoderStage.${this.name} already built. Skipping.`);
      return;
    }

    const namePrefix = this.namePrefix;

    // Initialize layers with proper naming - MATCH PYTHON LAYER NAMES EXACTLY
    this.conv1 = tfl.layers.conv2d({
      filters: this.numFilters,
      kernelSize: CONV_KERNEL_SIZE_3,
      padding: 'same',
      activation: 'relu', // Match Python's STANDARD_NONNEGATIVE_ACTIVATION
      name: `${namePrefix}stage_conv1`,
    });

    this.conv2 = tfl.layers.conv2d({
      filters: this.numFilters,
      kernelSize: CONV_KERNEL_SIZE_3,
      padding: 'same',
      activation: 'relu',
      name: `${namePrefix}stage_conv2`,
    });

    this.convLatent = tfl.layers.conv2d({
      filters: this.latentSize,
      kernelSize: CONV_KERNEL_SIZE_1,
      padding: 'same',
      activation: 'relu',
      name: `${namePrefix}stage_conv_latent`,
    });

    this.downsample = tfl.layers.conv2d({
      filters: this.numFilters,
      kernelSize: CONV_KERNEL_SIZE_2,
      strides: 2,
      padding: 'same',
      activation: 'relu',
      name: `${namePrefix}stage_downsample`,
    });

    // Initialize mixer as LinearAttentionMixer to match Python exactly
    this.mixer = new LinearAttentionMixer({
      n_outputs: 1, // Single output (matches Python behavior)
      max_dim: 64, // Use max_dim to get 1 head (64 // 64 = 1)
      activation: STANDARD_NONNEGATIVE_ACTIVATION, // Use standard activation
      name: `${this.name}/stage_mixer`, // Base path - LinearAttentionMixer adds _attention_weights suffix
    });

    // Build mixer with correct input shape
    this.mixer.build([null, null, this.latentSize]);

    // Use provided input shape or infer from configuration
    console.log(
      `[EyeEncoderStage.${this.name}] Building model with input shape: ${JSON.stringify(inputShape)}`
    );
    this.built = true;
    // BAD BUT WORKING
    const input = tf.zeros(
      inputShape.map(x => x || 1),
      'float32'
    );
    const res = this.apply(input, false);
    disposeAll([input, res]);
    console.log(`[EyeEncoderStage.${this.name}] Model built successfully`);
  }

  async loadWeights(weightsMap: TensorMap): Promise<void> {
    if (!this.built) {
      throw new Error(`EyeEncoderStage.${this.name} not built. Call build() first before apply().`);
    }

    const name = this.name;

    console.log(`[EyeEncoderStage.${name}] Loading weights`);

    // Load convolutional weights using assignDense helper
    weightsMap.assignDense(`${name}/stage_conv1`, this.conv1);
    console.log(`[EyeEncoderStage.${name}] stage_conv1: ✓ Set weights`);

    weightsMap.assignDense(`${name}/stage_conv2`, this.conv2);
    console.log(`[EyeEncoderStage.${name}] stage_conv2: ✓ Set weights`);

    weightsMap.assignDense(`${name}/stage_downsample`, this.downsample);
    console.log(`[EyeEncoderStage.${name}] stage_downsample: ✓ Set weights`);

    weightsMap.assignDense(`${name}/stage_conv_latent`, this.convLatent);
    console.log(`[EyeEncoderStage.${name}] stage_conv_latent: ✓ Set weights`);

    // Load mixer weights using LinearAttentionMixer's loadWeights method
    // The mixer will handle its own weight loading from the simplified keys
    await this.mixer.loadWeights(weightsMap);

    console.log(`[EyeEncoderStage.${name}] All weights loaded`);
  }

  /**
   * Process stereo eye images through single stage pipeline - MATCH PYTHON EXACTLY
   *
   * Input:  stereoEyeImages (B, 32, 32, 2)
   * Output: [featureMap, latent] tuple matching Python format
   */
  apply(x: tf.Tensor, training: boolean): [tf.Tensor, tf.Tensor] {
    if (!this.built) {
      throw new Error(`EyeEncoderStage.${this.name} not built. Call build first.`);
    }

    return tf.tidy(() => {
      // MATCH PYTHON EXACT: Apply convolutions in order
      x = this.conv1.apply(x, { training }) as tf.Tensor;
      x = this.conv2.apply(x, { training }) as tf.Tensor;
      x = this.downsample.apply(x, { training }) as tf.Tensor; // This becomes featureMap

      // Apply conv_latent AFTER downsampling to match Python
      const latent = this.convLatent.apply(x, { training }) as tf.Tensor;

      // MATCH PYTHON: Flatten spatial dimensions: (batch, h, w, c) -> (batch, num_pixels, c)
      const latentShape = latent.shape;
      const B = latentShape[0];
      const C = latentShape[3];
      const latentFlattened = tf.reshape(latent, [B, -1, C]);

      // Apply mixer and squeeze output dimension to get final latent vector
      const mixerOutput = this.mixer.apply(latentFlattened, training) as tf.Tensor;
      const latentOutput = tf.squeeze(mixerOutput, [1]); // [batch, 32]

      return [x, latentOutput]; // Return tuple matching Python format
    });
  }

  dispose(): void {
    disposeAll([this.conv1, this.conv2, this.convLatent, this.downsample, this.mixer]);
    this.conv1 = null as any;
    this.conv2 = null as any;
    this.convLatent = null as any;
    this.downsample = null as any;
    this.mixer = null as any;
  }
}
