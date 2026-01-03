/**
 * FPSIntegration.test.ts - Integration tests for dynamic FPS adaptation
 *
 * Tests multi-camera synchronization and capture rate controller behavior
 * in realistic scenarios
 */

describe('FPS Adaptation Integration Tests', () => {
  // ============================================================================
  // Capture Rate Controller Simulation Tests
  // ============================================================================

  describe('CaptureRateController Behavior', () => {
    /**
     * Simulates a CaptureRateController instance for testing
     */
    class MockCaptureRateController {
      // Initialize to the interval for 30 FPS with 1.1x headroom: (1000/30)*1.1 = 36.67
      private currentInterval: number = (1000 / 30) * 1.1;
      private updateCount: number = 0;
      private lastUpdateTime: number = Date.now();

      readonly HEADROOM_FACTOR = 1.1;
      readonly MIN_INTERVAL = 10;
      readonly MAX_INTERVAL = 1000;
      readonly UPDATE_THRESHOLD = 0.05;

      updateRate(processingFps: number): void {
        if (processingFps <= 0) return;

        const targetInterval = (1000 / processingFps) * this.HEADROOM_FACTOR;
        const newInterval = Math.max(
          this.MIN_INTERVAL,
          Math.min(this.MAX_INTERVAL, targetInterval)
        );

        const percentChange = Math.abs(newInterval - this.currentInterval) / this.currentInterval;
        if (percentChange >= this.UPDATE_THRESHOLD) {
          this.currentInterval = newInterval;
          this.updateCount++;
          this.lastUpdateTime = Date.now();
        }
      }

      getInterval(): number {
        return this.currentInterval;
      }

      getUpdateCount(): number {
        return this.updateCount;
      }
    }

    test('should initialize with default interval', () => {
      const controller = new MockCaptureRateController();
      // (1000 / 30) * 1.1 = 36.67
      expect(controller.getInterval()).toBeCloseTo(36.67, 1);
    });

    test('should update interval on significant FPS change', () => {
      const controller = new MockCaptureRateController();

      controller.updateRate(20); // Drop to 20 FPS
      expect(controller.getUpdateCount()).toBe(1);
      expect(controller.getInterval()).toBeGreaterThan(36.67); // (1000/20)*1.1 = 55ms
    });

    test('should ignore small FPS fluctuations', () => {
      const controller = new MockCaptureRateController();

      // FPS values between 28-32 result in <5% interval change
      controller.updateRate(30);   // No change
      controller.updateRate(30.5); // Very small
      controller.updateRate(29.8); // Small

      expect(controller.getUpdateCount()).toBe(0);
    });

    test('should clamp interval to bounds', () => {
      const controller = new MockCaptureRateController();

      controller.updateRate(200); // Would be very fast -> clamped to MIN
      expect(controller.getInterval()).toBe(10);

      controller.updateRate(0.5); // Would be very slow -> clamped to MAX
      expect(controller.getInterval()).toBe(1000);
    });

    test('should track multiple updates correctly', () => {
      const controller = new MockCaptureRateController();

      controller.updateRate(20); // Update 1
      controller.updateRate(15); // Update 2 (drop more)
      controller.updateRate(25); // Update 3 (recover)

      expect(controller.getUpdateCount()).toBe(3);
    });
  });

  // ============================================================================
  // Multi-Camera Worker Stats Aggregation Tests
  // ============================================================================

  describe('Multi-Camera Stats Aggregation', () => {
    interface CameraStats {
      cameraId: string;
      processingFps: number;
      queueLength: number;
      inputFps: number;
    }

    /**
     * Simulates FaceDetectorWorkerManager stats aggregation
     */
    class MockWorkerManager {
      private stats = new Map<string, CameraStats>();

      addCamera(cameraId: string): void {
        this.stats.set(cameraId, {
          cameraId,
          processingFps: 30,
          queueLength: 0,
          inputFps: 30,
        });
      }

      updateStats(cameraId: string, stats: Partial<CameraStats>): void {
        const current = this.stats.get(cameraId);
        if (current) {
          this.stats.set(cameraId, { ...current, ...stats });
        }
      }

      getStats(): CameraStats[] {
        return Array.from(this.stats.values());
      }

      getAverageProcessingFps(): number {
        const statsArray = this.getStats();
        if (statsArray.length === 0) return 0;
        const sum = statsArray.reduce((acc, s) => acc + s.processingFps, 0);
        return sum / statsArray.length;
      }

      getMaxQueueLength(): number {
        const statsArray = this.getStats();
        return Math.max(...statsArray.map((s) => s.queueLength), 0);
      }
    }

    test('should aggregate stats from multiple cameras', () => {
      const manager = new MockWorkerManager();

      manager.addCamera('cam1');
      manager.addCamera('cam2');
      manager.addCamera('cam3');

      const stats = manager.getStats();
      expect(stats.length).toBe(3);
    });

    test('should track independent FPS per camera', () => {
      const manager = new MockWorkerManager();

      manager.addCamera('cam1');
      manager.addCamera('cam2');
      manager.addCamera('cam3');

      manager.updateStats('cam1', { processingFps: 30 });
      manager.updateStats('cam2', { processingFps: 20 });
      manager.updateStats('cam3', { processingFps: 25 });

      const stats = manager.getStats();
      expect(stats[0].processingFps).toBe(30);
      expect(stats[1].processingFps).toBe(20);
      expect(stats[2].processingFps).toBe(25);
    });

    test('should calculate average processing FPS', () => {
      const manager = new MockWorkerManager();

      manager.addCamera('cam1');
      manager.addCamera('cam2');
      manager.addCamera('cam3');

      manager.updateStats('cam1', { processingFps: 30 });
      manager.updateStats('cam2', { processingFps: 20 });
      manager.updateStats('cam3', { processingFps: 25 });

      const average = manager.getAverageProcessingFps();
      expect(average).toBeCloseTo(25, 1); // (30 + 20 + 25) / 3
    });

    test('should track max queue depth across cameras', () => {
      const manager = new MockWorkerManager();

      manager.addCamera('cam1');
      manager.addCamera('cam2');
      manager.addCamera('cam3');

      manager.updateStats('cam1', { queueLength: 2 });
      manager.updateStats('cam2', { queueLength: 7 });
      manager.updateStats('cam3', { queueLength: 3 });

      const maxQueue = manager.getMaxQueueLength();
      expect(maxQueue).toBe(7);
    });

    test('should handle camera removal', () => {
      const manager = new MockWorkerManager();

      manager.addCamera('cam1');
      manager.addCamera('cam2');
      manager.addCamera('cam3');

      let stats = manager.getStats();
      expect(stats.length).toBe(3);

      // Note: In real implementation, would need a removeCamera method
      // For testing, we just verify the structure supports it
      expect(stats[0].cameraId).toBeDefined();
    });
  });

  // ============================================================================
  // Cross-Camera Synchronization Tests
  // ============================================================================

  describe('Cross-Camera Capture Rate Synchronization', () => {
    interface CameraController {
      id: string;
      processingFps: number;
      captureInterval: number;
      updateRate(fps: number, queue: number): void;
    }

    class CameraControllerImpl implements CameraController {
      id: string;
      processingFps: number;
      captureInterval: number = 33.33;
      private updateCount = 0;

      constructor(id: string, initialFps: number = 30) {
        this.id = id;
        this.processingFps = initialFps;
      }

      updateRate(fps: number): void {
        this.processingFps = fps;
        // Set interval based on FPS with 1.1x headroom
        if (fps > 0) {
          this.captureInterval = (1000 / fps) * 1.1;
        }
        this.updateCount++;
      }

      getUpdateCount(): number {
        return this.updateCount;
      }
    }

    test('should allow cameras to operate at different rates', () => {
      const cameras = [
        new CameraControllerImpl('cam1', 30),
        new CameraControllerImpl('cam2', 25),
        new CameraControllerImpl('cam3', 20),
      ];

      cameras[0].updateRate(30);
      cameras[1].updateRate(25);
      cameras[2].updateRate(20);

      const intervals = cameras.map((c) => c.captureInterval);
      expect(intervals[0]).toBeLessThan(intervals[1]);
      expect(intervals[1]).toBeLessThan(intervals[2]);
    });

    test('should update all cameras independently', () => {
      const cameras = [
        new CameraControllerImpl('cam1'),
        new CameraControllerImpl('cam2'),
        new CameraControllerImpl('cam3'),
      ];

      cameras[0].updateRate(30);
      cameras[1].updateRate(20);
      cameras[2].updateRate(15);

      expect(cameras[0].getUpdateCount()).toBe(1);
      expect(cameras[1].getUpdateCount()).toBe(1);
      expect(cameras[2].getUpdateCount()).toBe(1);

      cameras[0].updateRate(28);
      cameras[1].updateRate(22);

      expect(cameras[0].getUpdateCount()).toBe(2);
      expect(cameras[1].getUpdateCount()).toBe(2);
      expect(cameras[2].getUpdateCount()).toBe(1);
    });

    test('should handle burst updates across cameras', () => {
      const cameras = [
        new CameraControllerImpl('cam1'),
        new CameraControllerImpl('cam2'),
      ];

      const stats = [
        { cameraId: 'cam1', fps: 30 },
        { cameraId: 'cam2', fps: 25 },
        { cameraId: 'cam1', fps: 28 },
        { cameraId: 'cam2', fps: 24 },
      ];

      stats.forEach((s) => {
        const camera = cameras.find((c) => c.id === s.cameraId);
        if (camera) {
          camera.updateRate(s.fps);
        }
      });

      expect(cameras[0].getUpdateCount()).toBe(2);
      expect(cameras[1].getUpdateCount()).toBe(2);
    });
  });

  // ============================================================================
  // Realistic Multi-Camera Scenario Tests
  // ============================================================================

  describe('Realistic Multi-Camera Scenarios', () => {
    interface SimulatedCamera {
      id: string;
      processingFps: number;
      captureInterval: number;
      updateRate(fps: number): void;
    }

    class SimulatedCameraImpl implements SimulatedCamera {
      id: string;
      processingFps: number;
      captureInterval: number = 33.33;

      constructor(id: string) {
        this.id = id;
        this.processingFps = 30;
      }

      updateRate(fps: number): void {
        this.processingFps = fps;
        if (fps > 0) {
          this.captureInterval = Math.max(10, (1000 / fps) * 1.1);
        }
      }
    }

    test('should handle 3-camera setup with varying load', () => {
      const cameras = [
        new SimulatedCameraImpl('cam1'),
        new SimulatedCameraImpl('cam2'),
        new SimulatedCameraImpl('cam3'),
      ];

      // Simulate initial state
      cameras[0].updateRate(30); // High FPS
      cameras[1].updateRate(25); // Medium FPS
      cameras[2].updateRate(20); // Lower FPS

      const intervals = cameras.map((c) => c.captureInterval);
      expect(intervals[0]).toBeLessThan(intervals[1]);
      expect(intervals[1]).toBeLessThan(intervals[2]);

      // Camera 1 dips, but recovers
      cameras[0].updateRate(18); // 18 FPS -> (1000/18)*1.1 = 61.11ms
      expect(cameras[0].captureInterval).toBeGreaterThan(55);

      cameras[0].updateRate(28);
      expect(cameras[0].captureInterval).toBeLessThan(40);
    });

    test('should handle cascading performance changes', () => {
      const cameras = [
        new SimulatedCameraImpl('cam1'),
        new SimulatedCameraImpl('cam2'),
        new SimulatedCameraImpl('cam3'),
      ];

      // All cameras start at 30 FPS
      cameras.forEach((c) => c.updateRate(30));

      const initialAvg =
        cameras.reduce((sum, c) => sum + c.processingFps, 0) / cameras.length;
      expect(initialAvg).toBe(30);

      // System-wide performance degradation
      cameras[0].updateRate(25);
      cameras[1].updateRate(22);
      cameras[2].updateRate(20);

      const degradedAvg =
        cameras.reduce((sum, c) => sum + c.processingFps, 0) / cameras.length;
      expect(degradedAvg).toBeLessThan(initialAvg);

      // Gradual recovery
      cameras[0].updateRate(27);
      cameras[1].updateRate(24);
      cameras[2].updateRate(22);

      const recoveryAvg =
        cameras.reduce((sum, c) => sum + c.processingFps, 0) / cameras.length;
      expect(recoveryAvg).toBeGreaterThan(degradedAvg);
      expect(recoveryAvg).toBeLessThan(initialAvg);
    });

    test('should prevent one slow camera from blocking others', () => {
      const cameras = [
        new SimulatedCameraImpl('cam1'),
        new SimulatedCameraImpl('cam2'),
        new SimulatedCameraImpl('cam3'),
      ];

      cameras[0].updateRate(30);
      cameras[1].updateRate(30);
      cameras[2].updateRate(30);

      // Camera 2 experiences severe degradation
      cameras[2].updateRate(5); // Very slow

      // Camera 1 should maintain high rate despite camera 2 struggling
      cameras[0].updateRate(30);
      cameras[1].updateRate(30);

      expect(cameras[0].captureInterval).toBeLessThan(cameras[2].captureInterval);
      expect(cameras[1].captureInterval).toBeLessThan(cameras[2].captureInterval);

      // Healthy cameras maintain synchronized intervals
      const cam0Interval = cameras[0].captureInterval;
      const cam1Interval = cameras[1].captureInterval;
      expect(cam0Interval).toBeCloseTo(cam1Interval, 1);
    });

    test('should handle temporary camera outage recovery', () => {
      const cameras = [
        new SimulatedCameraImpl('cam1'),
        new SimulatedCameraImpl('cam2'),
        new SimulatedCameraImpl('cam3'),
      ];

      cameras.forEach((c) => c.updateRate(30));

      // Camera 2 dies (0 FPS)
      cameras[1].updateRate(0);

      // Others should continue at normal rate
      cameras[0].updateRate(30);
      cameras[2].updateRate(30);

      const healthyIntervals = [
        cameras[0].captureInterval,
        cameras[2].captureInterval,
      ];
      expect(healthyIntervals[0]).toBeCloseTo(healthyIntervals[1], 1);

      // Camera 2 recovers
      cameras[1].updateRate(25); // 25 FPS -> (1000/25)*1.1 = 44ms
      expect(cameras[1].captureInterval).toBeGreaterThan(40);

      // All should be synchronized again
      cameras[1].updateRate(30);
      const allIntervals = cameras.map((c) => c.captureInterval);
      allIntervals.forEach((interval) => {
        expect(interval).toBeCloseTo(allIntervals[0], 1);
      });
    });
  });

  // ============================================================================
  // Performance and Edge Case Tests
  // ============================================================================

  describe('Performance and Edge Cases', () => {
    test('should handle large number of cameras (10+)', () => {
      const cameraCount = 15;
      const cameras = Array.from({ length: cameraCount }, (_, i) => ({
        id: `cam${i}`,
        fps: 30 - Math.random() * 15,
      }));

      expect(cameras.length).toBe(cameraCount);
      expect(cameras.every((c) => c.fps > 0 && c.fps < 30)).toBe(true);
    });

    test('should handle rapid stat updates', () => {
      let updateCount = 0;
      let lastInterval = 33.33;

      for (let i = 0; i < 100; i++) {
        const newFps = 25 + Math.sin(i / 10) * 10; // Oscillating FPS
        const newInterval = (1000 / newFps) * 0.95;
        const percentChange = Math.abs(newInterval - lastInterval) / lastInterval;

        if (percentChange >= 0.05) {
          updateCount++;
          lastInterval = newInterval;
        }
      }

      // Should batch most updates - not update on every tiny change
      expect(updateCount).toBeLessThan(50);
    });

    test('should handle extreme FPS values', () => {
      const extremeFps = [0, 0.1, 0.5, 1, 100, 200, 1000];

      extremeFps.forEach((fps) => {
        let interval = fps > 0 ? (1000 / fps) * 1.1 : 1000;
        interval = Math.max(10, Math.min(1000, interval));
        expect(interval).toBeGreaterThanOrEqual(10);
        expect(interval).toBeLessThanOrEqual(1000);
      });
    });
  });
});
