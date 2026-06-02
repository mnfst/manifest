import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns healthy status', () => {
    const result = controller.getHealth();
    expect(result.status).toBe('healthy');
  });

  it('returns uptime in seconds', () => {
    const result = controller.getHealth();
    expect(typeof result.uptime_seconds).toBe('number');
    expect(result.uptime_seconds).toBeGreaterThanOrEqual(0);
  });

  it('does not expose mode or devMode fields', () => {
    const result = controller.getHealth();
    expect(result).not.toHaveProperty('mode');
    expect(result).not.toHaveProperty('devMode');
    expect(result).not.toHaveProperty('version');
  });

  describe('uptime calculation', () => {
    it('returns 0 uptime on the first call immediately after construction', () => {
      // Pin Date.now() to a fixed point before construction so the constructor
      // and the first getHealth() call see the same timestamp.
      const fixedNow = 1_700_000_000_000;
      jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

      const freshController = new HealthController();
      const result = freshController.getHealth();

      expect(result.uptime_seconds).toBe(0);
    });

    it('returns uptime that increases with each call as wall-clock time advances', () => {
      // Construct at t=0, then advance the mocked clock for each subsequent call.
      const constructionTime = 1_700_000_000_000;
      const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(constructionTime);

      const freshController = new HealthController();

      dateNowSpy.mockReturnValue(constructionTime + 5_000);
      const firstCall = freshController.getHealth();
      expect(firstCall.uptime_seconds).toBe(5);

      dateNowSpy.mockReturnValue(constructionTime + 12_500);
      const secondCall = freshController.getHealth();
      expect(secondCall.uptime_seconds).toBe(12);

      expect(secondCall.uptime_seconds).toBeGreaterThan(firstCall.uptime_seconds);
    });

    it('reflects the correct wall-clock delta using Math.floor (sub-second deltas truncate to 0)', () => {
      const constructionTime = 1_700_000_000_000;
      const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(constructionTime);

      const freshController = new HealthController();

      // 999ms after construction is still less than 1s — floor to 0.
      dateNowSpy.mockReturnValue(constructionTime + 999);
      expect(freshController.getHealth().uptime_seconds).toBe(0);

      // Exactly 1s elapsed.
      dateNowSpy.mockReturnValue(constructionTime + 1_000);
      expect(freshController.getHealth().uptime_seconds).toBe(1);

      // Exactly 1 hour elapsed.
      dateNowSpy.mockReturnValue(constructionTime + 3_600_000);
      expect(freshController.getHealth().uptime_seconds).toBe(3_600);
    });

    it('handles a clock that jumps backward without throwing', () => {
      // Construct at a later time, then simulate the system clock jumping
      // backward (NTP correction, VM resume, manual change). The getter must
      // not throw — uptime_seconds will be negative, which documents the
      // current behavior and pins it against silent regression.
      const constructionTime = 1_700_000_000_000;
      const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(constructionTime);

      const freshController = new HealthController();

      // Clock jumps backward by 10s.
      dateNowSpy.mockReturnValue(constructionTime - 10_000);

      expect(() => freshController.getHealth()).not.toThrow();
      const result = freshController.getHealth();
      expect(typeof result.uptime_seconds).toBe('number');
      expect(Number.isFinite(result.uptime_seconds)).toBe(true);
      expect(result.uptime_seconds).toBe(-10);
      expect(result.status).toBe('healthy');
    });

    it('returns 0 when the clock has not advanced since construction', () => {
      const constructionTime = 1_700_000_000_000;
      const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(constructionTime);

      const freshController = new HealthController();

      // Clock has not advanced at all between construction and call.
      dateNowSpy.mockReturnValue(constructionTime);
      expect(freshController.getHealth().uptime_seconds).toBe(0);
    });
  });
});
