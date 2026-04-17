import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
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
});
