/**
 * Centralized constants for neural network models and layers.
 *
 * These constants are directly ported from Python NN/Constants.py to ensure
 * exact architectural parity between Python and TypeScript implementations.
 */

// Activation functions
export const STANDARD_NONNEGATIVE_ACTIVATION = 'relu';

// Eye encoder architecture
export const EYE_ENCODER_CONV_FILTERS = [32, 32] as const;
export const EYE_ENCODER_CONV_STRIDE = 2;
export const EYE_ENCODER_CONV_KERNEL = 3;
export const EYE_ENCODER_CONV_PADDING: 'same' | 'valid' = 'same';

// Eye encoder conv2latent architecture
export const EYE_ENCODER_CONV2LATENT_CONV_PE_CHANNELS = 16 - 2;
export const EYE_ENCODER_CONV2LATENT_CONV_KERNEL_3 = 3;
export const EYE_ENCODER_CONV2LATENT_INIT_SIZE = 8;
export const EYE_ENCODER_CONV2LATENT_INIT_CHANNELS = 64;

// Step2Latent model architecture
export const STEP2LATENT_TRANSFORMER_BLOCKS = 3;
export const STEP2LATENT_MLP_SIZES = [256, 128, 64] as const;
export const STEP2LATENT_MLP_ACTIVATION = STANDARD_NONNEGATIVE_ACTIVATION;
export const STEP2LATENT_TRANSFORMER_NUM_HEADS = 16;
export const STEP2LATENT_TRANSFORMER_DFF_MULTIPLIER = 16;
export const STEP2LATENT_TRANSFORMER_DROPOUT_RATE = 0.01;

// Face2Step model architecture
export const FACE2STEP_FUSION_BLOCKS = 3;
export const FACE2STEP_MLP_SIZES = 3;
export const FACE2STEP_MLP_ACTIVATION = STANDARD_NONNEGATIVE_ACTIVATION;

// PredictorBlock layer
export const PREDICTOR_BLOCK_MLP_SIZES = [128, 128, 128] as const;
export const PREDICTOR_BLOCK_ACTIVATION = STANDARD_NONNEGATIVE_ACTIVATION;
export const PREDICTOR_BLOCK_SHIFT = 0.5;
export const PREDICTOR_BLOCK_OUTPUT_DIMS = 2;
export const PREDICTOR_BLOCK_FULL_MODE_MLP_SIZE = 256;

// Face2Step model architecture - MLP size multipliers
export const FACE2STEP_FUSION_BLOCK_DFF = 128;
export const FACE2STEP_FUSION_BLOCK_NUM_HEADS = 4;
export const FACE2STEP_MLP_MULTIPLIER_LARGE = 3;
export const FACE2STEP_MLP_MULTIPLIER_MEDIUM = 2;
export const FACE2STEP_MLP_MULTIPLIER_SMALL = 1;

// Default hyperparameters
export const DEFAULT_EMBEDDING_SIZE = 64;
export const DEFAULT_LATENT_SIZE = 256;

// Face mesh and eye constants
export const FACE_MESH_POINTS = 478;
export const FACE_MESH_INVALID_VALUE = -10.0; // ✅ ADDED: Invalid landmark marker value
export const EYE_SIZE = 32; // ✅ FIXED: Changed from 48 to match Python

// MultiHeadAttention layer constants
export const ATTENTION_MASK_VALUE = -1e9;

// PredictorFace layer constants
export const FACE_VALIDITY_THRESHOLD = 0.5;

// TimeEncodingLayer constants
export const TIME_NORMALIZATION_EPSILON = 1e-8;

// sMLP module level dropout
export const SMLP_GLOBAL_DROPOUT = 0.01;

// Eye face sequence length constant
export const EYE_FACEMESH_SEQUENCE_LENGTH = 10;

// Convolutional layer kernel sizes
export const CONV_KERNEL_SIZE_3 = 3;
export const CONV_KERNEL_SIZE_2 = 2;
export const CONV_KERNEL_SIZE_1 = 1;

// Default positional encoding channels
export const DEFAULT_POSITIONAL_ENCODING_CHANNELS = 32;

// Time encoding dimension
export const TIME_ENCODING_DIM = 32;

// Temporal dimension (timesteps)
export const TEMPORAL_TIMESTEPS = 5;

// MLP sizes (common configurations)
export const MLP_SIZES_SMALL = [128, 128, 128] as const;
export const MLP_SIZES_MEDIUM = [256, 256, 256] as const;

// Dropout rates
export const DROPOUT_RATE_LOW = 0.0;
export const DROPOUT_RATE_MEDIUM = 0.0;

// Attention heads
export const ATTENTION_HEADS_DEFAULT = 4;
export const ATTENTION_HEADS_LARGE = 16;

// Complete constants object for easy import
export const NN_CONSTANTS = {
  // Activation functions
  STANDARD_NONNEGATIVE_ACTIVATION,

  // Eye encoder architecture
  EYE_ENCODER_CONV_FILTERS,
  EYE_ENCODER_CONV_STRIDE,
  EYE_ENCODER_CONV_KERNEL,
  EYE_ENCODER_CONV_PADDING,

  // Eye encoder conv2latent architecture
  EYE_ENCODER_CONV2LATENT_CONV_PE_CHANNELS,
  EYE_ENCODER_CONV2LATENT_CONV_KERNEL_3,
  EYE_ENCODER_CONV2LATENT_INIT_SIZE,
  EYE_ENCODER_CONV2LATENT_INIT_CHANNELS,

  // Step2Latent model architecture
  STEP2LATENT_TRANSFORMER_BLOCKS,
  STEP2LATENT_MLP_SIZES,
  STEP2LATENT_MLP_ACTIVATION,
  STEP2LATENT_TRANSFORMER_NUM_HEADS,
  STEP2LATENT_TRANSFORMER_DFF_MULTIPLIER,
  STEP2LATENT_TRANSFORMER_DROPOUT_RATE,

  // Face2Step model architecture
  FACE2STEP_FUSION_BLOCKS,
  FACE2STEP_FUSION_BLOCK_DFF,
  FACE2STEP_FUSION_BLOCK_NUM_HEADS,
  FACE2STEP_MLP_SIZES,
  FACE2STEP_MLP_ACTIVATION,

  // PredictorBlock layer
  PREDICTOR_BLOCK_MLP_SIZES,
  PREDICTOR_BLOCK_ACTIVATION,
  PREDICTOR_BLOCK_SHIFT,
  PREDICTOR_BLOCK_OUTPUT_DIMS,
  PREDICTOR_BLOCK_FULL_MODE_MLP_SIZE,

  // Face2Step model architecture - MLP size multipliers
  FACE2STEP_MLP_MULTIPLIER_LARGE,
  FACE2STEP_MLP_MULTIPLIER_MEDIUM,
  FACE2STEP_MLP_MULTIPLIER_SMALL,

  // Default hyperparameters
  DEFAULT_EMBEDDING_SIZE,
  DEFAULT_LATENT_SIZE,

  // Face mesh and eye constants
  FACE_MESH_POINTS,
  FACE_MESH_INVALID_VALUE,
  EYE_SIZE,
  EYE_FACEMESH_SEQUENCE_LENGTH,

  // MultiHeadAttention layer constants
  ATTENTION_MASK_VALUE,

  // PredictorFace layer constants
  FACE_VALIDITY_THRESHOLD,

  // TimeEncodingLayer constants
  TIME_NORMALIZATION_EPSILON,

  // sMLP module level dropout
  SMLP_GLOBAL_DROPOUT,

  // Convolutional layer kernel sizes
  CONV_KERNEL_SIZE_3,
  CONV_KERNEL_SIZE_2,
  CONV_KERNEL_SIZE_1,

  // Default positional encoding channels
  DEFAULT_POSITIONAL_ENCODING_CHANNELS,

  // Time encoding dimension
  TIME_ENCODING_DIM,

  // Temporal dimension
  TEMPORAL_TIMESTEPS,

  // MLP sizes
  MLP_SIZES_SMALL,
  MLP_SIZES_MEDIUM,

  // Dropout rates
  DROPOUT_RATE_LOW,
  DROPOUT_RATE_MEDIUM,

  // Attention heads
  ATTENTION_HEADS_DEFAULT,
  ATTENTION_HEADS_LARGE,
} as const;

// Type for constants
export type NNConstants = typeof NN_CONSTANTS;
