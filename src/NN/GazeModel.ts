/**
 * GazeModel - Main orchestrator coordinating all sub-models.
 *
 * Implements the complete LOAD → INFER → CHECK lifecycle:
 * 1. LOAD weights from disk with rollback capability
 * 2. INFER through complete pipeline
 * 3. CHECK predictions against ground truth with validation
 *
 * Coordinates all 4 sub-models:
 * - EmbeddingsTable: Categorical ID embedding lookup
 * - EmbeddingsProcessor: Temporal processing of embeddings
 * - GazePredictionModel: Face/eye feature encoding → latents
 * - PredictorBlock: Final gaze prediction from latents
 *
 * Usage:
 * ```typescript
 * const model = new GazeModel({ latentSize: 64, scaleMult: 1.0, vocab: config });
 * await model.loadWeights('gazeModel.zip');
 * const results = model.apply(inputs);
 * const metrics = model.validate(inputs, groundTruth);
 * ```
 */

import * as tf from '@tensorflow/tfjs';
import { EmbeddingsTable, EmbeddingsConfig } from './EmbeddingsTable';
import { EmbeddingsProcessor } from './EmbeddingsProcessor';
import { GazePredictionModel } from './GazePredictionModel';
import { PredictorBlock } from './PredictorBlock';
import { disposeAll, TensorMap } from './utils/tensorflow';
import { TEMPORAL_TIMESTEPS } from './Constants';

export interface GazeModelConfig {
  latentSize: number;
  embeddingSize: number;
  scaleMult: number;
  vocab: EmbeddingsConfig;
  name: string;
}

export interface GazeModelInputs<T> {
  points: T; // [batch, timesteps, FACE_MESH_POINTS, 2]
  leftEye: T; // [batch, timesteps, 48, 48, 1]
  rightEye: T; // [batch, timesteps, 48, 48, 1]
  time: T; // [batch, timesteps, 1]
  userId: T; // [batch, timesteps, 1]
  screenId: T; // [batch, timesteps, 1]
  cameraId: T; // [batch, timesteps, 1]
  monitorId: T; // [batch, timesteps, 1]
  placeId: T; // [batch, timesteps, 1]
}

export interface GazeModelOutputs {
  result: tf.Tensor; // [batch, timesteps, 2] - gaze points
  intermediateLatent?: tf.Tensor; // [batch, timesteps, latentSize]
  finalLatent?: tf.Tensor; // [batch, timesteps, latentSize]
}

export class GazeModel {
  private config: GazeModelConfig;
  private embeddingsTable: EmbeddingsTable | null = null;
  private embeddingsProcessor: EmbeddingsProcessor | null = null;
  private gazePredictionModel: GazePredictionModel | null = null;
  private predictorBlock: PredictorBlock | null = null;
  private built: boolean = false;

  constructor(config: GazeModelConfig) {
    this.config = config;
    this.validateConfig();
    // Only store config, don't build subcomponents
  }

  /**
   * Load weights from consolidated TensorMap with rollback capability.
   *
   * The TensorMap should contain the following structure:
   * - weights/_table/*
   * - weights/_model/*
   * - weights/_predictor/*
   * - weights/_processor/*
   */
  async loadWeights(weightsMap: TensorMap): Promise<void> {
    if (!this.built) {
      throw new Error('GazeModel not built. Call build() first before loadWeights().');
    }

    console.log(`[GazeModel.${this.config.name}] Loading weights from TensorMap`);

    await this.embeddingsTable.loadWeights(weightsMap);
    console.log(`[GazeModel.${this.config.name}] EmbeddingsTable weights loaded`);
    await this.embeddingsProcessor.loadWeights(weightsMap);
    console.log(`[GazeModel.${this.config.name}] EmbeddingsProcessor weights loaded`);
    await this.gazePredictionModel.loadWeights(weightsMap);
    console.log(`[GazeModel.${this.config.name}] GazePredictionModel weights loaded`);

    await this.predictorBlock.loadWeights(weightsMap);
    console.log(`[GazeModel.${this.config.name}] PredictorBlock weights loaded`);

    console.log(`[GazeModel.${this.config.name}] All weights loaded successfully`);
  }

  /**
   * Forward pass through complete pipeline.
   * Works with either pre-trained weights (after loadWeights) or random initialization.
   */
  apply(inputs: GazeModelInputs<tf.Tensor>, training: boolean): GazeModelOutputs {
    // Ensure all tensors are float32 for consistency
    const inputsFloat32 = {
      points: inputs.points.toFloat(),
      leftEye: inputs.leftEye.toFloat(),
      rightEye: inputs.rightEye.toFloat(),
      time: inputs.time.toFloat(),
      userId: inputs.userId,
      screenId: inputs.screenId,
      cameraId: inputs.cameraId,
      monitorId: inputs.monitorId,
      placeId: inputs.placeId,
    };

    // Step 1: Process embeddings through EmbeddingsTable
    const embeddingsInputs = {
      userId: inputsFloat32.userId,
      screenId: inputsFloat32.screenId,
      cameraId: inputsFloat32.cameraId,
      monitorId: inputsFloat32.monitorId,
      placeId: inputsFloat32.placeId,
    };

    const rawEmbeddings = this.embeddingsTable.apply(embeddingsInputs, {}, [
      inputsFloat32.points.shape[0], // batch size
      inputsFloat32.points.shape[1], // timesteps
    ]);

    // Step 2: Process embeddings through EmbeddingsProcessor
    const processedEmbeddings = this.embeddingsProcessor.apply(rawEmbeddings, training);

    // Step 3: Process facial features through GazePredictionModel
    const gazeInputs = {
      points: inputsFloat32.points,
      leftEye: inputsFloat32.leftEye,
      rightEye: inputsFloat32.rightEye,
      time: inputsFloat32.time,
      embeddings: processedEmbeddings,
    };

    const { intermediateLatent, finalLatent } = this.gazePredictionModel.apply(
      gazeInputs,
      training
    );

    const predictorOutput = this.predictorBlock.apply({ latents: finalLatent }, training);
    return {
      result: predictorOutput.result,
      intermediateLatent,
      finalLatent,
    };
  }

  /**
   * Dispose all resources and clean up models.
   */
  dispose(): void {
    disposeAll([
      this.embeddingsTable,
      this.embeddingsProcessor,
      this.gazePredictionModel,
      this.predictorBlock,
    ]);
    this.embeddingsTable = null as any;
    this.embeddingsProcessor = null as any;
    this.gazePredictionModel = null as any;
    this.predictorBlock = null as any;
    console.log('All resources disposed');
  }

  private validateConfig(): void {
    if (this.config.latentSize <= 0) {
      throw new Error('latentSize must be positive');
    }
    if (this.config.embeddingSize <= 0) {
      throw new Error('embeddingSize must be positive');
    }
    if (this.config.scaleMult <= 0 || this.config.scaleMult > 10.0) {
      throw new Error('scaleMult must be between 0 and 10.0');
    }
    if (!this.config.vocab) {
      throw new Error('vocab configuration required');
    }
  }

  /**
   * Build the model with input shapes.
   */
  build(inputShape: GazeModelInputs<number[]>): void {
    if (this.built) {
      console.warn('GazeModel already built. Skipping.');
      return;
    }

    console.log(`[GazeModel.${this.config.name}] Building with input shapes:`, inputShape);

    // Initialize sub-components with consistent naming (Python pattern)
    this.embeddingsTable = new EmbeddingsTable({
      config: this.config.vocab,
      embeddingSize: this.config.embeddingSize,
      name: '_table',
    });

    this.embeddingsProcessor = new EmbeddingsProcessor({
      timesteps: TEMPORAL_TIMESTEPS, // Fixed temporal dimension
      embeddingSize: this.config.embeddingSize,
      mixingMethod: 'attention', // Python ModelWrapper uses attention
      name: '_processor/embeddings_processor',
    });

    this.gazePredictionModel = new GazePredictionModel({
      latentSize: this.config.latentSize,
      scaleMult: this.config.scaleMult,
      name: '_model/gaze_prediction_model',
    });

    this.predictorBlock = new PredictorBlock({
      latentSize: this.config.latentSize,
      name: '_predictor/PredictorBlock',
    });

    // Build all sub-models with appropriate shapes (following good pattern)
    this.embeddingsTable.build([1, 1]); // Batch size 1, sequence length 1

    // EmbeddingsProcessor expects [batch, timesteps, 5*embeddingSize] for 5 concatenated embeddings
    this.embeddingsProcessor.build([1, TEMPORAL_TIMESTEPS, 5 * this.config.embeddingSize]);

    // Build gaze prediction model with actual input shapes
    this.gazePredictionModel.build({
      points: inputShape.points,
      leftEye: inputShape.leftEye,
      rightEye: inputShape.rightEye,
      time: inputShape.time,
      embeddings: [inputShape.points[0], inputShape.points[1], this.config.embeddingSize],
    });

    // Build predictor block with actual input shapes
    this.predictorBlock.build({
      latents: [inputShape.points[0], inputShape.points[1], this.config.latentSize], // [batch, timesteps, latent_size]
    });

    // ✅ CRITICAL: Initialize computational graph with dummy inputs
    const dummyInputs: GazeModelInputs<tf.Tensor> = {
      points: tf.zeros(inputShape.points),
      leftEye: tf.zeros(inputShape.leftEye),
      rightEye: tf.zeros(inputShape.rightEye),
      time: tf.zeros(inputShape.time),
      userId: tf.zeros(inputShape.userId, 'int32'),
      screenId: tf.zeros(inputShape.screenId, 'int32'),
      cameraId: tf.zeros(inputShape.cameraId, 'int32'),
      monitorId: tf.zeros(inputShape.monitorId, 'int32'),
      placeId: tf.zeros(inputShape.placeId, 'int32'),
    };

    this.built = true;
    const res = this.apply(dummyInputs, false);
    disposeAll(dummyInputs);
    disposeAll([res.intermediateLatent, res.finalLatent, res.result]);
    console.log('GazeModel built successfully');
  }
}
