import { ConfigService } from '@nestjs/config';
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

function createMockConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    'app.manifestMode': 'cloud',
    'app.nodeEnv': 'development',
    ...overrides,
  };
  return {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

describe('HealthController', () => {
  let controller: HealthController;
  let mockVersionCheck: VersionCheckService;

  beforeEach(() => {
    mockVersionCheck = createMockVersionCheck();
    controller = new HealthController(mockVersionCheck, createMockConfig());
  });

  it('returns healthy status', () => {
    const result = controller.getHealth();
    expect(result.status).toBe('healthy');
  });

  it('returns plugin version in local mode', () => {
    controller = new HealthController(
      mockVersionCheck,
      createMockConfig({ 'app.manifestMode': 'local' }),
    );
    const result = controller.getHealth();
    expect(result.version).toBe('5.20.0');
  });

  it('omits version in cloud mode', () => {
    const result = controller.getHealth();
    expect(result).not.toHaveProperty('version');
  });

  it('returns uptime in seconds', () => {
    const result = controller.getHealth();
    expect(typeof result.uptime_seconds).toBe('number');
    expect(result.uptime_seconds).toBeGreaterThanOrEqual(0);
  });

  it('returns cloud mode by default', () => {
    const result = controller.getHealth();
    expect(result.mode).toBe('cloud');
  });

  it('returns local mode when manifestMode=local', () => {
    controller = new HealthController(
      mockVersionCheck,
      createMockConfig({ 'app.manifestMode': 'local' }),
    );
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
    controller = new HealthController(mockVersionCheck, createMockConfig());
    const result = controller.getHealth();
    expect(result.latestVersion).toBe('2.0.0');
    expect(result.updateAvailable).toBe(true);
  });

  it('omits update fields when no update available', () => {
    const result = controller.getHealth();
    expect(result).not.toHaveProperty('latestVersion');
    expect(result).not.toHaveProperty('updateAvailable');
  });

  it('returns devMode true when nodeEnv is not production', () => {
    controller = new HealthController(
      mockVersionCheck,
      createMockConfig({ 'app.nodeEnv': 'development' }),
    );
    const result = controller.getHealth();
    expect(result.devMode).toBe(true);
  });

  it('returns devMode false when nodeEnv is production', () => {
    controller = new HealthController(
      mockVersionCheck,
      createMockConfig({ 'app.nodeEnv': 'production' }),
    );
    const result = controller.getHealth();
    expect(result.devMode).toBe(false);
  });

  it('returns devMode true when nodeEnv is unset', () => {
    controller = new HealthController(mockVersionCheck, createMockConfig());
    const result = controller.getHealth();
    expect(result.devMode).toBe(true);
  });
});
