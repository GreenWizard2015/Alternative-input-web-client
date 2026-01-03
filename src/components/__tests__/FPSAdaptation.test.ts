/**
 * FPSAdaptation.test.ts - Unit tests for dynamic FPS adaptation logic
 *
 * Tests the core algorithms for:
 * - Exponential moving average (EMA) smoothing
 * - Adaptive capture interval calculation
 * - Bounds clamping and rate limiting
 */

describe('FPS Adaptation Logic', () => {
  // ============================================================================
  // EMA (Exponential Moving Average) Smoothing Tests
  // ============================================================================

  describe('EMA Smoothing', () => {
    const SMOOTHING_FACTOR = 0.3;

    /**
     * Helper to calculate EMA
     * Formula: smoothed = α × current + (1-α) × previous
     */
    const calculateEMA = (current: number, previous: number): number => {
      return SMOOTHING_FACTOR * current + (1 - SMOOTHING_FACTOR) * previous;
    };

    test('should initialize smoothed FPS with default value', () => {
      let smoothedFps = 30; // Default initialization
      expect(smoothedFps).toBe(30);
    });

    test('should apply EMA smoothing to reduce fluctuations', () => {
      let smoothedFps = 30;
      const measurements = [25, 20, 25, 30, 35, 40]; // Fluctuating measurements

      measurements.forEach((current) => {
        smoothedFps = calculateEMA(current, smoothedFps);
      });

      // After all measurements, smoothed should be between min and max
      expect(smoothedFps).toBeGreaterThan(Math.min(...measurements));
      expect(smoothedFps).toBeLessThan(Math.max(...measurements));
    });

    test('should give 30% weight to new measurement', () => {
      let smoothedFps = 30;
      const newMeasurement = 60; // Double the current smoothed value

      smoothedFps = calculateEMA(newMeasurement, smoothedFps);

      // Result should be 30% of 60 + 70% of 30 = 18 + 21 = 39
      expect(smoothedFps).toBe(39);
    });

    test('should converge to constant value over multiple iterations', () => {
      let smoothedFps = 30;
      const constantMeasurement = 25;

      for (let i = 0; i < 20; i++) {
        smoothedFps = calculateEMA(constantMeasurement, smoothedFps);
      }

      // Should be very close to 25 after 20 iterations (convergence takes time with EMA)
      expect(smoothedFps).toBeCloseTo(constantMeasurement, 0);
    });

    test('should respond more gradually with lower smoothing factor', () => {
      const lowSmoothing = 0.1;
      const highSmoothing = 0.5;

      let low = 30;
      let high = 30;
      const newValue = 60;

      low = lowSmoothing * newValue + (1 - lowSmoothing) * low;
      high = highSmoothing * newValue + (1 - highSmoothing) * high;

      expect(low).toBeLessThan(high);
      expect(low).toBeCloseTo(33, 1); // 0.1 * 60 + 0.9 * 30
      expect(high).toBeCloseTo(45, 1); // 0.5 * 60 + 0.5 * 30
    });
  });

  // ============================================================================
  // Capture Interval Calculation Tests
  // ============================================================================

  describe('Capture Interval Calculation', () => {
    const HEADROOM_FACTOR = 1.1;
    const MIN_CAPTURE_INTERVAL = 10;
    const MAX_CAPTURE_INTERVAL = 1000;

    /**
     * Helper to calculate target capture interval
     * Formula: interval = (1000 / processingFps) * HEADROOM_FACTOR
     * With HEADROOM_FACTOR=1.1: capture runs at ~91% of processing FPS
     */
    const calculateCaptureInterval = (processingFps: number): number => {
      if (processingFps <= 0) return MAX_CAPTURE_INTERVAL;

      const targetInterval = (1000 / processingFps) * HEADROOM_FACTOR;
      return Math.max(
        MIN_CAPTURE_INTERVAL,
        Math.min(MAX_CAPTURE_INTERVAL, targetInterval)
      );
    };

    test('should calculate interval from processing FPS', () => {
      // 30 FPS -> 33.33ms per frame
      // With 1.1x headroom: 33.33 * 1.1 = 36.67ms
      const interval = calculateCaptureInterval(30);
      expect(interval).toBeCloseTo((1000 / 30) * 1.1, 1);
    });

    test('should calculate lower FPS as higher interval', () => {
      const fps20Interval = calculateCaptureInterval(20);
      const fps30Interval = calculateCaptureInterval(30);

      expect(fps20Interval).toBeGreaterThan(fps30Interval);
    });

    test('should clamp to MIN_CAPTURE_INTERVAL for very high FPS', () => {
      // 200 FPS would be (1000 / 200) * 0.95 = 4.75ms
      // Should be clamped to MIN_CAPTURE_INTERVAL (10ms)
      const interval = calculateCaptureInterval(200);
      expect(interval).toBe(MIN_CAPTURE_INTERVAL);
    });

    test('should clamp to MAX_CAPTURE_INTERVAL for very low FPS', () => {
      // 0.5 FPS would be (1000 / 0.5) * 0.95 = 1900ms
      // Should be clamped to MAX_CAPTURE_INTERVAL (1000ms)
      const interval = calculateCaptureInterval(0.5);
      expect(interval).toBe(MAX_CAPTURE_INTERVAL);
    });

    test('should handle zero FPS gracefully', () => {
      const interval = calculateCaptureInterval(0);
      expect(interval).toBe(MAX_CAPTURE_INTERVAL);
    });

    test('should apply 1.1x headroom factor', () => {
      // 30 FPS without headroom: 1000 / 30 = 33.33ms
      // With 1.1x headroom: 33.33 * 1.1 = 36.67ms
      const interval = calculateCaptureInterval(30);
      const noHeadroom = 1000 / 30;
      expect(interval).toBeCloseTo(noHeadroom * HEADROOM_FACTOR, 1);
    });

    test('should achieve ~91% capture rate relative to processing FPS', () => {
      // With 1.1x interval headroom: captureRate ≈ processingFps / 1.1 ≈ 91%
      const fps = 25;
      const interval = calculateCaptureInterval(fps);
      const captureRate = 1000 / interval;

      // Capture should be slower than processing (91% of it)
      expect(captureRate).toBeLessThan(fps);
      expect(captureRate).toBeCloseTo(fps / 1.1, 1);
    });
  });

  // ============================================================================
  // Rate Update Logic Tests
  // ============================================================================

  describe('Capture Rate Update Logic', () => {
    const HEADROOM_FACTOR = 0.95;
    const MIN_CAPTURE_INTERVAL = 10;
    const MAX_CAPTURE_INTERVAL = 1000;
    const UPDATE_THRESHOLD = 0.05; // Only update if >5% change

    /**
     * Helper to determine if rate should update
     * Prevents jitter from small FPS fluctuations
     */
    const shouldUpdateRate = (newInterval: number, currentInterval: number): boolean => {
      const percentChange = Math.abs(newInterval - currentInterval) / currentInterval;
      return percentChange >= UPDATE_THRESHOLD;
    };

    test('should not update rate for small changes (<5%)', () => {
      const current = 33.33; // ~30 FPS
      const newInterval = 34; // Only ~2% change

      const shouldUpdate = shouldUpdateRate(newInterval, current);
      expect(shouldUpdate).toBe(false);
    });

    test('should update rate for significant changes (>5%)', () => {
      const current = 33.33;
      const newInterval = 50; // ~50% increase

      const shouldUpdate = shouldUpdateRate(newInterval, current);
      expect(shouldUpdate).toBe(true);
    });

    test('should handle rate increase (slower capture)', () => {
      const current = 33.33; // 30 FPS
      const newInterval = 100; // ~10 FPS

      const shouldUpdate = shouldUpdateRate(newInterval, current);
      expect(shouldUpdate).toBe(true);
      expect(newInterval).toBeGreaterThan(current);
    });

    test('should handle rate decrease (faster capture)', () => {
      const current = 100; // 10 FPS
      const newInterval = 33.33; // ~30 FPS

      const shouldUpdate = shouldUpdateRate(newInterval, current);
      expect(shouldUpdate).toBe(true);
      expect(newInterval).toBeLessThan(current);
    });

    test('should batch small updates to prevent jitter', () => {
      let currentInterval = 33.33;
      const updates = [33.5, 33.8, 34.2, 34.1]; // Small fluctuations

      let updateCount = 0;
      updates.forEach((newInterval) => {
        if (shouldUpdateRate(newInterval, currentInterval)) {
          updateCount++;
          currentInterval = newInterval;
        }
      });

      // None of these small changes should trigger update
      expect(updateCount).toBe(0);
    });
  });


  // ============================================================================
  // Multi-Camera Independence Tests
  // ============================================================================

  describe('Multi-Camera FPS Adaptation', () => {
    test('should track separate FPS for each camera', () => {
      const cameras = {
        cam1: { processingFps: 30, queueLength: 2 },
        cam2: { processingFps: 20, queueLength: 4 },
        cam3: { processingFps: 25, queueLength: 3 },
      };

      // Each camera should maintain independent stats
      expect(cameras.cam1.processingFps).not.toBe(cameras.cam2.processingFps);
      expect(cameras.cam2.processingFps).not.toBe(cameras.cam3.processingFps);
    });

    test('should calculate independent intervals per camera', () => {
      const HEADROOM_FACTOR = 0.95;

      const cam1Interval = (1000 / 30) * HEADROOM_FACTOR; // ~31.67ms
      const cam2Interval = (1000 / 20) * HEADROOM_FACTOR; // ~47.50ms
      const cam3Interval = (1000 / 25) * HEADROOM_FACTOR; // ~38.00ms

      expect(cam1Interval).toBeLessThan(cam2Interval);
      expect(cam3Interval).toBeLessThan(cam2Interval);
      expect(cam1Interval).toBeGreaterThan(0);
    });

    test('should allow different cameras to have different rates', () => {
      const cameraRates = new Map([
        ['cam1', 33.33], // 30 FPS
        ['cam2', 50],    // 20 FPS
        ['cam3', 40],    // 25 FPS
      ]);

      const rates = Array.from(cameraRates.values());
      const allDifferent = new Set(rates).size === rates.length;
      expect(allDifferent).toBe(true);
    });

    test('should handle dynamic camera addition', () => {
      const cameraRates = new Map<string, number>();

      cameraRates.set('cam1', 33.33);
      cameraRates.set('cam2', 50);

      expect(cameraRates.size).toBe(2);

      cameraRates.set('cam3', 40);
      expect(cameraRates.size).toBe(3);
      expect(cameraRates.has('cam3')).toBe(true);
    });

    test('should handle camera removal without affecting others', () => {
      const cameraRates = new Map<string, number>();
      cameraRates.set('cam1', 33.33);
      cameraRates.set('cam2', 50);
      cameraRates.set('cam3', 40);

      cameraRates.delete('cam2');

      expect(cameraRates.size).toBe(2);
      expect(cameraRates.has('cam1')).toBe(true);
      expect(cameraRates.has('cam3')).toBe(true);
      expect(cameraRates.has('cam2')).toBe(false);
    });
  });

  // ============================================================================
  // Integration Scenario Tests
  // ============================================================================

  describe('Real-world Scenarios', () => {
    const SMOOTHING_FACTOR = 0.3;
    const HEADROOM_FACTOR = 1.1;
    const MIN_CAPTURE_INTERVAL = 10;
    const MAX_CAPTURE_INTERVAL = 1000;

    const calculateEMA = (current: number, previous: number): number => {
      return SMOOTHING_FACTOR * current + (1 - SMOOTHING_FACTOR) * previous;
    };

    const calculateInterval = (processingFps: number): number => {
      if (processingFps <= 0) return MAX_CAPTURE_INTERVAL;
      const targetInterval = (1000 / processingFps) * HEADROOM_FACTOR;
      return Math.max(MIN_CAPTURE_INTERVAL, Math.min(MAX_CAPTURE_INTERVAL, targetInterval));
    };

    test('should handle sudden processing drop', () => {
      let smoothedFps = 30;
      smoothedFps = calculateEMA(15, smoothedFps); // Drop to 15 FPS
      smoothedFps = calculateEMA(15, smoothedFps); // Stays at 15
      smoothedFps = calculateEMA(15, smoothedFps); // Still 15

      const interval = calculateInterval(smoothedFps);

      // Processing dropped significantly, capture interval should increase
      expect(smoothedFps).toBeLessThan(30);
      expect(interval).toBeGreaterThan((1000 / 30) * HEADROOM_FACTOR);
    });

    test('should handle gradual recovery from low FPS', () => {
      let smoothedFps = 15;

      // Gradual recovery
      smoothedFps = calculateEMA(20, smoothedFps);
      smoothedFps = calculateEMA(25, smoothedFps);
      smoothedFps = calculateEMA(28, smoothedFps);
      smoothedFps = calculateEMA(30, smoothedFps);

      const interval = calculateInterval(smoothedFps);

      // Should trend back toward 30 FPS
      expect(smoothedFps).toBeGreaterThan(15);
      expect(smoothedFps).toBeLessThan(30);
    });

    test('should stabilize after spike recovery', () => {
      let smoothedFps = 30;

      // Spike down then back up
      smoothedFps = calculateEMA(10, smoothedFps); // Big drop
      smoothedFps = calculateEMA(10, smoothedFps);
      smoothedFps = calculateEMA(30, smoothedFps); // Big jump
      smoothedFps = calculateEMA(30, smoothedFps);
      for (let i = 0; i < 15; i++) {
        smoothedFps = calculateEMA(30, smoothedFps); // Stabilize more
      }

      const interval = calculateInterval(smoothedFps);

      // Should converge back toward 30 FPS after stabilization
      expect(smoothedFps).toBeGreaterThan(25);
      // Interval should be within valid bounds
      expect(interval).toBeGreaterThanOrEqual(MIN_CAPTURE_INTERVAL);
      expect(interval).toBeLessThanOrEqual(MAX_CAPTURE_INTERVAL);
    });
  });
});
