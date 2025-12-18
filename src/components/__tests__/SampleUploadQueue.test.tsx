import { SampleUploadQueue } from '../Samples';
import { createMockSample } from './testHelpers';
import { worker } from './__mocks__/DataWorker';

describe('SampleUploadQueue', () => {
  let queue: SampleUploadQueue;

  beforeEach(() => {
    jest.clearAllMocks();
    queue = new SampleUploadQueue('/api/upload', 1000);
  });

  it('should enqueue samples for upload', () => {
    const samples = [createMockSample(), createMockSample()];
    const incomplete = queue.enqueueForUpload(samples, false);
    // With default maxSamplesPerBatch of 1000, 2 samples won't trigger worker yet
    expect(worker.postMessage).not.toHaveBeenCalled();
    // All 2 samples should be returned as incomplete
    expect(incomplete).toHaveLength(2);
  });

  it('should send complete chunks immediately', () => {
    const queue2 = new SampleUploadQueue('/api/upload', 2);
    jest.clearAllMocks();
    const samples = [createMockSample(), createMockSample()];
    const incomplete = queue2.enqueueForUpload(samples, false);
    // With maxSamplesPerBatch of 2, 2 samples should trigger worker call
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    expect((worker.postMessage as jest.Mock).mock.calls[0][0].samples).toHaveLength(2);
    // No incomplete samples
    expect(incomplete).toHaveLength(0);
  });

  it('should chunk samples exceeding maxSamplesPerBatch', () => {
    const samples = Array.from({ length: 1001 }, () => createMockSample());
    const incomplete = queue.enqueueForUpload(samples, false);
    // Should be called once for 1000 samples, 1 remains incomplete
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    expect((worker.postMessage as jest.Mock).mock.calls[0][0].samples).toHaveLength(1000);
    // 1 sample should be returned as incomplete
    expect(incomplete).toHaveLength(1);
  });

  it('should not enqueue empty samples', () => {
    const incomplete = queue.enqueueForUpload([]);
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(incomplete).toHaveLength(0);
  });

  it('should pass correct data to worker', () => {
    const queue2 = new SampleUploadQueue('/api/upload', 1);
    jest.clearAllMocks();
    const samples = [createMockSample()];
    const incomplete = queue2.enqueueForUpload(samples, false);
    expect(worker.postMessage).toHaveBeenCalledWith({
      samples,
      endpoint: '/api/upload',
    });
    expect(incomplete).toHaveLength(0);
  });

  it('should use custom endpoint', () => {
    const customQueue = new SampleUploadQueue('/custom/endpoint', 1);
    jest.clearAllMocks();
    const samples = [createMockSample()];
    const incomplete = customQueue.enqueueForUpload(samples, false);
    expect(worker.postMessage).toHaveBeenCalledWith({
      samples,
      endpoint: '/custom/endpoint',
    });
    expect(incomplete).toHaveLength(0);
  });

  it('should respect maxSamplesPerBatch limit', () => {
    const limitedQueue = new SampleUploadQueue('/api/upload', 5);
    jest.clearAllMocks();
    const samples = Array.from({ length: 10 }, () => createMockSample());
    const incomplete = limitedQueue.enqueueForUpload(samples, false);
    // Should be called twice for 5+5 complete chunks
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    const calls = (worker.postMessage as jest.Mock).mock.calls;
    expect(calls[0][0].samples).toHaveLength(5);
    expect(calls[1][0].samples).toHaveLength(5);
    // No incomplete samples
    expect(incomplete).toHaveLength(0);
  });

  it('should return incomplete chunks', () => {
    const limitedQueue = new SampleUploadQueue('/api/upload', 5);
    jest.clearAllMocks();
    const samples = Array.from({ length: 7 }, () => createMockSample());
    const incomplete = limitedQueue.enqueueForUpload(samples, false);
    // Should be called once for first 5 samples
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    expect((worker.postMessage as jest.Mock).mock.calls[0][0].samples).toHaveLength(5);
    // 2 samples should be returned as incomplete
    expect(incomplete).toHaveLength(2);
  });

  it('should send all samples when sentAll is true', () => {
    const limitedQueue = new SampleUploadQueue('/api/upload', 5);
    jest.clearAllMocks();
    const samples = Array.from({ length: 7 }, () => createMockSample());
    const incomplete = limitedQueue.enqueueForUpload(samples, true);
    // Should be called twice for 5+2 samples
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    const calls = (worker.postMessage as jest.Mock).mock.calls;
    expect(calls[0][0].samples).toHaveLength(5);
    expect(calls[1][0].samples).toHaveLength(2);
    // No incomplete samples when sentAll is true
    expect(incomplete).toHaveLength(0);
  });
});
