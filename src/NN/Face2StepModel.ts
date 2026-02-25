import * as tf from '@tensorflow/tfjs';
import { disposeAll, hashCode } from './utils/tensorflow';
import { RolloutTimesteps } from './RolloutTimesteps';
import { EyeEncoder } from './EyeEncoder';
import { FaceMeshEncoder } from './FaceMeshEncoder';
import { sMLP } from './sMLP';
import { EmbeddingsProcessor } from './EmbeddingsProcessor';
import { TensorMap } from './utils/tensorflow';
import { NN_CONSTANTS as Constants } from './Constants';

export interface Face2StepModelConfig {
  latentSize: number;
  scaleMult?: number;
  name: string;
}

export interface Face2StepModelInputs<T> {
  points: T;
  leftEye: T;
  rightEye: T;
  embeddings: T;
}

export class Face2StepModel {
  latentSize!: number;
  scaleMult!: number;
  name!: string;
  eyeEncoder!: RolloutTimesteps; // Now wrapped in RolloutTimesteps to match Python
  faceMeshEncoder!: RolloutTimesteps;
  embeddingsProcessor!: EmbeddingsProcessor;
  mlp!: sMLP; // sMLP instance
  combineLayer!: tf.layers.Layer;
  finalNormLayer!: tf.layers.Layer;
  built: boolean = false;

  constructor(config: Face2StepModelConfig) {
    this.latentSize = config.latentSize;
    this.scaleMult = config.scaleMult || 1.0;
    this.name = config.name; // Use configurable name from test
  }

  build(inputShape: Face2StepModelInputs<number[]>): void {
    if (this.built) {
      console.warn('Face2StepModel already built. Skipping.');
      return;
    }

    // Eye encoder - match Python structure exactly (wrapped in RolloutTimesteps)
    // Eye encoder expects eye images, so use the shape from the eye input tensor
    this.eyeEncoder = new RolloutTimesteps(
      name_ =>
        new EyeEncoder({
          latentSize: this.latentSize,
          scaleMult: this.scaleMult,
          name: `${name_}/EyeEncoder`,
        }),
      {
        name: `${this.name}/Eyes`,
        T: Constants.EYE_FACEMESH_SEQUENCE_LENGTH,
      }
    );
    // Eye encoder expects stereo eye images shape: [batch, height, width, 2]
    // The EyeEncoder will receive [leftEye, rightEye] and internally create stereo images
    this.eyeEncoder.build([...inputShape.leftEye.slice(0, inputShape.leftEye.length - 1), 2]);

    // Face mesh encoder with rollout timesteps - match Python structure exactly
    this.faceMeshEncoder = new RolloutTimesteps(
      name_ =>
        new FaceMeshEncoder({
          latentSize: this.latentSize,
          scaleMult: this.scaleMult,
          name: `${name_}/FaceMeshEncoder`,
        }),
      {
        name: `${this.name}/FaceMesh`,
        T: Constants.EYE_FACEMESH_SEQUENCE_LENGTH,
      }
    );
    this.faceMeshEncoder.build(inputShape.points);

    // MLP layer - match Python structure exactly
    const scaledLatentSize = Math.floor(this.latentSize * this.scaleMult);
    const mlpSizes = [
      scaledLatentSize * 3, // Large multiplier (matches Python FACE2STEP_MLP_MULTIPLIER_LARGE)
      scaledLatentSize * 2, // Medium multiplier (matches Python FACE2STEP_MLP_MULTIPLIER_MEDIUM)
      scaledLatentSize * 1, // Small multiplier (matches Python FACE2STEP_MLP_MULTIPLIER_SMALL)
    ];
    this.mlp = new sMLP({
      sizes: mlpSizes,
      activation: 'relu', // Match Python FACE2STEP_MLP_ACTIVATION
      name: `${this.name}/MLP`, // Use full hierarchical name
    });
    // Build MLP with correct input shape: (batch, seq_len, total_features)
    // total_features = face_features + eye_features + embeddings
    // Use actual embeddings dimension from input shape, not this.latentSize
    const embeddingsDim = inputShape.embeddings[2] || this.latentSize;
    const totalFeatures = scaledLatentSize + scaledLatentSize + embeddingsDim;
    this.mlp.build([1, Constants.EYE_FACEMESH_SEQUENCE_LENGTH, totalFeatures]);

    const namePrefix = hashCode(this.name);
    // Final dense layer and normalization - match Python structure exactly
    this.combineLayer = tf.layers.dense({
      units: scaledLatentSize,
      name: `${namePrefix}Combine`,
    });

    this.finalNormLayer = tf.layers.layerNormalization({
      name: `${namePrefix}FinalNorm`,
    });

    // ✅ CRITICAL: Initialize computational graph with dummy input using this.apply()
    console.log(`[Face2StepModel.${this.name}] Building model with dummy input`);
    // Create dummy inputs matching Python call structure exactly
    // Use actual embeddings dimension from input shape
    const dummyInputs: Face2StepModelInputs<tf.Tensor> = {
      points: tf.zeros(
        inputShape.points.map(x => x || 1),
        'float32'
      ),
      leftEye: tf.zeros(
        inputShape.leftEye.map(x => x || 1),
        'float32'
      ),
      rightEye: tf.zeros(
        inputShape.rightEye.map(x => x || 1),
        'float32'
      ),
      embeddings: tf.zeros(
        inputShape.embeddings.map(x => x || 1),
        'float32'
      ),
    };
    this.built = true;
    const dummyOutput = this.apply(dummyInputs, false);
    disposeAll([
      dummyInputs.points,
      dummyInputs.leftEye,
      dummyInputs.rightEye,
      dummyInputs.embeddings,
    ]);
    dummyOutput.dispose();
    console.log(`[Face2StepModel.${this.name}] Model built successfully`);
  }

  async loadWeights(weightsMap: TensorMap): Promise<void> {
    // Add built validation - checklist requirement
    if (!this.built) {
      throw new Error('Face2StepModel not built. Call build() first before loadWeights().');
    }

    // Load weights for eye encoder using strict ONE/SINGLE name pattern - NO SEARCHING
    await this.eyeEncoder.loadWeights(weightsMap);

    // Load weights for face mesh encoder using strict ONE/SINGLE name pattern - NO SEARCHING
    await this.faceMeshEncoder.loadWeights(weightsMap);

    // Load weights for MLP layer using strict ONE/SINGLE name pattern - NO SEARCHING
    await this.mlp.loadWeights(weightsMap);

    // Load weights for combine layer using strict ONE/SINGLE name pattern - NO SEARCHING
    weightsMap.assignDense(`${this.name}/Combine`, this.combineLayer);

    // Load weights for final norm layer using strict ONE/SINGLE name pattern - NO SEARCHING
    const finalNormGamma = weightsMap.get(`weights/${this.name}/FinalNorm/gamma`);
    const finalNormBeta = weightsMap.get(`weights/${this.name}/FinalNorm/beta`);
    if (finalNormGamma && finalNormBeta) {
      this.finalNormLayer.setWeights([finalNormGamma, finalNormBeta]);
    } else {
      throw new Error(
        `[Face2StepModel.${this.name}] FinalNorm layer weights not found at weights/${this.name}/FinalNorm/gamma and weights/${this.name}/FinalNorm/bias`
      );
    }
  }

  apply(inputs: Face2StepModelInputs<tf.Tensor>, training: boolean): tf.Tensor {
    // Add built check
    if (!this.built) {
      throw new Error('Face2StepModel not built. Call build() first before apply().');
    }

    const { points, leftEye, rightEye, embeddings } = inputs;

    // Encode eyes and face mesh points - match Python structure exactly
    // Python: Eye encoder wrapped in RolloutTimesteps returns 3D output (B, timesteps, latent_size)
    const mixedEyeFeatures = this.eyeEncoder.apply([leftEye, rightEye], training) as tf.Tensor;
    const encodedFacePoints = this.faceMeshEncoder.apply(points, training) as tf.Tensor;

    // Combine all features along the last dimension - match Python exactly
    const combined = tf.concat([encodedFacePoints, mixedEyeFeatures, embeddings], -1);
    const mlpOutput = this.mlp.apply(combined, training) as tf.Tensor;
    const combineOutput = this.combineLayer.apply(mlpOutput) as tf.Tensor;
    const normOutput = this.finalNormLayer.apply(combineOutput) as tf.Tensor;

    // Return final latent representation
    return normOutput;
  }

  dispose(): void {
    const componentsToDispose = [
      this.eyeEncoder,
      this.faceMeshEncoder,
      this.embeddingsProcessor,
      this.mlp,
    ];
    disposeAll(componentsToDispose);
    this.eyeEncoder = null as any;
    this.faceMeshEncoder = null as any;
    this.embeddingsProcessor = null as any;
    this.mlp = null as any;
    this.combineLayer = null as any;
    this.finalNormLayer = null as any;
  }
}
