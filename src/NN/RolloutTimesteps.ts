/**
 * RolloutTimesteps - Applies a function to rolled-out timesteps.
 *
 * ⚠️ **REFACTORED TO MATCH PYTHON EXACTLY**
 * Python Reference: /NN/layers/RolloutTimesteps.py lines 12-134
 *
 * Reshapes temporal sequences (batch, timesteps, ...) by flattening to (batch*timesteps, ...),
 * applies a function/layer, then reshapes back to temporal format.
 * Supports tensors, lists of tensors, and dicts of tensors.
 *
 * Usage:
 * ```typescript
 * const coordsEncoder = new CoordsEncodingLayer({ N: 32 });
 * const rollout = new RolloutTimesteps(coordsEncoder);
 * const output = rollout.apply(tf.randomNormal([32, 10, 2])); // (32, 10, 32)
 * ```
 */

import * as tf from '@tensorflow/tfjs';
import { TensorMap, disposeAll } from './utils/tensorflow';

export type RolloutInput = tf.Tensor | tf.Tensor[] | { [key: string]: tf.Tensor };
export type RolloutOutput = tf.Tensor | tf.Tensor[] | { [key: string]: tf.Tensor };

export interface IApplyable {
  apply(input: any, kwargs?: any): any;
}

export type LayerFunction = (name: string) => IApplyable;

export class RolloutTimesteps {
  private F: IApplyable | any; // Support both IApplyable and tfl.layers.Layer
  private name: string;
  private built: boolean = false;
  private innerLayerFunction: LayerFunction; // Store the original function

  /**
   * Initialize rollout layer.
   *
   * Args:
   *   F: Function that returns a layer. Must be a callable that when
   *      called returns a layer instance (e.g., lambda: tf.keras.layers.Dense(256)).
   *   kwargs: Additional arguments including name (default: 'RolloutTimesteps')
   */
  constructor(F: LayerFunction, kwargs: any = {}) {
    kwargs.name = kwargs.name || 'RolloutTimesteps';
    this.name = kwargs.name;
    this.innerLayerFunction = F;

    // F must be a function that returns a layer
    if (typeof F !== 'function') {
      throw new Error('F must be a callable that returns a layer');
    }

    // Don't build the layer yet - wait for build() call
  }

  /**
   * Build the rollout layer.
   *
   * ✅ FIXED: Build the inner layer with input shape
   */
  public build(inputShape: number[]): void {
    if (this.built) {
      console.warn('RolloutTimesteps already built. Skipping.');
      return;
    }

    // Call the function to get the actual layer
    this.F = this.innerLayerFunction(this.name);

    // Build the inner layer with the appropriate input shape
    // For CoordsEncodingLayer, we need flatten batch and timestep
    const innerInputShape = [null, ...inputShape.slice(2)];
    this.F.build(innerInputShape);

    // Initialize computational graph
    this.built = true;
  }

  /**
   * Reshape single tensor, list of tensors, or dict of tensors.
   *
   * ✅ FIXED: Support multiple input types like Python version
   *
   * Preserves the input structure while reshaping. Lists remain lists,
   * dicts remain dicts, tensors remain tensors.
   */
  private reshapeAll(
    inputData: RolloutInput,
    targetShapePrefix: number[],
    preserveAxis: number
  ): RolloutInput {
    return tf.tidy(() => {
      const computeNewShape = (tensor: tf.Tensor): number[] => {
        const shape = tensor.shape;
        const remainingShape = shape.slice(preserveAxis);
        return [...targetShapePrefix, ...remainingShape];
      };

      if (inputData instanceof tf.Tensor) {
        return tf.reshape(inputData, computeNewShape(inputData));
      }

      if (Array.isArray(inputData)) {
        return (inputData as tf.Tensor[]).map((v: tf.Tensor) => tf.reshape(v, computeNewShape(v)));
      }

      if (typeof inputData === 'object' && inputData !== null) {
        const result: { [key: string]: tf.Tensor } = {};
        for (const [k, v] of Object.entries(inputData)) {
          if (v instanceof tf.Tensor) {
            result[k] = tf.reshape(v, computeNewShape(v));
          }
        }
        return result;
      }

      return inputData;
    });
  }

  /**
   * Apply function to rolled-out timesteps.
   *
   * ✅ FIXED: Match Python implementation exactly
   *
   * Reshapes temporal sequences by collapsing batch and timesteps dimensions,
   * applies the function, then reshapes back to temporal format.
   *
   * Args:
   *   x: Input with shape (batch, timesteps, ...) - tensor, list of tensors, or dict
   *   trainingOrKwargs: Either a boolean (training flag) or kwargs object
   *                      Backward compatible with: apply(input, true/false)
   *
   * Returns:
   *   Output with same shape (batch, timesteps, ...) and structure as input.
   *   When input is a Tensor, output is a Tensor.
   *   When input is Tensor[], output is Tensor[].
   *   When input is dict, output is dict.
   */
  apply(x: RolloutInput, training: boolean): any {
    if (!this.built) {
      throw new Error(
        `RolloutTimesteps.${this.name} not built. Call build() first before apply().`
      );
    }

    return tf.tidy(() => {
      // Extract reference tensor to determine batch and timestep dimensions
      let referenceTensor: tf.Tensor;

      if (x instanceof tf.Tensor) {
        referenceTensor = x;
      } else if (Array.isArray(x) && x.length > 0) {
        referenceTensor = x[0];
      } else if (typeof x === 'object' && x !== null && !Array.isArray(x)) {
        const firstKey = Object.keys(x)[0];
        referenceTensor = (x as any)[firstKey];
      } else {
        throw new Error('Input must be Tensor, array of Tensors, or dict of Tensors');
      }

      const batchSize = referenceTensor.shape[0]!;
      const timestepsCount = referenceTensor.shape[1]!;
      const flatBatchTimesteps = batchSize * timestepsCount;

      // Reshape to (batch * timesteps, ...)
      const flattenedInput = this.reshapeAll(x, [flatBatchTimesteps], 2);

      // Apply function with training flag
      const rolloutResult = this.F.apply(flattenedInput, { training });

      // Reshape back to (batch, timesteps, ...)
      return this.reshapeAll(rolloutResult, [batchSize, timestepsCount], 1);
    });
  }

  dispose(): void {
    if (this.F) {
      disposeAll([this.F]);
      this.F = null as any;
    }
  }

  /**
   * Load weights from TensorMap
   */
  async loadWeights(weightsMap: TensorMap): Promise<void> {
    if (!this.built) {
      throw new Error(
        `RolloutTimesteps.${this.name} not built. Call build() first before apply().`
      );
    }

    await this.F.loadWeights(weightsMap);
  }
}
