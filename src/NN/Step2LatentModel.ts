import * as tf from '@tensorflow/tfjs';
import { TimeEncodingLayer } from './TimeEncodingLayer';
import { TransformerEncoderBlock } from './TransformerEncoderBlock';
import { LinearAttentionMixer } from './LinearAttentionMixer';
import { sMLP } from './sMLP';
import { TensorMap, disposeAll, hashCode } from './utils/tensorflow';
import {
  STEP2LATENT_TRANSFORMER_BLOCKS,
  STEP2LATENT_MLP_ACTIVATION,
  STEP2LATENT_TRANSFORMER_DROPOUT_RATE,
  DEFAULT_EMBEDDING_SIZE,
  STEP2LATENT_TRANSFORMER_NUM_HEADS,
  STEP2LATENT_TRANSFORMER_DFF_MULTIPLIER,
} from './Constants';

export interface Step2LatentModelConfig {
  latentSize: number;
  numSinkTokens?: number;
  numHeads?: number;
  dffMultiplier?: number;
  scaleMult?: number;
  name: string;
}

export interface Step2LatentModelInputs<T> {
  latent: T;
  time: T;
  embeddings: T;
}

export class Step2LatentModel {
  latentSize!: number;
  numSinkTokens!: number;
  numHeads!: number;
  dffMultiplier!: number;
  scaleMult!: number;
  name!: string;
  scaledLatentSize!: number;

  timeEncoding!: TimeEncodingLayer;
  mlpInit!: sMLP;
  transformerBlocks!: TransformerEncoderBlock[];
  mlpsTransformer!: tf.layers.Layer[];
  sinkMixer!: LinearAttentionMixer;
  mlpFinal!: sMLP;
  finalDense!: tf.layers.Layer;
  built: boolean = false;

  constructor(config: Step2LatentModelConfig) {
    this.latentSize = config.latentSize;
    this.name = config.name;
    this.numSinkTokens = config.numSinkTokens || 1;
    this.numHeads = config.numHeads || STEP2LATENT_TRANSFORMER_NUM_HEADS;
    this.dffMultiplier = config.dffMultiplier || STEP2LATENT_TRANSFORMER_DFF_MULTIPLIER;
    this.scaleMult = config.scaleMult || 1.0;

    // Calculate scaled latent size (matches Python)
    this.scaledLatentSize = Math.floor(this.latentSize * this.scaleMult);
    console.log(
      `[Step2LatentModel.${this.name}] Scaled latent size: ${this.latentSize} * ${this.scaleMult} = ${this.scaledLatentSize}`
    );
  }

  build(inputShapes: Step2LatentModelInputs<number[]>): void {
    if (this.built) {
      console.warn(`Step2LatentModel.${this.name} already built. Skipping.`);
      return;
    }

    console.log(`[Step2LatentModel.${this.name}] Building model with input shapes:`, inputShapes);
    const namePrefix = hashCode(this.name);

    // Time encoding layer
    this.timeEncoding = new TimeEncodingLayer({
      name: `${this.name}/time_encoder`,
    });

    // Extract shapes from inputShapes first (matches Python input_shape parameter)
    const latentShape = inputShapes.latent;
    const timeShape = inputShapes.time;
    const embeddingsShape = inputShapes.embeddings;

    const batch = latentShape[0] || 1;
    const seqLen = latentShape[1] || STEP2LATENT_TRANSFORMER_BLOCKS;
    const latentDim = latentShape[2] || this.latentSize;
    const timeDim = timeShape[2] || 1;
    const embeddingsDim = embeddingsShape[2] || DEFAULT_EMBEDDING_SIZE;

    console.log(
      `[Step2LatentModel.${this.name}] Extracted dimensions - batch: ${batch}, seqLen: ${seqLen}, latentDim: ${latentDim}, timeDim: ${timeDim}, embeddingsDim: ${embeddingsDim}`
    );

    // Transformer encoder blocks (matches Python)
    this.transformerBlocks = [];
    this.mlpsTransformer = [];
    for (let i = 0; i < STEP2LATENT_TRANSFORMER_BLOCKS; i++) {
      const transformerBlock = new TransformerEncoderBlock({
        name: `${this.name}/transformer_encoder_block_${i}`,
        d_model: this.scaledLatentSize,
        dff: this.scaledLatentSize * this.dffMultiplier,
        dropout_rate: STEP2LATENT_TRANSFORMER_DROPOUT_RATE,
      });
      this.transformerBlocks.push(transformerBlock);

      // Adaptive transformation layer (matches Python)
      const adaptiveLayer = tf.layers.dense({
        units: this.scaledLatentSize,
        activation: STEP2LATENT_MLP_ACTIVATION,
        name: `${namePrefix}adaptive_transform_${i}`,
      });
      console.log(
        `[Step2LatentModel.${this.name}] Created adaptive_transform_${i}: units=${this.scaledLatentSize}, name=${adaptiveLayer.name}`
      );
      this.mlpsTransformer.push(adaptiveLayer);
    }
    // Final MLP (matches Python: [4*scaled, 2*scaled, scaled])
    // Input = latent(32) + temporal(32) + emb(32) = 96
    const mlpFinalInputDim = this.scaledLatentSize + this.scaledLatentSize + this.scaledLatentSize; // 32 + 32 + 32 = 96
    this.mlpFinal = new sMLP({
      sizes: [4 * this.scaledLatentSize, 2 * this.scaledLatentSize, this.scaledLatentSize], // Output progression: 128 → 64 → 32
      activation: STEP2LATENT_MLP_ACTIVATION,
      name: `${this.name}/mlp_final`,
    });
    // Build all components with proper input shapes following sMLP pattern
    this.timeEncoding.build([batch, seqLen, timeDim]);

    // Time encoding actually outputs 32 dimensions (from TimeEncodingLayer implementation)
    const timeEncodingDim = 32;
    const mlpInitInputDim = timeEncodingDim + embeddingsDim; // 32 + 64 = 96
    this.mlpInit = new sMLP({
      sizes: [this.scaledLatentSize], // Output 32 (input inferred as 96)
      activation: STEP2LATENT_MLP_ACTIVATION,
      name: `${this.name}/mlp_init`,
    });
    this.mlpInit.build([batch, seqLen, mlpInitInputDim]);

    this.sinkMixer = new LinearAttentionMixer({
      n_outputs: this.numSinkTokens,
      max_dim: 16, // Use max_dim=16 to get similar head calculation
      name: `${this.name}/sink_tokens_mixer`,
    });

    // Final dense layer (matches Python) - use scaled dimension
    this.finalDense = tf.layers.dense({
      units: this.scaledLatentSize, // Use scaled dimension like Python
      activation: 'linear',
      name: `${namePrefix}final_dense`,
    });

    this.sinkMixer.build([batch, seqLen, latentDim]);

    // Build transformer blocks following sMLP pattern - no apply calls in build
    // Account for sink tokens in sequence length if they're enabled
    const transformerSeqLen = this.numSinkTokens > 0 ? seqLen + this.numSinkTokens : seqLen;
    for (let i = 0; i < STEP2LATENT_TRANSFORMER_BLOCKS; i++) {
      // Build transformer blocks with correct input shape (including sink tokens)
      this.transformerBlocks[i].build([batch, transformerSeqLen, this.scaledLatentSize]);
    }

    // Build final MLP with proper input dimensions (latent + temporal + emb)
    // Input = latent(32) + temporal(32) + emb(96) = 160 (already calculated above)
    this.mlpFinal.build([batch, seqLen, mlpFinalInputDim]);

    this.built = true;
    // Build graph
    const dummyInputs = {
      latent: tf.zeros([batch, seqLen, latentDim]),
      time: tf.zeros([batch, seqLen, timeDim]),
      embeddings: tf.zeros([batch, seqLen, embeddingsDim]),
    };
    const dummyOutput = this.apply(dummyInputs, false);
    disposeAll(dummyInputs);
    dummyOutput.dispose();

    console.log(`[Step2LatentModel.${this.name}] Model built successfully`);
  }

  apply(inputs: Step2LatentModelInputs<tf.Tensor>, training: boolean): tf.Tensor {
    if (!this.built) {
      throw new Error(
        `Step2LatentModel.${this.name} not built. Call build() first before apply().`
      );
    }

    const { latent, time, embeddings } = inputs;
    const batch_size = latent.shape[0];
    const sequence_length = latent.shape[1];

    // Reshape embeddings to match Python format
    const embeddings_reshaped = tf.reshape(embeddings, [batch_size, sequence_length, -1]);

    // Apply time encoding
    const encoded_time = this.timeEncoding.apply(time, training) as tf.Tensor;
    console.log(
      `[Step2LatentModel.${this.name}] embeddings original shape: ${embeddings.shape}, reshaped: ${embeddings_reshaped.shape}`
    );
    console.log(`[Step2LatentModel.${this.name}] encoded_time shape: ${encoded_time.shape}`);

    // Initial temporal processing (matches Python exactly)
    const concatenated = tf.concat([encoded_time, embeddings_reshaped], -1);
    console.log(`[Step2LatentModel.${this.name}] concatenated shape: ${concatenated.shape}`);
    let emb = this.mlpInit.apply(concatenated, training) as tf.Tensor;

    let temporal = latent;

    // Handle sink tokens (matches Python exactly)
    if (this.numSinkTokens > 0) {
      // Generate sink tokens
      const batch_sink_tokens = this.sinkMixer.apply(latent, training) as tf.Tensor;

      // Create dummy embeddings for sink tokens (zeros)
      const sink_embeddings = tf.zeros([batch_size, this.numSinkTokens, emb.shape[2]], 'float32');
      emb = tf.concat([sink_embeddings, emb], 1);
      temporal = tf.concat([batch_sink_tokens, temporal], 1);
    }

    // Transformer blocks with temporal modeling (matches Python exactly)
    for (let block_id = 0; block_id < STEP2LATENT_TRANSFORMER_BLOCKS; block_id++) {
      // Concatenate all inputs for transformer
      let combined = tf.concat([temporal, emb], -1);
      combined = this.mlpsTransformer[block_id].apply(combined, { training }) as tf.Tensor;
      temporal = this.transformerBlocks[block_id].apply(combined, training) as tf.Tensor;
    }

    // Remove sink tokens before returning (matches Python exactly)
    if (this.numSinkTokens > 0) {
      temporal = temporal.slice(
        [0, this.numSinkTokens, 0],
        [batch_size, sequence_length, this.scaledLatentSize]
      );
      emb = emb.slice([0, this.numSinkTokens, 0], [batch_size, sequence_length, emb.shape[2]]);
    }

    // Final output processing (matches Python exactly)
    const final_input = tf.concat([latent, temporal, emb], -1);
    const final = this.mlpFinal.apply(final_input, training) as tf.Tensor;
    const final_dense_output = this.finalDense.apply(final, { training }) as tf.Tensor;

    // Return steps_data + final (matches Python line 242)
    return tf.add(latent, final_dense_output);
  }

  async loadWeights(weightsMap: TensorMap): Promise<void> {
    if (!this.built) {
      throw new Error(
        `Step2LatentModel.${this.name} not built. Call build() first before loadWeights().`
      );
    }

    console.log(`[Step2LatentModel.${this.name}] Loading weights`);

    // Load weights for time encoding layer (exact pattern - no guessing)
    await this.timeEncoding.loadWeights(weightsMap);

    // Load weights for initial MLP (strict ONE/SINGLE name pattern)
    await this.mlpInit.loadWeights(weightsMap);

    // Load weights for transformer blocks (exact pattern - no guessing)
    for (const block of this.transformerBlocks) {
      await block.loadWeights(weightsMap);
    }

    // Load weights for adaptive transformation layers using assignDense
    for (let i = 0; i < STEP2LATENT_TRANSFORMER_BLOCKS; i++) {
      weightsMap.assignDense(`${this.name}/adaptive_transform_${i}`, this.mlpsTransformer[i]);
      console.log(`[Step2LatentModel.${this.name}] adaptive_transform_${i}: ✓ Loaded`);
    }

    // Load weights for sink tokens mixer (matches Python - exact pattern)
    await this.sinkMixer.loadWeights(weightsMap);

    // Load weights for final MLP (strict ONE/SINGLE name pattern)
    await this.mlpFinal.loadWeights(weightsMap);

    // Load weights for final dense layer using assignDense
    weightsMap.assignDense(`${this.name}/final_dense`, this.finalDense);
    console.log(`[Step2LatentModel.${this.name}] final_dense: ✓ Loaded`);

    console.log(`[Step2LatentModel.${this.name}] ✅ All weights loaded`);
  }

  dispose(): void {
    // Collect and dispose all layers using disposeAll utility
    disposeAll([
      this.timeEncoding,
      this.mlpInit,
      this.sinkMixer,
      this.mlpFinal,
      this.finalDense,
      ...this.transformerBlocks,
      ...this.mlpsTransformer,
    ]);

    // Clear arrays and references
    this.transformerBlocks = [];
    this.mlpsTransformer = [];
    this.timeEncoding = null as any;
    this.mlpInit = null as any;
    this.sinkMixer = null as any;
    this.mlpFinal = null as any;
    this.finalDense = null as any;
  }
}
