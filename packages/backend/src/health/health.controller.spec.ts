import { HealthController } from './health.controller';
import { VersionCheckService } from './version-check.service';

function createMockVersionCheck(overrides: Partial<VersionCheckService> = {}): VersionCheckService {
  return {
    onModuleInit: jest.fn(),
    getCurrentVersion: jest.fn().mockReturnValue('5.20.0'),
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
    delete process.env['MANIFEST_MODE'];
    delete process.env['NODE_ENV'];
    mockVersionCheck = createMockVersionCheck();
    controller = new HealthController(mockVersionCheck);
  });

  it('returns healthy status', () => {
    const result = controller.getHealth();
    expect(result.status).toBe('healthy');
  });

  it('returns plugin version in local mode', () => {
    process.env['MANIFEST_MODE'] = 'local';
    const result = controller.getHealth();
    expect(result.version).toBe('5.20.0');
  });

  it('omits version in cloud mode', () => {
    delete process.env['MANIFEST_MODE'];
    const result = controller.getHealth();
    expect(result).not.toHaveProperty('version');
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
    process.env['MANIFEST_MODE'] = 'local';
    const result = controller.getHealth();
    expect(result.mode).toBe('local');
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

  it('returns devMode true when NODE_ENV is not production', () => {
    process.env['NODE_ENV'] = 'development';
    const result = controller.getHealth();
    expect(result.devMode).toBe(true);
  });

  it('returns devMode false when NODE_ENV is production', () => {
    process.env['NODE_ENV'] = 'production';
    const result = controller.getHealth();
    expect(result.devMode).toBe(false);
  });

  it('returns devMode true when NODE_ENV is unset', () => {
    delete process.env['NODE_ENV'];
    const result = controller.getHealth();
    expect(result.devMode).toBe(true);
  });
});
