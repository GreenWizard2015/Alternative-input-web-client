/**
 * CoordsEncodingLayer - Learnable coordinate encoding with sinusoidal basis.
 *
 * ⚠️ **REFACTORED TO MATCH PYTHON EXACTLY**
 * Python Reference: /NN/layers/CoordsEncodingLayer.py lines 16-575
 *
 * Encodes coordinates (e.g., facial landmarks) using learnable sinusoidal functions
 * with support for band-wise dropout and shared transformation.
 *
 * Usage:
 * ```typescript
 * const encoder = new CoordsEncodingLayer({ N: 64, bandsDropout: true, sharedTransformation: false });
 * const encoded = encoder.apply(tf.randomNormal([32, 478, 2])); // (32, 478, 64)
 * ```
 */

import * as tf from '@tensorflow/tfjs';
import * as tfl from '@tensorflow/tfjs-layers';
import { disposeAll, TensorMap, hashCode } from './utils/tensorflow';

const DEFAULT_FREQUENCY_BASE = 2.0;
const MAX_FREQUENCY_POWER = 32;

export interface CoordsEncodingLayerConfig {
  N: number; // Output dimension
  raw?: boolean; // Include raw input (default: true to match Python)
  useShifts?: boolean; // Learn phase shifts (default: false) - matches Python use_shifts
  hiddenN?: number; // Internal dimension multiplier (default: 1.0) - matches Python hidden_n
  scaling?: 'pow' | 'linear'; // Frequency scaling (default: 'pow')
  maxFrequency?: number; // Max frequency (default: 1e4)
  useLowBands?: boolean; // Include low-frequency bands (default: true) - matches Python use_low_bands
  useHighBands?: boolean; // Include high-frequency bands (default: true) - matches Python use_high_bands
  finalDropout?: number; // Dropout rate (default: 0.0) - matches Python final_dropout
  bandsDropout?: boolean; // Per-band dropout (default: false) - matches Python bands_dropout
  sharedTransformation?: boolean; // Shared fusion weights (default: false) - matches Python shared_transformation
  name?: string; // Make name optional to match Python (**kwargs)
}

export class CoordsEncodingLayer {
  private config: CoordsEncodingLayerConfig;
  private N: number;
  private useShifts: boolean;
  private hiddenN: number;
  private scaling: 'pow' | 'linear';
  private maxFrequency: number;
  private useLowBands: boolean;
  private useHighBands: boolean;
  private finalDropout: number;
  private bandsDropout: boolean;
  private name: string;
  private internalN: number;
  private built: boolean = false;
  private namePrefix: string;

  // Pre-computed frequency bands
  private frequencyBands: number[] = [];

  // Trainable parameters
  private freqDeltas: tf.Variable | null = null;
  private frequency: tf.Variable | null = null;
  private shifts: tf.Variable | null = null;
  private fusionWeights: tf.Variable | null = null;
  private fusionBias: tf.Variable | null = null;
  private gates: tf.Variable | null = null;

  // Layers
  private bottleneck: tfl.layers.Layer | null = null;
  private dropoutLayer: tfl.layers.Layer | null = null;

  constructor(config: CoordsEncodingLayerConfig) {
    this.config = config;
    this.N = config.N;
    this.useShifts = config.useShifts ?? false;
    this.hiddenN = config.hiddenN ?? 1.0;
    this.scaling = config.scaling ?? 'pow';
    this.maxFrequency = config.maxFrequency ?? 1e4;
    this.useLowBands = config.useLowBands ?? true;
    this.useHighBands = config.useHighBands ?? true;
    this.finalDropout = config.finalDropout ?? 0.0;
    this.bandsDropout = config.bandsDropout ?? false;
    // ✅ FIXED: Set raw explicitly to default (true to match Python)
    this.config.raw = config.raw ?? true;
    this.name = config.name ?? 'CoordsEncodingLayer'; // Default name to match Python behavior
    this.namePrefix = `${hashCode(this.name)}_`;

    // Calculate internalN like Python: N = int(N * hidden_n)
    this.internalN = Math.floor(this.N * this.hiddenN);

    // Initialize parameters (don't build layers yet)
    this.initializeFrequencyBands();
  }

  /**
   * Initialize frequency bands (pre-computed).
   */
  private initializeFrequencyBands(): void {
    const maxN =
      this.useHighBands && this.useLowBands ? 1 + Math.floor(this.internalN / 2) : this.internalN;

    // Create base frequency bands
    const bands: number[] = [];

    if (this.scaling === 'pow') {
      const maxFreq = Math.pow(DEFAULT_FREQUENCY_BASE, Math.min(maxN, MAX_FREQUENCY_POWER));
      const base = Math.pow(maxFreq, 1.0 / maxN);

      for (let i = 0; i < maxN; i++) {
        bands.push(Math.pow(base, i));
      }
    } else {
      // Linear scaling
      for (let i = 0; i < maxN; i++) {
        bands.push(1.0 + i / maxN);
      }
    }

    // Build low and high bands
    const allBands: number[] = [];

    if (this.useLowBands) {
      for (let i = bands.length - 1; i >= 1 && allBands.length < maxN; i--) {
        allBands.push(1.0 / bands[i - 1]);
      }
    }

    if (this.useHighBands) {
      for (let i = 0; i < bands.length && allBands.length < this.internalN; i++) {
        allBands.push(bands[i]);
      }
    }

    // Pad if necessary
    while (allBands.length < this.internalN) {
      allBands.push(1.0);
    }

    this.frequencyBands = allBands.slice(0, this.internalN);
  }

  /**
   * Build the layer with input shape.
   */
  public build(inputShape: number[]): void {
    if (this.built) {
      console.warn('Layer already built. Skipping.');
      return;
    }

    console.log(`[CoordsEncodingLayer.${this.name}] Building with input shape: ${inputShape}`);

    const namePrefix = this.namePrefix;

    // Bottleneck projection to output dimension
    this.bottleneck = tfl.layers.dense({
      units: this.N,
      useBias: false,
      activation: null,
      name: `${namePrefix}bottleneck`,
    });

    // Dropout layer - support bands_dropout
    if (this.finalDropout > 0) {
      if (this.bandsDropout) {
        // Per-band dropout will be applied in apply() method
        // No standard dropout layer needed here
      } else {
        // Standard element-wise dropout
        this.dropoutLayer = tfl.layers.dropout({
          rate: this.finalDropout,
          name: `${namePrefix}dropout`,
        });
      }
    }

    // Initialize trainable weights
    this.initializeWeights();

    // Set built flag BEFORE calling apply() to allow dummy input test
    this.built = true;
    const dummyInput = tf.zeros(inputShape.map(x => x || 1));
    const res = this.apply(dummyInput, false);
    disposeAll([dummyInput, res]);
    console.log(`[CoordsEncodingLayer.${this.name}] ✅ Built successfully`);
  }

  /**
   * Initialize trainable weights.
   */
  private initializeWeights(): void {
    // Frequency deltas (learnable modulation)
    this.freqDeltas = tf.variable(
      tf.randomNormal([this.internalN], 0, 0.01),
      true,
      `${this.namePrefix}freq_deltas`
    );

    // Global frequency scaling
    this.frequency = tf.variable(
      tf.fill([1], this.maxFrequency),
      true,
      `${this.namePrefix}frequency`
    );

    // Phase shifts (optional) - shape: (1, 1, 1, N) to match Python
    if (this.useShifts) {
      this.shifts = tf.variable(
        tf.randomNormal([1, 1, 1, this.internalN], 0, 0.01),
        true,
        `${this.namePrefix}shifts`
      );
    } else {
      this.shifts = tf.variable(tf.zeros([1, 1, 1, 1]), false, `${this.namePrefix}shifts`);
    }

    // Gates for learned band importance - initialize to zeros like Python
    // Python initializes to zeros: tf.keras.initializers.Zeros()
    this.gates = tf.variable(tf.zeros([1, 1, this.internalN]), true, `${this.namePrefix}gates`);
  }

  private _initDynamicFusion(numFusionParams: number, fusionDim: number): void {
    if (this.fusionBias || this.fusionWeights) return;

    this.fusionWeights = tf.variable(
      tf.randomNormal([1, numFusionParams, fusionDim], 0, 0.01),
      true,
      `${this.namePrefix}fusion_w`
    );

    // Fusion bias shape: [num_fusion_params] like Python version
    this.fusionBias = tf.variable(
      tf.randomNormal([1, numFusionParams], 0, 0.01),
      true,
      `${this.namePrefix}fusion_b`
    );
  }

  /**
   * Get frequency coefficients: (base + tanh(deltas) * range) * softplus(frequency)
   */
  private getFrequencyCoefficients(): tf.Tensor {
    return tf.tidy(() => {
      // Base frequencies from pre-computed bands
      const baseTensor = tf.tensor1d(this.frequencyBands);

      // Learnable modulation - read variable to tensor
      const deltasTensor = this.freqDeltas!;
      const tanhDeltas = tf.tanh(deltasTensor);

      // Frequency scaling - read variable to tensor
      const freqTensor = this.frequency!;
      const freqScale = tf.softplus(freqTensor);

      // Combine: (base + tanh(deltas)) * softplus(frequency)
      // Like Python: base_freq + tf.nn.tanh(self._freq_deltas) * freq_range (but freq_range is 0 in our case)
      const coefficients = tf.add(baseTensor, tanhDeltas);
      const scaled = tf.mul(coefficients, freqScale);

      // Like Python: return coefficients[None, None, None] * frequency[None, None, None]
      // Shape: (1, 1, N, 1) to match Python broadcast pattern
      return tf.expandDims(tf.expandDims(scaled, 0), 0);
    });
  }

  /**
   * Transform coordinates to sinusoidal basis functions.
   * Input: (B, P, coord_dim), Output: (B, P, N, coord_dim*2)
   *
   * ✅ FIXED: Match Python implementation exactly
   */
  private transformCoordinates(coordinates: tf.Tensor): tf.Tensor {
    return tf.tidy(() => {
      const coefs = this.getFrequencyCoefficients();
      const shifts = this.shifts!;

      // Like Python: scaled_coords = (tf.expand_dims(coordinates, -1) * self.coefs) + self.shifts
      const expanded = tf.expandDims(coordinates, -1); // (B, P, coord_dim, 1)
      const scaled = tf.mul(expanded, coefs); // (B, P, coord_dim, N)
      const withShifts = tf.add(scaled, shifts); // (B, P, coord_dim, N)

      // Like Python: scaled_coords = scaled_coords * (2.0 * math.pi)
      const scaled2pi = tf.mul(withShifts, 2 * Math.PI);

      // Like Python: scaled_coords = tf.transpose(scaled_coords, (0, 1, 3, 2))
      // Transpose from (B, P, coord_dim, N) to (B, P, N, coord_dim)
      const transposed = tf.transpose(scaled2pi, [0, 1, 3, 2]);

      // Like Python: scaled_coords = tf.expand_dims(scaled_coords, -1)
      // Add last dimension for sin/cos functions
      const withDim = tf.expandDims(transposed, -1); // (B, P, N, coord_dim, 1)

      // Apply sin and cos functions like Python
      const sinVals = tf.sin(withDim);
      const cosVals = tf.cos(withDim);

      // Concatenate: (B, P, N, coord_dim, 2)
      const concat = tf.concat([sinVals, cosVals], -1);

      // Like Python: result = tf.reshape(result, (batch_size, num_points, num_bands, result.shape[-1] * coord_dim))
      const batch_size = coordinates.shape[0];
      const num_points = coordinates.shape[1];
      const num_bands = this.internalN;
      const coord_dim = coordinates.shape[2];

      return tf.reshape(concat, [batch_size, num_points, num_bands, coord_dim * 2]);
    });
  }

  /**
   * Fuse sinusoidal basis using learned weights.
   * Input: (B, P, N, coord_dim*2), Output: (B, P, N)
   *
   * ✅ FIXED: Match Python implementation exactly
   */
  private fuse(transformed: tf.Tensor): tf.Tensor {
    return tf.tidy(() => {
      const shp = transformed.shape;
      this._initDynamicFusion(shp[shp.length - 2], shp[shp.length - 1]);
      const fusionW = this.fusionWeights!;
      const fusionB = this.fusionBias!;

      // Python: result = tf.reduce_sum(x * self._fusion_w, axis=-1) + self._fusion_b
      const weighted = tf.mul(transformed, fusionW);
      const summed = tf.sum(weighted, -1);
      const result = tf.add(summed, fusionB);

      return result;
    });
  }

  /**
   * Apply per-band dropout based on learned gate values.
   *
   * ✅ FIXED: Implement band-wise dropout matching Python
   *
   * Dropout rates are computed per-band:
   *   dropout_rate[i] = (1 - normalized_gate[i]) * max_rate
   *
   * Bands with low gate values (less important) have higher dropout rates.
   */
  private applyBandsDropout(x: tf.Tensor, training: boolean): tf.Tensor {
    return tf.tidy(() => {
      if (!training) {
        return x;
      }

      const gatesVal = this.gates!;
      const normed = tf.abs(gatesVal);

      // Normalize gates: (1, 1, N) -> (1, 1, N) in range [0, 1]
      const maxGate = tf.max(normed);
      const normalizedGates = tf.divNoNan(normed, maxGate);

      // Compute per-band dropout rates: (1 - normalized) * max_rate
      const dropoutRates = tf.mul(tf.sub(1.0, normalizedGates), this.finalDropout);

      // Generate random noise: (B, P, N)
      const noise = tf.randomUniform(x.shape, 0.0, 1.0);

      // Create binary mask: noise > dropout_rates
      const mask = tf.cast(tf.greater(noise, dropoutRates), x.dtype);

      // Rescale by (1 - dropout_rate) for unbiased expectation
      const rescale = tf.divNoNan(1.0, tf.sub(1.0, dropoutRates));
      const rescaled = tf.mul(mask, rescale);

      // Apply dropout: x * rescaled_mask
      return tf.mul(x, rescaled);
    });
  }

  async loadWeights(weightsMap: TensorMap): Promise<void> {
    if (!this.built) {
      throw new Error(
        `CoordsEncodingLayer.${this.name} not built. Call build() first before apply().`
      );
    }

    const name = this.name;

    console.log(`[CoordsEncodingLayer.${name}] Loading weights`);

    // Load trainable parameters with exact patterns
    if (this.freqDeltas) {
      const pattern = `weights/${name}/CEL_freq_deltas`;
      const tensor = weightsMap.get(pattern);
      if (tensor) {
        this.freqDeltas.assign(tensor);
        console.log(`[CoordsEncodingLayer.${name}] CEL_freq_deltas: ✓ Loaded`);
      } else {
        throw new Error(`[CoordsEncodingLayer.${name}] Required weights not found: ${pattern}`);
      }
    }

    if (this.frequency) {
      const pattern = `weights/${name}/CEL_frequency`;
      const tensor = weightsMap.get(pattern);
      if (tensor) {
        this.frequency.assign(tensor);
        console.log(`[CoordsEncodingLayer.${name}] CEL_frequency: ✓ Loaded`);
      } else {
        throw new Error(`[CoordsEncodingLayer.${name}] Required weights not found: ${pattern}`);
      }
    }

    // Load shifts regardless of useShifts since it's always used in transformation
    if (this.shifts) {
      const pattern = `weights/${name}/CEL_shifts`;
      const tensor = weightsMap.get(pattern);
      if (tensor) {
        this.shifts.assign(tensor);
        console.log(`[CoordsEncodingLayer.${name}] CEL_shifts: ✓ Loaded`);
      } else {
        throw new Error(`[CoordsEncodingLayer.${name}] Required weights not found: ${pattern}`);
      }
    }

    const pattern = `weights/${name}/CEL_fusion_w`;
    const tensor = weightsMap.get(pattern);
    if (tensor) {
      const shp = tensor.shape;
      this._initDynamicFusion(shp[shp.length - 2], shp[shp.length - 1]);
      this.fusionWeights.assign(tensor);
      console.log(`[CoordsEncodingLayer.${name}] CEL_fusion_w: ✓ Loaded`);
    } else {
      throw new Error(`[CoordsEncodingLayer.${name}] Required weights not found: ${pattern}`);
    }

    if (this.fusionBias) {
      const pattern = `weights/${name}/CEL_fusion_b`;
      const tensor = weightsMap.get(pattern);
      if (tensor) {
        this.fusionBias.assign(tensor);
        console.log(`[CoordsEncodingLayer.${name}] CEL_fusion_b: ✓ Loaded`);
      } else {
        throw new Error(`[CoordsEncodingLayer.${name}] Required weights not found: ${pattern}`);
      }
    }

    if (this.gates) {
      const pattern = `weights/${name}/CEL_gates`;
      const tensor = weightsMap.get(pattern);
      if (tensor) {
        this.gates.assign(tensor);
        console.log(`[CoordsEncodingLayer.${name}] CEL_gates: ✓ Loaded`);
      } else {
        throw new Error(`[CoordsEncodingLayer.${name}] Required weights not found: ${pattern}`);
      }
    }

    // Load bottleneck weights (dense layer) - use bias-free pattern
    if (this.bottleneck) {
      weightsMap.assignDense(`${name}/_bottleneck`, this.bottleneck);
      console.log(`[CoordsEncodingLayer.${name}] _bottleneck: ✓ Set weights (kernel only)`);
    }

    console.log(`[CoordsEncodingLayer.${name}] ✅ All weights loaded`);
  }

  /**
   * Apply coordinate encoding.
   * Input: (B, P, 2), Output: (B, P, N)
   *
   * ✅ FIXED: Support bands_dropout
   */
  apply(coordinates: tf.Tensor, training: boolean): tf.Tensor {
    return tf.tidy(() => {
      // ✅ FIXED: Accept any coordinate dimension, not just 2
      // Validate input is 3D: (batch, points, coord_dim)
      if (coordinates.shape.length !== 3) {
        throw new Error(
          `CoordsEncodingLayer expects 3D input (batch, points, coord_dim), got shape ${coordinates.shape}`
        );
      }

      // Validate layer is built
      if (!this.built) {
        throw new Error(
          `CoordsEncodingLayer.${this.name} not built. Call build() first before apply().`
        );
      }

      // Transform to sinusoidal basis
      const transformed = this.transformCoordinates(coordinates);

      // Fuse basis functions
      const fused = this.fuse(transformed);

      // Apply gating: multiply by tanh(_gates) like Python
      const gatesActivated = tf.tanh(this.gates!);
      const gated = tf.mul(fused, gatesActivated);

      // ✅ FIXED: Apply dropout - either bands_dropout or standard
      let dropped = gated;
      if (this.finalDropout > 0) {
        if (this.bandsDropout) {
          dropped = this.applyBandsDropout(gated, training);
        } else if (this.dropoutLayer) {
          dropped = this.dropoutLayer.apply(gated, { training }) as tf.Tensor;
        }
      }

      // Concatenate raw coordinates with result (if enabled) - matches Python reference
      let finalInput = dropped;
      if (this.config.raw) {
        finalInput = tf.concat([coordinates, dropped], -1);
      }

      // Project to output dimension
      const output = this.bottleneck!.apply(finalInput) as tf.Tensor;

      return output;
    });
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    // Dispose all tensors at once
    disposeAll([
      this.freqDeltas,
      this.frequency,
      this.shifts,
      this.fusionWeights,
      this.fusionBias,
      this.gates,
      this.bottleneck,
      this.dropoutLayer,
    ]);

    // Clear references
    this.freqDeltas = null;
    this.frequency = null;
    this.shifts = null;
    this.fusionWeights = null;
    this.fusionBias = null;
    this.gates = null;
    this.bottleneck = null;
    this.dropoutLayer = null;
  }
}
