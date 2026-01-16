/**
 * CameraFrameCaptureController.test.ts - Unit tests for CameraFrameCaptureController
 *
 * Tests interval management, update threshold, and cleanup
 * Verifies FPS control issues and fixes
 */

import {
  CameraFrameCaptureController,
  CAPTURE_INTERVAL,
  MIN_CAPTURE_INTERVAL,
  MAX_CAPTURE_INTERVAL,
} from '../CameraFrameCaptureController';

const emptyAsyncFn = async () => {
  // Intentionally empty - used for testing capture function interface
};

describe('CameraFrameCaptureController', () => {
  let setIntervalSpy: jest.SpyInstance;
  let clearIntervalSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    setIntervalSpy = jest.spyOn(global, 'setInterval');
    clearIntervalSpy = jest.spyOn(global, 'clearInterval');
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    test('should create controller instance', () => {
      const mockCapture = jest.fn(emptyAsyncFn);
      const controller = new CameraFrameCaptureController(mockCapture);

      expect(controller).toBeDefined();
      expect(controller.updateRate).toBeDefined();
      expect(controller.cleanup).toBeDefined();

      controller.cleanup();
    });

    test('should set up interval on construction', () => {
      const mockCapture = jest.fn(emptyAsyncFn);
      const controller = new CameraFrameCaptureController(mockCapture);

      expect(global.setInterval).toHaveBeenCalled();
      controller.cleanup();
    });
  });

  describe('Rate Updates', () => {
    test('should accept updateRate calls', () => {
      const mockCapture = jest.fn(emptyAsyncFn);
      const controller = new CameraFrameCaptureController(mockCapture);

      expect(() => {
        controller.updateRate(55);
      }).not.toThrow();

      controller.cleanup();
    });

    test('should handle multiple rate updates', () => {
      const mockCapture = jest.fn(emptyAsyncFn);
      const controller = new CameraFrameCaptureController(mockCapture);

      expect(() => {
        controller.updateRate(55);
        controller.updateRate(40);
        controller.updateRate(25);
      }).not.toThrow();

      controller.cleanup();
    });

    test('should handle edge case values', () => {
      const mockCapture = jest.fn(emptyAsyncFn);
      const controller = new CameraFrameCaptureController(mockCapture);

      expect(() => {
        controller.updateRate(0);
        controller.updateRate(-10);
        controller.updateRate(10000);
      }).not.toThrow();

      controller.cleanup();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup without errors', () => {
      const mockCapture = jest.fn(emptyAsyncFn);
      const controller = new CameraFrameCaptureController(mockCapture);

      expect(() => {
        controller.cleanup();
      }).not.toThrow();
    });

    test('should call clearInterval on cleanup', () => {
      const mockCapture = jest.fn(emptyAsyncFn);
      const controller = new CameraFrameCaptureController(mockCapture);

      controller.cleanup();
      expect(global.clearInterval).toHaveBeenCalled();
    });

    test('should handle multiple cleanups', () => {
      const mockCapture = jest.fn(emptyAsyncFn);
      const controller = new CameraFrameCaptureController(mockCapture);

      expect(() => {
        controller.cleanup();
        controller.cleanup();
      }).not.toThrow();
    });
  });

  describe('ISSUE: updateRate() not actually updating interval', () => {
    test('CRITICAL: should update interval when updateRate() is called with significant change', () => {
      const mockCapture = jest.fn(emptyAsyncFn);
      const controller = new CameraFrameCaptureController(mockCapture);

      // setInterval called once in constructor
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), CAPTURE_INTERVAL);

      // Reset spies to track new calls
      setIntervalSpy.mockClear();
      clearIntervalSpy.mockClear();

      // Update with 50ms (17% change from 33.33ms) - should trigger update
      controller.updateRate(50);

      // CRITICAL: Both clearInterval and setInterval should be called
      expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 50);

      controller.cleanup();
    });

    test('should NOT update if change is less than 5% threshold', () => {
      const mockCapture = jest.fn(emptyAsyncFn);
      const controller = new CameraFrameCaptureController(mockCapture);

      setIntervalSpy.mockClear();
      clearIntervalSpy.mockClear();

      // Update with 33.5ms (0.15% change, below 5% threshold)
      controller.updateRate(33.5);

      // Should NOT update
      expect(clearIntervalSpy).not.toHaveBeenCalled();
      expect(setIntervalSpy).not.toHaveBeenCalled();

      controller.cleanup();
    });

    test('should clamp to MIN_CAPTURE_INTERVAL when requested interval is too small', () => {
      const mockCapture = jest.fn(emptyAsyncFn);
      const controller = new CameraFrameCaptureController(mockCapture);

      setIntervalSpy.mockClear();
      clearIntervalSpy.mockClear();

      // Request 5ms (faster than MIN = 10ms)
      controller.updateRate(5);

      // Should clamp to 10ms and update
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), MIN_CAPTURE_INTERVAL);

      controller.cleanup();
    });

    test('should clamp to MAX_CAPTURE_INTERVAL when requested interval is too large', () => {
      const mockCapture = jest.fn(emptyAsyncFn);
      const controller = new CameraFrameCaptureController(mockCapture);

      setIntervalSpy.mockClear();
      clearIntervalSpy.mockClear();

      // Request 200ms (slower than MAX = 66.67ms)
      controller.updateRate(200);

      // Should clamp to 66.67ms and update
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), MAX_CAPTURE_INTERVAL);

      controller.cleanup();
    });

    test('should handle negative intervals gracefully', () => {
      const mockCapture = jest.fn(emptyAsyncFn);
      const controller = new CameraFrameCaptureController(mockCapture);

      setIntervalSpy.mockClear();
      clearIntervalSpy.mockClear();

      // updateRate with negative should return early
      controller.updateRate(-50);

      // Should NOT call setInterval
      expect(setIntervalSpy).not.toHaveBeenCalled();

      controller.cleanup();
    });

    test('should create new interval each time updateRate causes actual update', () => {
      const mockCapture = jest.fn(emptyAsyncFn);
      const controller = new CameraFrameCaptureController(mockCapture);

      setIntervalSpy.mockClear();
      clearIntervalSpy.mockClear();

      // Call updateRate 3 times with significant changes (>5%)
      controller.updateRate(50); // First update
      controller.updateRate(60); // Second update
      controller.updateRate(40); // Third update

      // Should have cleared 3 times and set 3 times
      expect(clearIntervalSpy).toHaveBeenCalledTimes(3);
      expect(setIntervalSpy).toHaveBeenCalledTimes(3);

      controller.cleanup();
    });

    test('should verify 5% threshold calculation', () => {
      const mockCapture = jest.fn(emptyAsyncFn);
      const controller = new CameraFrameCaptureController(mockCapture);

      setIntervalSpy.mockClear();
      clearIntervalSpy.mockClear();

      // Start at 33.33ms
      // 5% of 33.33 = 1.665
      // So 33.33 + 1.665 = 34.995 should NOT update
      // 33.33 + 1.7 = 35.03 should UPDATE

      controller.updateRate(34.99); // Just below 5%
      expect(setIntervalSpy).not.toHaveBeenCalled();

      controller.updateRate(35.05); // Just above 5%
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);

      controller.cleanup();
    });
  });

  describe('Realistic Scenarios', () => {
    test('should handle adaptive FPS changes', () => {
      const mockCapture = jest.fn(emptyAsyncFn);
      const controller = new CameraFrameCaptureController(mockCapture);

      expect(() => {
        controller.updateRate(55);
        controller.updateRate(73.33);
        controller.updateRate(44);
      }).not.toThrow();

      controller.cleanup();
    });

    test('should handle rapid fluctuations', () => {
      const mockCapture = jest.fn(emptyAsyncFn);
      const controller = new CameraFrameCaptureController(mockCapture);

      expect(() => {
        const smallFluctuations = [34, 33.5, 34.2, 33.8, 34.1];
        for (const interval of smallFluctuations) {
          controller.updateRate(interval);
        }
      }).not.toThrow();

      controller.cleanup();
    });

    test('should handle continuous performance monitoring', () => {
      const mockCapture = jest.fn(emptyAsyncFn);
      const controller = new CameraFrameCaptureController(mockCapture);

      expect(() => {
        const fpsMeasurements = [30, 28, 25, 22, 20, 22, 25, 28, 30];
        for (const fps of fpsMeasurements) {
          const interval = (1000 / fps) * 1.1;
          controller.updateRate(interval);
        }
      }).not.toThrow();

      controller.cleanup();
    });
  });
});
