/**
 * EyeEncoder - Multi-scale stereo eye encoder.
 *
 * ⚠️ **REFACTORED TO MATCH PYTHON EXACTLY**
 * Python Reference: /NN/models/EyeEncoder.py lines 143-231
 *
 * Encodes stereo eye images through multi-scale processing:
 * - Concatenates left and right eyes → (B, 32, 32, 2)
 * - Processes through multi-scale EyeEncoderConv
 * - Concatenates scale features and applies final mixer
 *
 * Input:  leftEye (B, 32, 32, 1), rightEye (B, 32, 32, 1)
 * Output: (B, latentSize)
 */

import * as tf from '@tensorflow/tfjs';
import * as tfl from '@tensorflow/tfjs-layers';
import { EyeEncoderConv } from './EyeEncoderConv';
import { TensorMap, disposeAll, hashCode } from './utils/tensorflow';
import { DEFAULT_LATENT_SIZE, EYE_SIZE, STANDARD_NONNEGATIVE_ACTIVATION } from './Constants';

export interface EyeEncoderConfig {
  latentSize?: number; // Output dimension (default: 256)
  scaleMult?: number; // Filter scaling multiplier (default: 1.0)
  name: string;
}

export class EyeEncoder {
  private eyeEncoderConv: EyeEncoderConv;
  private latentSize: number;
  private scaleMult: number;
  private name: string;
  private eyeMixer: tfl.layers.Layer | null = null;
  private built: boolean = false;
  private namePrefix: string;

  constructor(config: EyeEncoderConfig) {
    this.latentSize = config.latentSize;
    this.scaleMult = config.scaleMult;
    this.name = config.name;
    this.namePrefix = `${hashCode(this.name)}_`;
    this.built = false;
  }

  /**
   * Build the EyeEncoder model structure - MATCH PYTHON AUTO-INFERENCES
   */
  public build(inputShape: number[] | number[][]): void {
    if (this.built) {
      console.warn(`EyeEncoder.${this.name} already built. Skipping.`);
      return;
    }

    const namePrefix = this.namePrefix;

    // Initialize internal components during build
    this.eyeEncoderConv = new EyeEncoderConv({
      latentSize: this.latentSize,
      scaleMult: this.scaleMult,
      name: `${this.name}/eye_encoder_conv`, // Full path for nested component
    });

    // EyeEncoderConv expects stereo eye images shape (batch, 32, 32, 2)
    // If inputShape is an array of shapes, use the first one and add 2 channels
    let stereoShape: number[];
    if (Array.isArray(inputShape[0])) {
      // Use the left eye shape and add 2 channels for stereo
      stereoShape = [...inputShape[0].slice(0, 3), 2];
    } else {
      // Already the correct stereo shape
      stereoShape = inputShape as number[];
    }

    this.eyeEncoderConv.build(stereoShape);

    // Final mixer for combining scale features - MATCH PYTHON NAME
    this.eyeMixer = tfl.layers.dense({
      units: this.latentSize,
      activation: STANDARD_NONNEGATIVE_ACTIVATION,
      name: `${namePrefix}eye_mixer`,
    });

    console.log(
      `[EyeEncoder.${this.name}] Building model with input shape: ${JSON.stringify(inputShape)}`
    );
    // Set built flag BEFORE calling apply() to allow dummy input test
    this.built = true;
    // Test the model with dummy input - create separate left and right eye tensors with 1 channel each
    const dummyLeftEye = tf.zeros([1, EYE_SIZE, EYE_SIZE, 1]);
    const dummyRightEye = tf.zeros([1, EYE_SIZE, EYE_SIZE, 1]);
    const dummyOutput = this.apply([dummyLeftEye, dummyRightEye], false);
    dummyLeftEye.dispose();
    dummyRightEye.dispose();
    dummyOutput.dispose();
    console.log(`[EyeEncoder.${this.name}] Model built successfully`);
  }

  async loadWeights(weightsMap: TensorMap): Promise<void> {
    if (!this.built) {
      throw new Error(`EyeEncoder.${this.name} not built. Call build() first before apply().`);
    }

    const name = this.name;

    console.log(`[EyeEncoder.${name}] Loading weights`);

    // Load EyeEncoderConv weights using exact pattern matching - NO SEARCHING
    await this.eyeEncoderConv.loadWeights(weightsMap);

    // Load eyeMixer weights using assignDense helper
    weightsMap.assignDense(`${name}/eye_mixer`, this.eyeMixer!);
    console.log(`[EyeEncoder.${name}] eye_mixer: ✓ Set weights`);

    console.log(`[EyeEncoder.${name}] All weights loaded`);
  }

  /**
   * Encode stereo eye images with attention-based scale mixing.
   * ✅ MATCHES PYTHON EXACTLY
   *
   * Input:  leftEye (B, 32, 32, 1), rightEye (B, 32, 32, 1)
   * Output: (B, latentSize)
   */
  apply(eyes: tf.Tensor[], training: boolean): tf.Tensor {
    if (!this.built) {
      throw new Error('EyeEncoder not built. Call build first.');
    }

    const leftEye = eyes[0];
    const rightEye = eyes[1];
    return tf.tidy(() => {
      // Validate inputs - expect 4D: (batch, EYE_SIZE, EYE_SIZE, 1)
      if (
        leftEye.shape.length !== 4 ||
        leftEye.shape[1] !== EYE_SIZE ||
        leftEye.shape[2] !== EYE_SIZE ||
        leftEye.shape[3] !== 1
      ) {
        throw new Error(
          `EyeEncoder expects leftEye shape (batch, ${EYE_SIZE}, ${EYE_SIZE}, 1), got ${leftEye.shape}`
        );
      }
      if (
        rightEye.shape.length !== 4 ||
        rightEye.shape[1] !== EYE_SIZE ||
        rightEye.shape[2] !== EYE_SIZE ||
        rightEye.shape[3] !== 1
      ) {
        throw new Error(
          `EyeEncoder expects rightEye shape (batch, ${EYE_SIZE}, ${EYE_SIZE}, 1), got ${rightEye.shape}`
        );
      }

      const batchSize = leftEye.shape[0] as number;

      // ✅ FIXED: Concatenate left and right eyes along channel axis
      // Input: (B, 32, 32, 1) + (B, 32, 32, 1)
      // Output: (B, 32, 32, 2)
      const stereoEyeImages = tf.concat([leftEye, rightEye], -1);

      // ✅ FIXED: Get attention-mixed scale features from encoder
      // Returns: List[(B, latentSize), (B, latentSize)]
      const eyeFeatureslist = this.eyeEncoderConv.apply(stereoEyeImages);

      // ✅ FIXED: Stack scale features
      // (B, latentSize) + (B, latentSize) → (B, 2*latentSize)
      const eyeFeaturesStacked = tf.concat(eyeFeatureslist, -1);

      // ✅ FIXED: Apply final mixer
      // (B, 2*latentSize) → (B, latentSize)
      const features = this.eyeMixer!.apply(eyeFeaturesStacked, { training }) as tf.Tensor;

      // ✅ FIXED: Validate output shape
      if (features.shape[0] !== batchSize || features.shape[1] !== this.latentSize) {
        throw new Error(
          `Expected features shape (${batchSize}, ${this.latentSize}), got ${features.shape}`
        );
      }

      return features;
    });
  }

  dispose(): void {
    disposeAll([this.eyeEncoderConv, this.eyeMixer]);
    this.eyeEncoderConv = null as any;
    this.eyeMixer = null;
  }
}
