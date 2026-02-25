/**
 * TensorFlow.js configuration and dynamic loading
 *
 * This module handles conditional loading of TensorFlow.js backends
 * based on the environment and configuration.
 */

// Check if we should use Node.js backend
const useNodeBackend = process.env.TFJS_NODE === '1' || typeof window === 'undefined';

// Cache the TensorFlow.js instance to avoid multiple imports
let tfCache = null;

/**
 * Get TensorFlow.js instance with appropriate backend
 * @returns {Promise<import('@tensorflow/tfjs').TensorFlowJS>}
 */
export async function getTensorFlow() {
  if (tfCache) {
    return tfCache;
  }

  if (useNodeBackend) {
    // Use Node.js backend for better performance in development/SSR
    tfCache = await import('@tensorflow/tfjs-node');
    console.log('Using TensorFlow.js Node.js backend');
  } else {
    // Use regular browser backend
    tfCache = await import('@tensorflow/tfjs');
    console.log('Using TensorFlow.js browser backend');
  }

  return tfCache;
}

/**
 * Get TensorFlow.js Layers extension if available
 * @returns {Promise<import('@tensorflow/tfjs-layers')>}
 */
export async function getTensorFlowLayers() {
  if (useNodeBackend) {
    return await import('@tensorflow/tfjs-layers');
  } else {
    return await import('@tensorflow/tfjs-layers');
  }
}

/**
 * Initialize TensorFlow.js with backend configuration
 * @returns {Promise<void>}
 */
export async function initializeTensorFlow() {
  const tf = await getTensorFlow();

  // Set backend based on environment
  if (useNodeBackend) {
    tf.setBackend('node');
  } else {
    // Auto-detect best backend for browser
    const backends = ['webgl', 'wasm', 'cpu'];
    for (const backend of backends) {
      try {
        await tf.setBackend(backend);
        console.log(`TensorFlow.js backend: ${backend}`);
        break;
      } catch (e) {
        console.log(`${backend} backend not available, trying next...`);
      }
    }
  }

  await tf.ready();
  console.log('TensorFlow.js initialized successfully');
}
