jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue(JSON.stringify({ version: '1.2.3' })),
}));

import { HealthController } from './health.controller';
import { VersionCheckService } from './version-check.service';

function createMockVersionCheck(overrides: Partial<VersionCheckService> = {}): VersionCheckService {
  return {
    onModuleInit: jest.fn(),
    getCurrentVersion: jest.fn().mockReturnValue('1.2.3'),
    getUpdateInfo: jest.fn().mockReturnValue({}),
    isNewer: jest.fn().mockReturnValue(false),
    fetchLatestVersion: jest.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as VersionCheckService;
}

describe('HealthController', () => {
  let controller: HealthController;
  let mockVersionCheck: VersionCheckService;

  beforeEach(() => {
    mockVersionCheck = createMockVersionCheck();
    controller = new HealthController(mockVersionCheck);
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

  it('includes update info when available', () => {
    mockVersionCheck = createMockVersionCheck({
      getUpdateInfo: jest.fn().mockReturnValue({
        latestVersion: '2.0.0',
        updateAvailable: true,
      }),
    });
    controller = new HealthController(mockVersionCheck);
    const result = controller.getHealth();
    expect(result.latestVersion).toBe('2.0.0');
    expect(result.updateAvailable).toBe(true);
  });

  it('omits update fields when no update available', () => {
    const result = controller.getHealth();
    expect(result).not.toHaveProperty('latestVersion');
    expect(result).not.toHaveProperty('updateAvailable');
  });
});
