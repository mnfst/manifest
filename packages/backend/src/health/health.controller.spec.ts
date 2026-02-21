jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue(JSON.stringify({ version: '1.2.3' })),
}));

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

  it('returns version from package.json', () => {
    const result = controller.getHealth();
    expect(result.version).toBe('1.2.3');
  });

  it('returns uptime in seconds', () => {
    const result = controller.getHealth();
    expect(typeof result.uptime_seconds).toBe('number');
    expect(result.uptime_seconds).toBeGreaterThanOrEqual(0);
  });

  it('returns cloud mode by default', () => {
    delete process.env['MANIFEST_MODE'];
    const result = controller.getHealth();
    expect(result.mode).toBe('cloud');
  });

  it('returns local mode when MANIFEST_MODE=local', () => {
    const orig = process.env['MANIFEST_MODE'];
    process.env['MANIFEST_MODE'] = 'local';
    const result = controller.getHealth();
    expect(result.mode).toBe('local');
    process.env['MANIFEST_MODE'] = orig;
  });
});
