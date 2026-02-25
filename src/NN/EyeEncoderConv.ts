/**
 * EyeEncoderConv - Multi-scale convolutional eye encoder.
 *
 * ⚠️ **REFACTORED TO MATCH PYTHON EXACTLY**
 * Python Reference: /NN/models/EyeEncoder.py lines 21-140
 *
 * Encodes stereo eye images (32x32) through SEQUENTIAL dual-scale processing.
 * - scale0 receives ConvPE output (B, 32, 32, 16) → outputs 32 channels
 * - scale1 receives scale0's conv1 output (B, 32, 32, 32) → outputs 32 channels
 * Each scale applies convolutions and LinearAttentionMixer pooling.
 *
 * Input:  (B, H, W, 2)  - Concatenated left and right eye images (32, 32, 2)
 * Output: List[(B, latentSize), (B, latentSize)]  - Per-scale features
 */

import * as tf from '@tensorflow/tfjs';
import { ConvPE } from './ConvPE';
import { EyeEncoderStage } from './EyeEncoderStage';
import {
  EYE_ENCODER_CONV_FILTERS,
  EYE_ENCODER_CONV_KERNEL,
  EYE_ENCODER_CONV_PADDING,
  EYE_ENCODER_CONV2LATENT_CONV_PE_CHANNELS,
  STANDARD_NONNEGATIVE_ACTIVATION,
  DEFAULT_LATENT_SIZE,
  EYE_SIZE,
} from './Constants';
import { TensorMap, disposeAll } from './utils/tensorflow';

type ConvPEWeights = { [key: string]: tf.Tensor };

export interface EyeEncoderConvConfig {
  latentSize?: number; // Output dimension (default: 256)
  scaleMult?: number; // Filter scaling multiplier (default: 1.0)
  name: string;
}

export class EyeEncoderConv {
  private latentSize: number;
  private scaleMult: number;
  private name: string;
  private built: boolean = false;
  private convPE: ConvPE | null = null;
  private scaleLayers: EyeEncoderStage[] = [];

  constructor(config: EyeEncoderConvConfig) {
    this.latentSize = config.latentSize ?? 128; // Default to 128 to match weights
    this.scaleMult = config.scaleMult ?? 1.0; // Default to 1.0
    this.name = config.name;

    if (this.scaleMult <= 0) {
      throw new Error(`scaleMult must be positive, got ${this.scaleMult}`);
    }
  }

  /**
   * Build the EyeEncoderConv model structure - MATCH PYTHON AUTO-INFERENCES
   */
  public build(inputShape: number[]): void {
    if (this.scaleLayers.length > 0) {
      console.warn(`EyeEncoderConv.${this.name} already built. Skipping.`);
      return;
    }

    // ✅ FIXED: Initialize ConvPE with Python constants
    this.convPE = new ConvPE({
      channels: EYE_ENCODER_CONV2LATENT_CONV_PE_CHANNELS,
      name: `${this.name}/conv_pe`,
    });

    // ✅ FIXED: Compute scaled filters from Python constants
    const scaledFilters = EYE_ENCODER_CONV_FILTERS.map(f => Math.floor(f * this.scaleMult));
    console.log(
      `[EyeEncoderConv.${this.name}] scaledFilters: ${JSON.stringify(scaledFilters)}, latentSize: ${this.latentSize}, scaleMult: ${this.scaleMult}`
    );

    // ✅ FIXED: Build EyeEncoderStage instances (dual-scale, matching Python)
    for (let scaleIdx = 0; scaleIdx < scaledFilters.length; scaleIdx++) {
      const numFilters = scaledFilters[scaleIdx];
      console.log(
        `[EyeEncoderConv.${this.name}] Creating stage ${scaleIdx} with numFilters: ${numFilters}`
      );

      const scaleLayers = new EyeEncoderStage({
        numFilters: numFilters,
        latentSize: this.latentSize,
        name: `${this.name}/stage_${scaleIdx}`,
      });

      this.scaleLayers.push(scaleLayers);
    }

    console.log(
      `[EyeEncoderConv.${this.name}] Building model with input shape: ${JSON.stringify(inputShape)}`
    );
    this.convPE.build(inputShape);

    // Build all EyeEncoderStage instances with correct sequence of input shapes
    // Start with ConvPE output shape
    let currentShape = this.convPE.compute_output_shape(inputShape);

    for (let i = 0; i < this.scaleLayers.length; i++) {
      const stage = this.scaleLayers[i];
      stage.build(currentShape);

      // EyeEncoderStage outputs [downsampled_feature_map, latent]
      const halfSize = currentShape[1] / 2;
      const numFilters = EYE_ENCODER_CONV_FILTERS[i];
      currentShape = [1, halfSize, halfSize, numFilters]; // Next stage input shape
    }

    // Test the model
    this.built = true;
    const input = tf.zeros(
      inputShape.map(x => x || 1),
      'float32'
    );
    const res = this.apply(input);
    disposeAll([input, res]);
    console.log(`[EyeEncoderConv.${this.name}] Model built successfully`);
  }

  /**
   * Process stereo eye images through dual-scale encoder.
   * ✅ MATCHES PYTHON EXACTLY
   *
   * Input:  (B, H, W, 2)  - Stereo eye images (32, 32, 2)
   * Output: List[(B, latentSize), (B, latentSize)]  - Per-scale features
   */
  apply(inputs: tf.Tensor): tf.Tensor[] {
    return tf.tidy(() => {
      if (inputs.shape.length !== 4 || inputs.shape[3] !== 2) {
        throw new Error(
          `EyeEncoderConv expects input shape (batch, height, width, 2), got ${inputs.shape}`
        );
      }

      const batchSize = inputs.shape[0] as number;

      // ✅ FIXED: Apply ConvPE positional encoding at input
      const x = this.convPE!.apply(inputs.cast('float32'), false);
      console.log(`[EyeEncoderConv.${this.name}] ConvPE output shape: ${x.shape}`);

      const multiScaleFeatures: tf.Tensor[] = [];

      // ✅ CRITICAL FIX: Scales are SEQUENTIAL, not parallel
      // scale0 input: (B, 32, 32, 16) from ConvPE
      // scale1 input: (B, 32, 32, 32) from scale0_conv1 output
      let scaleInput = x;

      // ✅ FIXED: Process scales sequentially (scale0 → scale1) using EyeEncoderStage
      for (let i = 0; i < this.scaleLayers.length; i++) {
        const stage = this.scaleLayers[i];
        console.log(`[EyeEncoderConv.${this.name}] Stage ${i} input shape: ${scaleInput.shape}`);

        // Each EyeEncoderStage processes the current input and returns [x, latentOutput]
        const [scaleX, latent] = stage.apply(scaleInput, false);
        console.log(
          `[EyeEncoderConv.${this.name}] Stage ${i} output shapes: ${scaleX.shape}, ${latent.shape}`
        );

        // ✅ FIXED: Scale1 input for next iteration is the conv1 output (before conv2/downsample)
        scaleInput = scaleX;

        multiScaleFeatures.push(latent);
      }

      return multiScaleFeatures;
    });
  }

  async loadWeights(weightsMap: TensorMap): Promise<void> {
    if (!this.built) {
      throw new Error(`EyeEncoderConv.${this.name} not built. Call build() first before apply().`);
    }

    const name = this.name;

    console.log(`[EyeEncoderConv.${name}] Loading weights`);

    // Load ConvPE weights using EXACT name pattern - NO SEARCHING, NO TRANSFORMATIONS
    if (this.convPE) {
      await this.convPE.loadWeights(weightsMap);
      console.log(`[EyeEncoderConv.${name}] ConvPE weights loaded`);
    }

    // Load scale-specific weights using EXACT name pattern - NO SEARCHING
    for (let scaleIdx = 0; scaleIdx < this.scaleLayers.length; scaleIdx++) {
      const stage = this.scaleLayers[scaleIdx];
      await stage.loadWeights(weightsMap);
      console.log(`[EyeEncoderConv.${name}] stage_${scaleIdx}: ✓ Weights loaded`);
    }

    console.log(`[EyeEncoderConv.${name}] All weights loaded`);
  }

  dispose(): void {
    disposeAll(this.scaleLayers);
    disposeAll(this.convPE);
    this.convPE = null as any;
    this.scaleLayers = [];
  }
}
