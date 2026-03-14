import { ConfigService } from '@nestjs/config';
import { ManifestRuntimeService } from './manifest-runtime.service';

describe('ManifestRuntimeService', () => {
  it('defaults to cloud mode', () => {
    const config = {
      get: jest
        .fn()
        .mockImplementation((key: string, defaultValue?: unknown) =>
          key === 'app.manifestMode' ? defaultValue : undefined,
        ),
    } as unknown as ConfigService;

    const service = new ManifestRuntimeService(config);

    expect(service.getMode()).toBe('cloud');
    expect(service.isLocalMode()).toBe(false);
  });

  it('reports local mode when configured', () => {
    const config = {
      get: jest
        .fn()
        .mockImplementation((key: string, defaultValue?: unknown) =>
          key === 'app.manifestMode' ? 'local' : defaultValue,
        ),
    } as unknown as ConfigService;

    const service = new ManifestRuntimeService(config);

    expect(service.getMode()).toBe('local');
    expect(service.isLocalMode()).toBe(true);
  });

  it('returns configured auth base URL when present', () => {
    const config = {
      get: jest
        .fn()
        .mockImplementation((key: string, defaultValue?: unknown) =>
          key === 'app.betterAuthUrl' ? 'https://auth.example.com' : defaultValue,
        ),
    } as unknown as ConfigService;

    const service = new ManifestRuntimeService(config);

    expect(service.getAuthBaseUrl()).toBe('https://auth.example.com');
  });

  it('falls back to localhost auth base URL using app.port', () => {
    const config = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'app.betterAuthUrl') return '';
        if (key === 'app.port') return 4010;
        return defaultValue;
      }),
    } as unknown as ConfigService;

    const service = new ManifestRuntimeService(config);

    expect(service.getAuthBaseUrl()).toBe('http://localhost:4010');
  });
});
