import { worker } from './DataWorker';
import type { Sample, Position, UUIDed } from './SamplesDef';
import { Sample as SampleClass, sampleSize } from './SamplesDef';

// ============================================================================
// SampleValidation - Centralized validation logic
// ============================================================================

class SampleValidation {
  private static readonly GOAL_MIN = -2;
  private static readonly GOAL_MAX = 2;

  static getGoalValidationError(goal: Position | null | undefined): string | null {
    if (!goal) return 'Goal is missing';
    if (!(this.GOAL_MIN < goal.x && goal.x < this.GOAL_MAX)) {
      return `Invalid goal.x: ${goal.x} (must be in range [${this.GOAL_MIN}, ${this.GOAL_MAX}])`;
    }
    if (!(this.GOAL_MIN < goal.y && goal.y < this.GOAL_MAX)) {
      return `Invalid goal.y: ${goal.y} (must be in range [${this.GOAL_MIN}, ${this.GOAL_MAX}])`;
    }
    return null;
  }

  static validateGoal(goal: Position | null | undefined): boolean {
    return !this.getGoalValidationError(goal);
  }

  static validateSample(sample: Sample): { valid: boolean; error?: string } {
    const goalError = this.getGoalValidationError(sample.goal);
    return goalError ? { valid: false, error: goalError } : { valid: true };
  }

  static validateUUIDed(obj: UUIDed | null): boolean {
    return !!(obj && obj.name && obj.uuid && obj.name.length > 0 && obj.uuid.length > 0);
  }
}

// ============================================================================
// CameraSampleBucket - Per-camera sample management
// ============================================================================

class CameraSampleBucket {
  private samples: Sample[] = [];

  add(sample: Sample): void {
    this.samples.push(sample);
  }

  getSamples(): Sample[] {
    return this.samples.slice();
  }

  getCount(): number {
    return this.samples.length;
  }

  extractByTimestamp(limit: number, maxSize: number): { sent: Sample[]; remaining: Sample[] } {
    // Partition and sort in single pass: separate, sort before-limit, then reassemble
    const beforeLimit = this.samples.filter((s) => s.time < limit);
    const afterLimit = this.samples.filter((s) => s.time >= limit);

    beforeLimit.sort((a, b) => a.time - b.time);

    // Extract up to maxSize from sorted before-limit samples
    const toSend = beforeLimit.splice(0, maxSize);
    const remaining = beforeLimit.concat(afterLimit);

    this.samples = remaining;
    return { sent: toSend, remaining };
  }

  clear(): void {
    this.samples = [];
  }

  isEmpty(): boolean {
    return this.samples.length === 0;
  }

  isFull(threshold: number): boolean {
    return this.samples.length >= threshold;
  }

  dropSamplesBeforeTime(minTime: number): number {
    const beforeDropCount = this.samples.length;
    this.samples = this.samples.filter((s) => s.time >= minTime);
    return beforeDropCount - this.samples.length;
  }

  countSamplesInRange(minTime: number, maxTime: number): number {
    return this.samples.filter((s) => s.time >= minTime && s.time < maxTime).length;
  }
}

// ============================================================================
// SampleBuffer - Collection of buckets
// ============================================================================

class SampleBuffer {
  private buckets: Map<string, CameraSampleBucket> = new Map();
  private totalCount: number = 0;

  addSample(sample: Sample): void {
    const bucket = this.getBucketOrCreate(sample);
    bucket.add(sample);
    this.totalCount++;
  }

  private getBucketOrCreate(sample: Sample): CameraSampleBucket {
    const key = sample.bucket();
    if (!this.buckets.has(key)) {
      this.buckets.set(key, new CameraSampleBucket());
    }
    return this.buckets.get(key)!;
  }

  getBucket(key: string): CameraSampleBucket | null {
    return this.buckets.get(key) || null;
  }

  getAllBuckets(): CameraSampleBucket[] {
    return Array.from(this.buckets.values());
  }

  getTotalSampleCount(): number {
    return this.totalCount;
  }

  getBucketCount(): number {
    return this.buckets.size;
  }

  hasFullBuckets(threshold: number): boolean {
    for (const bucket of this.buckets.values()) {
      if (bucket.isFull(threshold)) return true;
    }
    return false;
  }

  clear(): void {
    this.buckets.clear();
    this.totalCount = 0;
  }

  getUtilization(maxSamplesPerBatch: number): number {
    const total = this.getTotalSampleCount();
    return Math.round((total / maxSamplesPerBatch) * 100);
  }

  dropSamplesBeforeTime(minTime: number): number {
    let droppedCount = 0;
    for (const bucket of this.buckets.values()) {
      droppedCount += bucket.dropSamplesBeforeTime(minTime);
    }
    this.totalCount -= droppedCount;
    return droppedCount;
  }

  extractFromBucket(bucket: CameraSampleBucket, limit: number, maxSize: number): { sent: Sample[]; remaining: Sample[] } {
    const countBefore = bucket.getCount();
    const result = bucket.extractByTimestamp(limit, maxSize);
    const countAfter = bucket.getCount();
    this.totalCount -= (countBefore - countAfter);
    return result;
  }

  addToCount(delta: number): void {
    this.totalCount += delta;
  }
}

// ============================================================================
// SampleUploadQueue - Worker communication
// ============================================================================

class SampleUploadQueue {
  private endpoint: string;
  private maxSamplesPerBatch: number;

  constructor(endpoint: string = '/api/upload', maxSamplesPerBatch: number = 1000) {
    // Convert relative URL to absolute URL for Web Worker compatibility
    // Web Workers require absolute URLs for fetch
    if (typeof window !== 'undefined') {
      this.endpoint = new URL(endpoint, window.location.origin).href;
    } else {
      this.endpoint = endpoint;
    }
    this.maxSamplesPerBatch = maxSamplesPerBatch;
  }

  enqueueForUpload(samples: Sample[], sentAll: boolean = false): Sample[] {
    if (samples.length === 0) return [];

    // Send only complete chunks, return incomplete ones
    const toSend: Sample[] = [];
    const incomplete: Sample[] = [];

    for (let i = 0; i < samples.length; i += this.maxSamplesPerBatch) {
      const chunk = samples.slice(i, i + this.maxSamplesPerBatch);
      if ((chunk.length === this.maxSamplesPerBatch) || sentAll) {
        toSend.push(...chunk);
      } else {
        incomplete.push(...chunk);
      }
    }

    if (toSend.length > 0) {
      // Send complete chunks in batches
      for (let i = 0; i < toSend.length; i += this.maxSamplesPerBatch) {
        const chunk = toSend.slice(i, i + this.maxSamplesPerBatch);
        worker.postMessage({ samples: chunk, endpoint: this.endpoint });
      }
    }

    return incomplete;
  }
}

// ============================================================================
// SampleManager - Main orchestrator
// ============================================================================

class SampleManager {
  private buffer: SampleBuffer;
  private uploadQueue: SampleUploadQueue;
  private validator = SampleValidation;
  private readonly maxChunkSize: number;
  private readonly maxSamplesPerBatch: number;
  private readonly autoFlushThreshold: number;
  private readonly uploadEndpoint: string;
  private errorHandlers: Map<string, (error: Error) => void> = new Map();

  constructor(config: { maxChunkSize?: number; uploadEndpoint?: string; autoFlushThreshold?: number } = {}) {
    this.maxChunkSize = config.maxChunkSize ?? 4 * 1024 * 1024;
    this.maxSamplesPerBatch = Math.floor(this.maxChunkSize / sampleSize());
    this.autoFlushThreshold = config.autoFlushThreshold ?? 2 * this.maxSamplesPerBatch;
    this.uploadEndpoint = config.uploadEndpoint ?? '/api/upload';
    this.buffer = new SampleBuffer();
    this.uploadQueue = new SampleUploadQueue(this.uploadEndpoint, this.maxSamplesPerBatch);
  }

  store(sample: Sample, options: { minTime: number; maxTime: number }): { success: boolean; error?: string } {
    try {
      const validation = this.validator.validateSample(sample);
      if (!validation.valid) {
        const error = new Error(validation.error!);
        this.handleError('validation', error);
        return { success: false, error: validation.error };
      }
      this.buffer.addSample(sample);
      if (this.buffer.getTotalSampleCount() >= this.autoFlushThreshold) {
        this.flush(options);
      }
      return { success: true };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      this.handleError('storage', e instanceof Error ? e : new Error(errorMsg));
      return { success: false, error: errorMsg };
    }
  }

  flush(options: { minTime: number; maxTime: number }): void {
    // Drop samples before minTime from buffer
    this.buffer.dropSamplesBeforeTime(options.minTime);

    // Process each bucket - only call worker if count in that bucket exceeds limit
    for (const bucket of this.buffer.getAllBuckets()) {
      const bucketCountInRange = bucket.countSamplesInRange(options.minTime, options.maxTime);

      // Only call worker for this bucket if its count exceeds the limit
      if (bucketCountInRange > this.maxSamplesPerBatch) {
        const { sent } = this.buffer.extractFromBucket(bucket, options.maxTime, this.maxSamplesPerBatch);
        if (sent.length > 0) {
          const sorted = sent.sort((a, b) => a.time - b.time);
          try {
            const incomplete = this.uploadQueue.enqueueForUpload(sorted);
            // Put incomplete samples back into bucket
            if (incomplete.length > 0) {
              this.buffer.addToCount(incomplete.length);
              for (const sample of incomplete) {
                bucket.add(sample);
              }
            }
          } catch (e) {
            this.handleError('upload', new Error(String(e)));
          }
        }
      }
    }
  }

  flushAndClear(options: { minTime: number; maxTime: number }): void {
    // Drop samples before minTime from buffer
    this.buffer.dropSamplesBeforeTime(options.minTime);

    // Send all chunks (complete and incomplete) to worker
    for (const bucket of this.buffer.getAllBuckets()) {
      while (true) {
        const { sent } = this.buffer.extractFromBucket(bucket, options.maxTime, this.maxSamplesPerBatch);
        if (sent.length === 0) break; // No more samples to send

        const sorted = sent.sort((a, b) => a.time - b.time);
        try {
          this.uploadQueue.enqueueForUpload(sorted, true);
        } catch (e) {
          this.handleError('upload', new Error(String(e)));
        }
      }
    }

    // Clear the buffer after sending all chunks
    this.buffer.clear();
  }

  getStats() {
    const total = this.buffer.getTotalSampleCount();
    return {
      totalSamples: total,
      bucketCount: this.buffer.getBucketCount(),
      bufferUtilization: this.buffer.getUtilization(this.maxSamplesPerBatch),
    };
  }

  clear(): void {
    this.buffer.clear();
  }

  onError(reason: string, handler: (error: Error) => void): void {
    this.errorHandlers.set(reason, handler);
  }

  private handleError(reason: string, error: Error): void {
    const handler = this.errorHandlers.get(reason);
    if (handler) handler(error);
    else console.error(`Unhandled ${reason} error:`, error.message);
  }

  getBuffer(): SampleBuffer {
    return this.buffer;
  }
}

// ============================================================================
// Public API
// ============================================================================

const sampleManager = new SampleManager();

// Helper function for filtering UUIDed objects
const validate = (obj: UUIDed | null): boolean => SampleValidation.validateUUIDed(obj);

export type { UUIDed, Position };
export {
  sampleManager,
  SampleClass as Sample,
  SampleManager,
  SampleValidation,
  CameraSampleBucket,
  SampleBuffer,
  SampleUploadQueue,
  validate
};
