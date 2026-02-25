import * as tf from '@tensorflow/tfjs';
import * as tfl from '@tensorflow/tfjs-layers';
import { TensorMap, disposeAll, hashCode } from './utils/tensorflow';
import { sMLP } from './sMLP';
import {
  PREDICTOR_BLOCK_MLP_SIZES,
  PREDICTOR_BLOCK_ACTIVATION,
  PREDICTOR_BLOCK_SHIFT,
  PREDICTOR_BLOCK_OUTPUT_DIMS,
} from './Constants';

export interface PredictorGazeConfig {
  shift?: number;
  name: string;
}

export class PredictorGaze {
  private _shift: number;
  private _mlp: sMLP;
  private _dense: tfl.layers.Layer;
  private _name: string;
  private _outputShape: number[] | null = null;
  private built: boolean = false;
  private _namePrefix: string;

  constructor(config: PredictorGazeConfig) {
    this._shift = config.shift ?? PREDICTOR_BLOCK_SHIFT;
    this._name = config.name || 'PredictorGaze_layer';
    this._namePrefix = `${hashCode(this._name)}_`;
  }

  build(inputShape: number[]): void {
    const namePrefix = this._namePrefix;

    // Create sMLP for feature processing (matches Python implementation)
    this._mlp = new sMLP({
      sizes: [...PREDICTOR_BLOCK_MLP_SIZES],
      activation: PREDICTOR_BLOCK_ACTIVATION,
      name: `${this._name}/MLP`,
    });

    // Build sMLP with input shape
    this._mlp.build(inputShape);

    // Dense layer for gaze prediction (matches Python implementation)
    this._dense = tfl.layers.dense({
      units: PREDICTOR_BLOCK_OUTPUT_DIMS,
      name: `${namePrefix}Dense`,
    });

    // Store shapes during build
    this._outputShape = this._computeOutputShape(inputShape);

    this.built = true;

    // BAD BUT WORKING - build computational graph
    console.log(`[PredictorGaze.${this._name}] Building model with dummy input`);
    // BAD BUT WORKING
    const input = tf.zeros(
      inputShape.map(x => x || 1),
      'float32'
    );
    const res = this.apply(input, false);
    disposeAll([input, res]);
    console.log(`[PredictorGaze.${this._name}] Model built successfully`);
  }

  private _computeOutputShape(inputShape: number[]): number[] {
    // Input: [batch, sequence, features] → MLP output: [batch, sequence, 128] → Dense: [batch, sequence, 2]
    const outputSize = PREDICTOR_BLOCK_OUTPUT_DIMS;
    return [inputShape[0], inputShape[1], outputSize];
  }

  call(inputs: tf.Tensor, training: boolean): tf.Tensor {
    if (!this.built) {
      throw new Error('PredictorGaze has not been built. Call build() first.');
    }

    // Pass through sMLP first (matches Python)
    const mlpOutput = this._mlp.apply(inputs, training);

    // Apply dense layer and add shift (matches Python)
    const denseOutput = this._dense.apply(mlpOutput) as tf.Tensor;
    return tf.add(denseOutput, this._shift);
  }

  apply(inputs: tf.Tensor, training: boolean): tf.Tensor {
    if (!this.built) {
      throw new Error('PredictorGaze has not been built. Call build() first.');
    }
    return this.call(inputs, training);
  }

  output_shape(): number[] {
    if (this._outputShape === null) {
      throw new Error('PredictorGaze not built. Call build first.');
    }
    return this._outputShape;
  }

  async loadWeights(weights: TensorMap): Promise<void> {
    await this._mlp.loadWeights(weights);

    // Build dense layer first (required for weight loading)
    const dummyInput = tf.zeros(this._mlp.output_shape());
    this._dense.apply(dummyInput);
    dummyInput.dispose();

    // Load weights for dense layer using assignDense
    weights.assignDense(`${this._name}/Dense`, this._dense);
  }

  dispose(): void {
    disposeAll([this._mlp, this._dense]);
    this._mlp = null as any;
    this._dense = null as any;
  }
}
