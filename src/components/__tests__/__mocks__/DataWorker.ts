/**
 * Mock DataWorker for Jest tests
 * Replaces the real DataWorker which uses import.meta
 */

export const worker = {
  postMessage: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  terminate: jest.fn(),
};

export default {
  worker,
};
