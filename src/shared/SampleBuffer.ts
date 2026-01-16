/**
 * SampleBuffer.ts - Per-camera sample buffering and management
 *
 * Moved from: src/components/Samples.tsx (lines 42-165)
 *
 * Provides CameraSampleBucket (per-camera grouping) and SampleBuffer (collection of buckets)
 * for managing samples in both component and worker contexts.
 *
 * Architecture:
 * - SampleBuffer: Maps bucket keys (userId|placeId|screenId|cameraId) to CameraSampleBucket
 * - CameraSampleBucket: Stores samples for one camera, handles time-window filtering
 */

import { Sample } from './Sample';

/**
 * CameraSampleBucket - Per-camera sample grouping
 *
 * Stores samples from a single camera and provides:
 * - Time-window filtering (extractByTimestamp)
 * - Size tracking and threshold checking
 * - Sample retention/cleanup (dropSamplesBeforeTime)
 */
export class CameraSampleBucket {
  private samples: Sample[] = [];

  /**
   * Add a sample to this bucket
   */
  add(sample: Sample): void {
    this.samples.push(sample);
  }

  /**
   * Get current sample count
   */
  getCount(): number {
    return this.samples.length;
  }

  /**
   * Extract samples within time range, up to maxSize
   *
   * Samples are sorted by time before extraction to ensure
   * oldest samples are sent first.
   *
   * @param minTime - Only extract samples with time >= minTime
   * @param maxTime - Only extract samples with time < maxTime
   * @param maxSize - Maximum number of samples to extract
   * @returns Object with sent (extracted) and remaining samples
   */
  extractByTimestamp(
    minTime: number,
    maxTime: number,
    maxSize: number
  ): { sent: Sample[]; remaining: Sample[] } {
    // Partition: filter by time range, sort, then reassemble
    const inRange = this.samples.filter(s => s.time >= minTime && s.time < maxTime);
    const outOfRange = this.samples.filter(s => s.time < minTime || s.time >= maxTime);

    inRange.sort((a, b) => a.time - b.time);

    // Extract up to maxSize from sorted in-range samples
    const toSend = inRange.splice(0, maxSize);
    const remaining = inRange.concat(outOfRange);

    this.samples = remaining;
    return { sent: toSend, remaining };
  }

  /**
   * Clear all samples from this bucket
   */
  clear(): void {
    this.samples = [];
  }
}

/**
 * SampleBuffer - Collection of per-camera buckets
 *
 * Manages multiple CameraSampleBucket instances organized by bucket key
 * (userId|placeId|screenId|cameraId).
 *
 * Provides:
 * - Per-camera sample organization
 * - Global size tracking across all buckets
 * - Batch operations on all buckets
 * - Individual bucket access and manipulation
 */
export class SampleBuffer {
  private buckets: Map<string, CameraSampleBucket> = new Map();
  private totalCount: number = 0;

  /**
   * Add sample to appropriate bucket
   *
   * Automatically creates bucket if it doesn't exist
   * (based on sample.bucket() key)
   */
  addSample(sample: Sample): void {
    const bucket = this.getBucketOrCreate(sample);
    bucket.add(sample);
    this.totalCount++;
  }

  /**
   * Get or create bucket for a sample
   */
  private getBucketOrCreate(sample: Sample): CameraSampleBucket {
    const key = sample.bucket();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new CameraSampleBucket();
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  /**
   * Get bucket by key
   *
   * @param key - Bucket key (userId|placeId|screenId|cameraId)
   * @returns CameraSampleBucket or null if not found
   */
  getBucket(key: string): CameraSampleBucket | null {
    return this.buckets.get(key) || null;
  }

  /**
   * Get all buckets
   */
  getAllBuckets(): CameraSampleBucket[] {
    return Array.from(this.buckets.values());
  }

  /**
   * Get total sample count across all buckets
   */
  getTotalSampleCount(): number {
    return this.totalCount;
  }

  /**
   * Get number of buckets (cameras)
   */
  getBucketCount(): number {
    return this.buckets.size;
  }

  /**
   * Clear all samples from all buckets
   */
  clear(): void {
    this.buckets.clear();
    this.totalCount = 0;
  }

  /**
   * Extract samples from specific bucket within time range
   *
   * Updates totalCount to reflect extraction.
   *
   * @param bucket - Bucket to extract from
   * @param minTime - Only extract samples with time >= minTime
   * @param maxTime - Only extract samples with time < maxTime
   * @param maxSize - Max samples to extract
   * @returns Object with sent (extracted) and remaining samples
   */
  extractFromBucket(
    bucket: CameraSampleBucket,
    minTime: number,
    maxTime: number,
    maxSize: number
  ): { sent: Sample[]; remaining: Sample[] } {
    const countBefore = bucket.getCount();
    const result = bucket.extractByTimestamp(minTime, maxTime, maxSize);
    const countAfter = bucket.getCount();
    this.totalCount -= countBefore - countAfter;
    return result;
  }

  /**
   * Manually adjust total count (for tracking after operations)
   */
  addToCount(delta: number): void {
    this.totalCount += delta;
  }
}
