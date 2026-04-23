import { TelemetryService } from './telemetry.service';
import type { InstallIdService } from './install-id.service';
import type { PayloadBuilderService } from './payload-builder.service';
import type { TelemetryPayloadV1 } from './dto/telemetry-payload';

function makeService(overrides?: { enabled?: boolean; endpoint?: string }): {
  service: TelemetryService;
  install: { getOrCreate: jest.Mock; markSent: jest.Mock };
  payloadBuilder: { build: jest.Mock };
} {
  const install = {
    getOrCreate: jest.fn(),
    markSent: jest.fn().mockResolvedValue(undefined),
  };
  const payloadBuilder = {
    build: jest.fn<Promise<TelemetryPayloadV1>, [string, string]>(),
  };

  const service = new TelemetryService(
    install as unknown as InstallIdService,
    payloadBuilder as unknown as PayloadBuilderService,
  );
  // Override the frozen config captured at construction time
  (
    service as unknown as {
      config: { enabled: boolean; endpoint: string; manifestVersion: string };
    }
  ).config = {
    enabled: overrides?.enabled ?? true,
    endpoint: overrides?.endpoint ?? 'http://ingest.test/v1/report',
    manifestVersion: '9.9.9',
  };
  return { service, install, payloadBuilder };
}

const baseInstall = {
  id: 'singleton',
  install_id: 'inst-1',
  created_at: '2026-04-01T00:00:00',
  first_send_at: '2026-04-01T00:00:00',
  last_sent_at: null as string | null,
};

function payloadStub(overrides: Partial<TelemetryPayloadV1> = {}): TelemetryPayloadV1 {
  return {
    schema_version: 1,
    install_id: 'inst-1',
    manifest_version: '9.9.9',
    messages_total: 0,
    messages_by_provider: {},
    messages_by_tier: {},
    messages_by_auth_type: {},
    tokens_input_total: 0,
    tokens_output_total: 0,
    agents_total: 0,
    agents_by_platform: {},
    platform: 'linux',
    arch: 'x64',
    ...overrides,
  };
}

describe('TelemetryService', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('logs a short message and returns early when disabled', async () => {
      const { service, install } = makeService({ enabled: false });

      await service.onModuleInit();

      expect(install.getOrCreate).not.toHaveBeenCalled();
    });

    it('ensures the install row exists and logs the install ID when enabled', async () => {
      const { service, install } = makeService();
      install.getOrCreate.mockResolvedValue(baseInstall);

      await service.onModuleInit();

      expect(install.getOrCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('tick', () => {
    it('skips immediately when telemetry is disabled', async () => {
      const { service, install } = makeService({ enabled: false });

      await service.tick();

      expect(install.getOrCreate).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('skips when the first-send jitter window has not elapsed', async () => {
      const { service, install, payloadBuilder } = makeService();
      const future = new Date('2030-01-01T00:00:00').toISOString();
      install.getOrCreate.mockResolvedValue({ ...baseInstall, first_send_at: future });

      await service.tick(new Date('2026-04-20T00:00:00'));

      expect(payloadBuilder.build).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('skips when the last send was less than 24h ago', async () => {
      const { service, install, payloadBuilder } = makeService();
      const now = new Date('2026-04-20T12:00:00');
      const recent = new Date(now.getTime() - 1000).toISOString();
      install.getOrCreate.mockResolvedValue({
        ...baseInstall,
        first_send_at: '2026-04-01T00:00:00',
        last_sent_at: recent,
      });

      await service.tick(now);

      expect(payloadBuilder.build).not.toHaveBeenCalled();
    });

    it('sends when no previous send exists and jitter has elapsed', async () => {
      const { service, install, payloadBuilder } = makeService();
      install.getOrCreate.mockResolvedValue(baseInstall);
      payloadBuilder.build.mockResolvedValue(payloadStub());
      fetchSpy.mockResolvedValue(new Response('{}', { status: 200 }));

      await service.tick(new Date('2026-04-20T00:00:00'));

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://ingest.test/v1/report',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(install.markSent).toHaveBeenCalledTimes(1);
    });

    it('sends again when 24h have elapsed since last send', async () => {
      const { service, install, payloadBuilder } = makeService();
      const now = new Date('2026-04-20T12:00:00');
      const old = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString();
      install.getOrCreate.mockResolvedValue({
        ...baseInstall,
        first_send_at: '2026-04-01T00:00:00',
        last_sent_at: old,
      });
      payloadBuilder.build.mockResolvedValue(
        payloadStub({
          messages_total: 1,
          messages_by_provider: { anthropic: 1 },
          messages_by_tier: { simple: 1 },
          messages_by_auth_type: { api_key: 1 },
          tokens_input_total: 10,
          tokens_output_total: 5,
          agents_total: 1,
          agents_by_platform: { openclaw: 1 },
        }),
      );
      fetchSpy.mockResolvedValue(new Response('{}', { status: 200 }));

      await service.tick(now);

      expect(install.markSent).toHaveBeenCalled();
    });

    it('does not mark sent when the endpoint returns non-2xx', async () => {
      const { service, install, payloadBuilder } = makeService();
      install.getOrCreate.mockResolvedValue(baseInstall);
      payloadBuilder.build.mockResolvedValue(payloadStub());
      fetchSpy.mockResolvedValue(new Response('down', { status: 503 }));

      await service.tick(new Date('2026-04-20T00:00:00'));

      expect(install.markSent).not.toHaveBeenCalled();
    });

    it('swallows fetch errors so the cron never crashes the process', async () => {
      const { service, install, payloadBuilder } = makeService();
      install.getOrCreate.mockResolvedValue(baseInstall);
      payloadBuilder.build.mockResolvedValue(payloadStub());
      fetchSpy.mockRejectedValue(new Error('offline'));

      await expect(service.tick(new Date('2026-04-20T00:00:00'))).resolves.toBeUndefined();

      expect(install.markSent).not.toHaveBeenCalled();
    });
  });
});
