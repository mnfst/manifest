import { ConfigService } from '@nestjs/config';
import { VersionCheckService } from './version-check.service';

function createMockConfig(): ConfigService {
  return { get: (key: string, fallback?: string) => process.env[key] ?? fallback } as unknown as ConfigService;
}

describe('VersionCheckService', () => {
  let service: VersionCheckService;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    service = new VersionCheckService(createMockConfig());
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    delete process.env['MANIFEST_PACKAGE_VERSION'];
    delete process.env['MANIFEST_MODE'];
    delete process.env['MANIFEST_TELEMETRY_OPTOUT'];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getCurrentVersion', () => {
    it('returns MANIFEST_PACKAGE_VERSION when set', () => {
      process.env['MANIFEST_PACKAGE_VERSION'] = '2.3.4';
      expect(service.getCurrentVersion()).toBe('2.3.4');
    });

    it('returns 0.0.0 when env var is not set', () => {
      expect(service.getCurrentVersion()).toBe('0.0.0');
    });
  });

  describe('isNewer', () => {
    it('detects major version bump', () => {
      expect(service.isNewer('2.0.0', '1.9.9')).toBe(true);
    });

    it('detects minor version bump', () => {
      expect(service.isNewer('1.2.0', '1.1.9')).toBe(true);
    });

    it('detects patch version bump', () => {
      expect(service.isNewer('1.0.2', '1.0.1')).toBe(true);
    });

    it('returns false when versions are equal', () => {
      expect(service.isNewer('1.0.0', '1.0.0')).toBe(false);
    });

    it('returns false when current is newer', () => {
      expect(service.isNewer('1.0.0', '2.0.0')).toBe(false);
    });
  });

  describe('getUpdateInfo', () => {
    it('returns empty object when no cached version', () => {
      expect(service.getUpdateInfo()).toEqual({});
    });

    it('returns update info when newer version is cached', async () => {
      process.env['MANIFEST_PACKAGE_VERSION'] = '1.0.0';
      process.env['MANIFEST_MODE'] = 'local';
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '2.0.0' }),
      });

      await service.fetchLatestVersion();
      const info = service.getUpdateInfo();
      expect(info).toEqual({ latestVersion: '2.0.0', updateAvailable: true });
    });

    it('returns empty object when current version matches latest', async () => {
      process.env['MANIFEST_PACKAGE_VERSION'] = '2.0.0';
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '2.0.0' }),
      });

      await service.fetchLatestVersion();
      expect(service.getUpdateInfo()).toEqual({});
    });
  });

  describe('fetchLatestVersion', () => {
    it('fetches from npm registry', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '3.0.0' }),
      });

      const result = await service.fetchLatestVersion();
      expect(result).toBe('3.0.0');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://registry.npmjs.org/manifest/latest',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it('returns null on non-ok response', async () => {
      mockFetch.mockResolvedValue({ ok: false });
      const result = await service.fetchLatestVersion();
      expect(result).toBeNull();
    });

    it('returns null on invalid version format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: 'not-a-version' }),
      });
      const result = await service.fetchLatestVersion();
      expect(result).toBeNull();
    });

    it('returns null on fetch error', async () => {
      mockFetch.mockRejectedValue(new Error('network error'));
      const result = await service.fetchLatestVersion();
      expect(result).toBeNull();
    });

    it('uses cached value within TTL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '3.0.0' }),
      });

      await service.fetchLatestVersion();
      await service.fetchLatestVersion();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('onModuleInit', () => {
    it('does not fetch when not in local mode', async () => {
      process.env['MANIFEST_MODE'] = 'cloud';
      await service.onModuleInit();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not fetch when telemetry is opted out', async () => {
      process.env['MANIFEST_MODE'] = 'local';
      process.env['MANIFEST_TELEMETRY_OPTOUT'] = '1';
      await service.onModuleInit();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetches when in local mode and not opted out', async () => {
      process.env['MANIFEST_MODE'] = 'local';
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '5.0.0' }),
      });

      await service.onModuleInit();
      // Give the non-blocking fetch time to complete
      await new Promise((r) => setTimeout(r, 50));
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
