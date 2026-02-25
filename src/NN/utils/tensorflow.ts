import * as tf from '@tensorflow/tfjs';
import JSZip from 'jszip';
import * as fs from 'fs';

export interface TensorMap_ {
  [key: string]: tf.Tensor;
}

export interface TensorShapes {
  [key: string]: number[];
}

/**
 * Track tensor key access patterns for debugging unused tensors
 */
export class TensorMap {
  private tensors: TensorMap_;
  private accessedKeys: Set<string> = new Set();
  private allKeys: Set<string>;

  constructor(tensors: TensorMap_) {
    this.tensors = tensors;
    this.allKeys = new Set(Object.keys(tensors));
  }

  /**
   * Get a tensor and mark it as accessed
   */
  get(key: string): tf.Tensor | undefined {
    this.accessedKeys.add(key);
    return this.tensors[key];
  }

  /**
   * Get all unaccessed keys
   */
  getUnaccessedKeys(): string[] {
    return Array.from(this.allKeys).filter(key => !this.accessedKeys.has(key));
  }

  /**
   * Get access statistics
   */
  getStats() {
    return {
      unaccessed: this.getUnaccessedKeys(),
    };
  }

  /**
   * Dispose all tensors and print access report
   */
  dispose(): void {
    const stats = this.getStats();
    if (stats.unaccessed.length > 0) {
      throw new Error('Not accessed tensors:\n' + stats.unaccessed.join('\n'));
    }
  }

  assignDense(key, layer) {
    const kernelKey = `weights/${key}/kernel`;
    const kernel = this.get(kernelKey);

    // Check how many weights the layer expects
    const weightCount = layer.weights.length;

    if (!kernel) {
      throw new Error(`Dense kernel not found at key: ${kernelKey}`);
    }

    const data = [kernel];
    if (weightCount === 2) {
      const biasKey = `weights/${key}/bias`;
      const bias = this.get(biasKey);
      // Layer expects both kernel and bias weights
      if (!bias) {
        throw new Error(`Dense bias not found at key: ${biasKey} (layer expects 2 weights)`);
      }
      data.push(bias);
    }
    layer.setWeights(data);
  }

  assignNorm(key, layer) {
    const gammaKey = `weights/${key}/gamma`;
    const gamma = this.get(gammaKey);

    const betaKey = `weights/${key}/beta`;
    const beta = this.get(betaKey);

    // Check how many weights the layer expects
    const weightCount = layer.weights.length;

    if (!gamma) {
      throw new Error(`Normalization gamma not found at key: ${gammaKey}`);
    }

    // Batch normalization has 4 weights (gamma, beta, moving_mean, moving_variance)
    // Layer normalization has 2 weights (gamma, beta)
    // Some normalization layers might have only 1 weight (gamma only)
    if (weightCount === 4) {
      const movingMeanKey = `weights/${key}/moving_mean`;
      const movingMean = this.get(movingMeanKey);
      
      const movingVarianceKey = `weights/${key}/moving_variance`;
      const movingVariance = this.get(movingVarianceKey);

      // Batch normalization: gamma, beta, moving_mean, moving_variance
      if (!beta || !movingMean || !movingVariance) {
        throw new Error(`Batch normalization weights incomplete. Expected gamma, beta, moving_mean, moving_variance at key: ${key}`);
      }
      layer.setWeights([gamma, beta, movingMean, movingVariance]);
    } else if (weightCount === 2) {
      // Layer normalization: gamma, beta
      if (!beta) {
        throw new Error(`Layer normalization beta not found at key: ${betaKey} (layer expects 2 weights)`);
      }
      layer.setWeights([gamma, beta]);
    } else if (weightCount === 1) {
      // Gamma only (some normalization variants)
      layer.setWeights([gamma]);
    } else {
      throw new Error(`Normalization layer expects ${weightCount} weights, but supports 1, 2 (layer norm) or 4 (batch norm) weights`);
    }
  }
}

/**
 * Simple hash function for strings
 */
export function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Load ZIP file and extract tensors with required shapes.json
 * @param zipPath Path to the ZIP file
 * @returns Promise containing tensors (TensorMap)
 * @throws Error if ZIP file cannot be loaded or shapes.json is missing
 */
export async function tensorsFromZip(zipPath: string): Promise<TensorMap> {
  // Load the ZIP file
  const zipDataBuffer = fs.readFileSync(zipPath);
  const zipData = await JSZip.loadAsync(zipDataBuffer);

  const res = await loadTensorsFromZipData(zipData);
  return new TensorMap(res);
}

/**
 * Load tensors from ZIP file data with required shapes.json
 * @param zipData JSZip instance containing the data
 * @returns Promise containing only tensors (TensorMap)
 * @throws Error if shapes.json is missing or contains missing shapes
 */
export async function loadTensorsFromZipData(zipData: JSZip): Promise<TensorMap_> {
  // Load shapes.json - required and must exist
  let shapes: TensorShapes = {};

  try {
    const shapesData = await zipData.file('shapes.json')?.async('text');
    if (!shapesData) {
      throw new Error(`[tensorflow] Shapes file 'shapes.json' is required but not found in ZIP`);
    }

    shapes = JSON.parse(shapesData);
  } catch (error) {
    throw new Error(`[tensorflow] Failed to load or parse shapes.json: ${error}`);
  }

  // Load all .bin files from the entire ZIP
  const tensors: TensorMap_ = {};
  const binFiles = zipData.file(/\.bin$/);

  console.log(`[tensorflow] Found ${binFiles.length} .bin files`);

  for (const file of binFiles) {
    const dataArray = await file.async('arraybuffer');

    // Get shape info from shapes.json
    const shapeInfo = shapes[file.name];

    // Throw error if shape is missing
    if (!shapeInfo) {
      throw new Error(`[tensorflow] Shape missing for ${file.name} in shapes.json`);
    }

    // Use just the file.name without directory path as key
    const simpleKey = file.name.replace('.bin', '');
    const tensorShape = shapeInfo['shape'];
    let typeClass = null;
    let dtype = shapeInfo['type'];

    if ('float64' == dtype) {
      typeClass = Float64Array;
      dtype = 'float32';
    } else if ('int32' == dtype) {
      typeClass = Int32Array;
    } else if ('float32' == dtype) {
      typeClass = Float32Array;
    } else if ('int16' == dtype) {
      typeClass = Int16Array;
    } else if ('int8' == dtype) {
      typeClass = Int8Array;
    } else if ('uint16' == dtype) {
      typeClass = Uint16Array;
    } else if ('uint8' == dtype) {
      typeClass = Uint8Array;
    } else {
      throw new Error(`Unsupported dtype: ${dtype}`);
    }

    // Convert ArrayBuffer to proper array format for TensorFlow.js
    const dataArrayTyped: number[] = Array.from(new typeClass(dataArray));
    tensors[simpleKey] = tf.tensor(dataArrayTyped, tensorShape, dtype);

    console.log(
      `[tensorflow] Loaded tensor: ${simpleKey}, shape: ${tensors[simpleKey].shape}, dtype: ${tensors[simpleKey].dtype}`
    );
  }

  console.log(`[tensorflow] Successfully loaded ${Object.keys(tensors).length} tensors`);
  return tensors;
}

/**
 * Compute softmax function along specified axis
 * @param input Input tensor
 * @param axis Axis to compute softmax along (default: -1, last axis)
 * @returns Softmax output tensor
 */
export function softmax(input: tf.Tensor, axis: number = -1): tf.Tensor {
  // Handle negative axis values
  if (axis < 0) {
    axis = input.shape.length + axis;
  }

  // Compute softmax: exp(x) / sum(exp(x))
  const exp = tf.exp(tf.sub(input, tf.max(input, axis, true)));
  const sumExp = tf.sum(exp, axis, true);
  return tf.div(exp, sumExp);
}

/**
 * Cleanup objects to prevent memory leaks
 * @param objects Array or object of objects to dispose
 */
export function disposeAll(object: any): void {
  const cleanup = object => {
    if (object) {
      try {
        object.dispose();
      } catch (e) {
        // Ignore
      }
    }
  };
  if (Array.isArray(object)) {
    object.forEach(cleanup);
  } else {
    Object.values(object).forEach(cleanup);
  }
}
