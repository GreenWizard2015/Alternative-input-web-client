/**
 * CameraFrameCaptureController.test.ts - Unit tests for CameraFrameCaptureController
 *
 * Tests interval management, update threshold, and cleanup
 */

import { CameraFrameCaptureController } from '../CameraFrameCaptureController';

describe('CameraFrameCaptureController', () => {
  beforeEach(() => {
    jest.spyOn(global, 'setInterval');
    jest.spyOn(global, 'clearInterval');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    test('should create controller instance', () => {
      const mockCapture = jest.fn(async () => {});
      const controller = new CameraFrameCaptureController(mockCapture);

      expect(controller).toBeDefined();
      expect(controller.updateRate).toBeDefined();
      expect(controller.cleanup).toBeDefined();

      controller.cleanup();
    });

    test('should set up interval on construction', () => {
      const mockCapture = jest.fn(async () => {});
      const controller = new CameraFrameCaptureController(mockCapture);

      expect(global.setInterval).toHaveBeenCalled();
      controller.cleanup();
    });
  });

  describe('Rate Updates', () => {
    test('should accept updateRate calls', () => {
      const mockCapture = jest.fn(async () => {});
      const controller = new CameraFrameCaptureController(mockCapture);

      expect(() => {
        controller.updateRate(55);
      }).not.toThrow();

      controller.cleanup();
    });

    test('should handle multiple rate updates', () => {
      const mockCapture = jest.fn(async () => {});
      const controller = new CameraFrameCaptureController(mockCapture);

      expect(() => {
        controller.updateRate(55);
        controller.updateRate(40);
        controller.updateRate(25);
      }).not.toThrow();

      controller.cleanup();
    });

    test('should handle edge case values', () => {
      const mockCapture = jest.fn(async () => {});
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
      const mockCapture = jest.fn(async () => {});
      const controller = new CameraFrameCaptureController(mockCapture);

      expect(() => {
        controller.cleanup();
      }).not.toThrow();
    });

    test('should call clearInterval on cleanup', () => {
      const mockCapture = jest.fn(async () => {});
      const controller = new CameraFrameCaptureController(mockCapture);

      controller.cleanup();
      expect(global.clearInterval).toHaveBeenCalled();
    });

    test('should handle multiple cleanups', () => {
      const mockCapture = jest.fn(async () => {});
      const controller = new CameraFrameCaptureController(mockCapture);

      expect(() => {
        controller.cleanup();
        controller.cleanup();
      }).not.toThrow();
    });
  });

  describe('Realistic Scenarios', () => {
    test('should handle adaptive FPS changes', () => {
      const mockCapture = jest.fn(async () => {});
      const controller = new CameraFrameCaptureController(mockCapture);

      expect(() => {
        controller.updateRate(55);
        controller.updateRate(73.33);
        controller.updateRate(44);
      }).not.toThrow();

      controller.cleanup();
    });

    test('should handle rapid fluctuations', () => {
      const mockCapture = jest.fn(async () => {});
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
      const mockCapture = jest.fn(async () => {});
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
