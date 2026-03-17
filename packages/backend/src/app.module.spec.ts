import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';

function loadServeStaticOptions(frontendDir: string | null) {
  jest.resetModules();
  jest.doMock('./common/utils/frontend-path', () => ({
    resolveFrontendDir: () => frontendDir,
  }));
  jest.doMock('./auth/session.guard', () => ({
    SessionGuard: class SessionGuard {},
  }));
  jest.doMock('./auth/local-auth.guard', () => ({
    LocalAuthGuard: class LocalAuthGuard {},
  }));
  jest.doMock('./common/guards/api-key.guard', () => ({
    ApiKeyGuard: class ApiKeyGuard {},
  }));
  for (const [path, exportName] of [
    ['./database/database.module', 'DatabaseModule'],
    ['./auth/auth.module', 'AuthModule'],
    ['./health/health.module', 'HealthModule'],
    ['./telemetry/telemetry.module', 'TelemetryModule'],
    ['./analytics/analytics.module', 'AnalyticsModule'],
    ['./security/security.module', 'SecurityModule'],
    ['./otlp/otlp.module', 'OtlpModule'],
    ['./model-prices/model-prices.module', 'ModelPricesModule'],
    ['./notifications/notifications.module', 'NotificationsModule'],
    ['./routing/routing.module', 'RoutingModule'],
    ['./common/common.module', 'CommonModule'],
    ['./sse/sse.module', 'SseModule'],
    ['./github/github.module', 'GithubModule'],
  ] as const) {
    jest.doMock(path, () => ({
      [exportName]: class MockModule {},
    }));
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppModule } = require('./app.module') as typeof import('./app.module');
  const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) ?? [];
  const serveStaticModule = imports.find(
    (entry: { module?: { name?: string } }) => entry?.module?.name === 'ServeStaticModule',
  ) as
    | {
        providers?: Array<{ provide?: string; useValue?: unknown }>;
      }
    | undefined;

  return serveStaticModule?.providers?.find(
    (provider) => provider.provide === 'SERVE_STATIC_MODULE_OPTIONS',
  ) as
    | {
        useValue?: Array<Record<string, unknown>>;
      }
    | undefined;
}

describe('AppModule', () => {
  const originalManifestMode = process.env['MANIFEST_MODE'];

  beforeEach(() => {
    process.env['MANIFEST_MODE'] = 'local';
  });

  afterEach(() => {
    jest.resetModules();
    jest.dontMock('./common/utils/frontend-path');
  });

  afterAll(() => {
    if (originalManifestMode === undefined) {
      delete process.env['MANIFEST_MODE'];
    } else {
      process.env['MANIFEST_MODE'] = originalManifestMode;
    }
  });

  it('disables ServeStaticModule SPA catch-all and keeps static asset serving', () => {
    const optionsProvider = loadServeStaticOptions('/mock/frontend');

    expect(optionsProvider?.useValue).toEqual([
      expect.objectContaining({
        rootPath: '/mock/frontend',
        renderPath: '/__manifest_internal_static_fallback__',
        exclude: ['/api/{*path}', '/otlp/{*path}', '/v1/{*path}'],
        serveStaticOptions: expect.objectContaining({
          immutable: true,
          maxAge: 365 * 24 * 60 * 60 * 1000,
          setHeaders: expect.any(Function),
        }),
      }),
    ]);
  });

  it('omits ServeStaticModule when no frontend bundle is available', () => {
    const optionsProvider = loadServeStaticOptions(null);
    expect(optionsProvider).toBeUndefined();
  });
});
