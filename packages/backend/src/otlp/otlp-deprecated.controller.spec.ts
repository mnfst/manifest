import { Test, TestingModule } from '@nestjs/testing';
import { OtlpDeprecatedController } from './otlp-deprecated.controller';

describe('OtlpDeprecatedController', () => {
  let controller: OtlpDeprecatedController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OtlpDeprecatedController],
    }).compile();
    controller = module.get(OtlpDeprecatedController);
  });

  const expectedResponse = {
    error: {
      message:
        'OTLP telemetry endpoints have been removed. ' +
        'Use the routing proxy at /v1/chat/completions instead. ' +
        'See https://manifest.build/docs/migration for details.',
      type: 'gone',
      status: 410,
    },
  };

  describe('traces', () => {
    it('returns HTTP 410 Gone with migration message', () => {
      const result = controller.traces();
      expect(result).toEqual(expectedResponse);
    });

    it('includes the routing proxy path in the error message', () => {
      const result = controller.traces();
      expect(result.error.message).toContain('/v1/chat/completions');
    });

    it('includes the migration docs URL', () => {
      const result = controller.traces();
      expect(result.error.message).toContain('https://manifest.build/docs/migration');
    });
  });

  describe('metrics', () => {
    it('returns HTTP 410 Gone with full error shape', () => {
      const result = controller.metrics();
      expect(result).toEqual(expectedResponse);
    });

    it('has error type "gone"', () => {
      const result = controller.metrics();
      expect(result.error.type).toBe('gone');
    });
  });

  describe('logs', () => {
    it('returns HTTP 410 Gone with full error shape', () => {
      const result = controller.logs();
      expect(result).toEqual(expectedResponse);
    });

    it('has error type "gone"', () => {
      const result = controller.logs();
      expect(result.error.type).toBe('gone');
    });
  });

  it('all three endpoints return the exact same response object', () => {
    const traces = controller.traces();
    const metrics = controller.metrics();
    const logs = controller.logs();
    expect(traces).toBe(metrics);
    expect(metrics).toBe(logs);
  });
});
