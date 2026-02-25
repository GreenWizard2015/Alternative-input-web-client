/**
 * GazePredictionModel - End-to-end gaze prediction model.
 *
 * Composes the complete gaze prediction pipeline:
 * - Face2Step: Encodes facial features (landmarks + eye images) → intermediate latent
 * - Step2Latent: Processes temporal sequences → final latent representation
 *
 * Usage:
 * ```typescript
 * const model = new GazePredictionModel({ latentSize: 64, scaleMult: 1.0 });
 * await model.loadWeights('gazePredictionModel.zip');
 * const outputs = model.apply(inputs);
 * ```
 */

import * as tf from '@tensorflow/tfjs';
import { Face2StepModel, Face2StepModelInputs } from './Face2StepModel';
import { Step2LatentModel } from './Step2LatentModel';
import { TensorMap, disposeAll } from './utils/tensorflow';
import { FACE_MESH_POINTS, EYE_SIZE } from './Constants';

export interface GazePredictionModelConfig {
  latentSize: number;
  scaleMult: number;
  name: string;
}

export interface GazeModelInputs<T> {
  points: T; // [batch, timesteps, 478, 2]
  leftEye: T; // [batch, timesteps, 32, 32, 1] - model processes 32x32 (dataset preproc: 48x48)
  rightEye: T; // [batch, timesteps, 32, 32, 1] - model processes 32x32 (dataset preproc: 48x48)
  time: T; // [batch, timesteps, 1]
  embeddings: T; // [batch, timesteps, embeddingSize]
}

export interface GazeModelOutputs {
  intermediateLatent: tf.Tensor; // [batch, timesteps, latentSize]
  finalLatent: tf.Tensor; // [batch, timesteps, latentSize]
}

export class GazePredictionModel {
  private config: GazePredictionModelConfig;
  private face2Step: Face2StepModel;
  private step2Latent: Step2LatentModel;
  private built: boolean = false;

  constructor(config: GazePredictionModelConfig) {
    this.config = {
      ...config,
      scaleMult: 1.0, // Always 1.0 per task requirements
    };

    this.validateConfig();
  }

  async loadWeights(weightsMap: TensorMap): Promise<void> {
    if (!this.built) {
      throw new Error(
        `GazePredictionModel.${this.config.name} not built. Call build() first before loadWeights().`
      );
    }

    console.log(`[GazePredictionModel.${this.config.name}] Loading weights...`);
    await this.face2Step.loadWeights(weightsMap);
    console.log(`[GazePredictionModel.${this.config.name}] Face2StepModel weights loaded`);

    // ✅ FIXED: Step2LatentModel weights with strict name pattern (no guessing)
    await this.step2Latent.loadWeights(weightsMap);
    console.log(`[GazePredictionModel.${this.config.name}] Step2LatentModel weights loaded`);

    // No expansion layers in Python model - direct connection from Face2Step to Step2Latent
    console.log(
      `[GazePredictionModel.${this.config.name}] No expansion layers needed - direct connection`
    );

    console.log(`[GazePredictionModel.${this.config.name}] All weights loaded successfully`);
  }

  call(inputs: GazeModelInputs<tf.Tensor>, training?: boolean): GazeModelOutputs {
    return this.apply(inputs, training ?? false);
  }

  apply(inputs: GazeModelInputs<tf.Tensor>, training: boolean): GazeModelOutputs {
    if (!this.built) {
      throw new Error(
        `GazePredictionModel.${this.config.name} not built. Call build() first before apply().`
      );
    }

    console.log('[GazePredictionModel] Starting inference...');
    this.validateInputs(inputs);

    return tf.tidy(() => {
      const intermediateLatent = this.face2Step.apply(
        {
          points: inputs.points,
          leftEye: inputs.leftEye,
          rightEye: inputs.rightEye,
          embeddings: inputs.embeddings,
        },
        training
      );
      const finalLatent = this.step2Latent.apply(
        {
          latent: intermediateLatent,
          time: inputs.time,
          embeddings: inputs.embeddings, // Use embeddings directly (no expansion needed)
        },
        training
      ) as tf.Tensor;
      return {
        intermediateLatent,
        finalLatent,
      };
    });
  }

  private validateConfig(): void {
    if (this.config.latentSize <= 0) {
      throw new Error('latentSize must be positive');
    }
    if (this.config.scaleMult <= 0 || this.config.scaleMult > 10.0) {
      throw new Error('scaleMult must be between 0 and 10.0');
    }
  }

  private validateInputs(inputs: GazeModelInputs<tf.Tensor>): void {
    // Don't validate embedding size - use whatever shape is provided (Python pattern)
    const expectedShapes: Record<keyof GazeModelInputs<any>, (number | undefined)[]> = {
      points: [undefined, undefined, FACE_MESH_POINTS, 2],
      leftEye: [undefined, undefined, EYE_SIZE, EYE_SIZE, 1], // Model processes EYE_SIZE (32x32, dataset preproc: 48x48)
      rightEye: [undefined, undefined, EYE_SIZE, EYE_SIZE, 1], // Model processes EYE_SIZE (32x32, dataset preproc: 48x48)
      time: [undefined, undefined, 1],
      embeddings: [undefined, undefined, undefined], // Don't validate embedding size (Python pattern)
    };

    for (const [key, tensor] of Object.entries(inputs)) {
      const expected = expectedShapes[key as keyof GazeModelInputs<any>];
      if (tensor.rank !== expected.length) {
        throw new Error(`${key} expected rank ${expected.length}, got rank ${tensor.rank}`);
      }
      for (let i = 0; i < expected.length; i++) {
        if (expected[i] !== undefined && tensor.shape[i] !== expected[i]) {
          throw new Error(
            `${key} expected dimension ${i} to be ${expected[i]}, got ${tensor.shape[i]}`
          );
        }
      }
    }

    // Ensure consistent batch size and timesteps
    const batchSize = inputs.points.shape[0];
    const timesteps = inputs.points.shape[1];

    Object.values(inputs).forEach(tensor => {
      if (tensor.shape[0] !== batchSize || tensor.shape[1] !== timesteps) {
        throw new Error(`Inconsistent batch size or timesteps across inputs`);
      }
    });
  }

  dispose(): void {
    const layersToDispose: any[] = [this.face2Step, this.step2Latent];
    disposeAll(layersToDispose);
    this.face2Step = null as any;
    this.step2Latent = null as any;
  }

  /**
   * Build the model with input shapes (following sMLP pattern).
   */
  build(inputShapes: GazeModelInputs<number[]>): void {
    if (this.built) {
      console.warn(`GazePredictionModel.${this.config.name} already built. Skipping.`);
      return;
    }

    console.log(
      `[GazePredictionModel.${this.config.name}] Building model with input shapes:`,
      inputShapes
    );

    this.face2Step = new Face2StepModel({
      name: `${this.config.name}/Face2Step`, // Match ZIP weight structure
      latentSize: this.config.latentSize,
      scaleMult: 1.0, // Force scaleMult to 1.0 to match Python export
    });

    this.step2Latent = new Step2LatentModel({
      name: `${this.config.name}/Step2Latent`, // Match ZIP weight structure
      latentSize: this.config.latentSize,
      scaleMult: 1.0, // Force scaleMult to 1.0 to match Python export
    });

    // No expansion layers in Python model - direct connection between Face2Step and Step2Latent
    // Use scaled latent size directly from submodels

    // Build Face2StepModel with correct input shapes
    console.log(`[GazePredictionModel.${this.config.name}] Building Face2StepModel`);
    // Face2StepModel expects individual eye shapes - EyeEncoder handles stereo internally
    this.face2Step.build({
      points: inputShapes.points,
      leftEye: inputShapes.leftEye,
      rightEye: inputShapes.rightEye,
      embeddings: inputShapes.embeddings,
    });

    // No expansion layers to build - direct connection between submodels

    // Build Step2LatentModel with scaled dimensions (Python pattern)
    console.log(`[GazePredictionModel.${this.config.name}] Building Step2LatentModel`);
    // Use Python pattern: pass embeddings shape directly from input, don't assume size
    const scaledLatentSize = Math.floor(this.config.latentSize * this.config.scaleMult);
    this.step2Latent.build({
      latent: [inputShapes.points[0], inputShapes.points[1], scaledLatentSize],
      time: [inputShapes.time[0], inputShapes.time[1], 1],
      embeddings: inputShapes.embeddings, // Use exact shape from input, don't modify
    });

    this.built = true;
    // ✅ CRITICAL: Initialize computational graph with dummy input (sMLP pattern)
    console.log(`[GazePredictionModel.${this.config.name}] Initializing computational graph`);

    const dummyInputs: GazeModelInputs<tf.Tensor> = {
      points: tf.zeros(
        inputShapes.points.map(x => x || 1),
        'float32'
      ),
      leftEye: tf.zeros(
        inputShapes.leftEye.map(x => x || 1),
        'float32'
      ),
      rightEye: tf.zeros(
        inputShapes.rightEye.map(x => x || 1),
        'float32'
      ),
      time: tf.zeros(
        inputShapes.time.map(x => x || 1),
        'float32'
      ),
      embeddings: tf.zeros(
        inputShapes.embeddings.map(x => x || 1),
        'float32'
      ),
    };

    // Run full pipeline to validate computational graph
    const dummyOutput = this.apply(dummyInputs, false);

    // Cleanup
    disposeAll([
      dummyInputs.points,
      dummyInputs.leftEye,
      dummyInputs.rightEye,
      dummyInputs.time,
      dummyInputs.embeddings,
      dummyOutput.intermediateLatent,
      dummyOutput.finalLatent,
    ]);
    console.log(`GazePredictionModel.${this.config.name} built successfully`);
  }
}
