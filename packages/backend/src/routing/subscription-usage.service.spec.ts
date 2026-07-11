const originalManifestEncryptionKey = process.env['MANIFEST_ENCRYPTION_KEY'];
process.env['MANIFEST_ENCRYPTION_KEY'] = 'm'.repeat(64);

import { encrypt, getEncryptionSecret } from '../common/utils/crypto.util';
import type { Agent } from '../entities/agent.entity';
import type { TenantProvider } from '../entities/tenant-provider.entity';
import { SubscriptionUsageService } from './subscription-usage.service';

type ProviderRepoMock = {
  find: jest.Mock<Promise<TenantProvider[]>, [unknown]>;
};

type AgentRepoMock = {
  findOne: jest.Mock<Promise<Agent | null>, [unknown]>;
};

type OauthMock = {
  unwrapToken: jest.Mock<Promise<string | null>, [string, string, string, string?]>;
};

type ServiceInternals = {
  fetchJson<T>(url: string, init: RequestInit): Promise<T>;
  fetchBytes(url: string, init: RequestInit): Promise<Uint8Array>;
  errorMessage(error: unknown): string;
  grokPeriodFromSeconds(seconds: number): {
    id: string;
    label: string;
    windowSeconds: number;
  } | null;
  parseGrokWebBilling(data: Uint8Array): { usedPercent: number; resetsAt: string | null };
  grpcWebDataFrames(data: Uint8Array): Uint8Array[] | null;
  grpcWebTrailerFields(data: Uint8Array): Record<string, string>;
  validateGrpcStatusFields(fields: Record<string, string>): void;
  throwGrpcStatus(status: string, message: string): never;
  looksLikeProtobufPayload(data: Uint8Array): boolean;
  scanProtobuf(
    data: Uint8Array,
    depth: number,
  ): {
    fixed32Fields: Array<{ path: number[]; value: number; order: number }>;
    varintFields: Array<{ path: number[]; value: number }>;
    order: number;
  };
};

const TENANT_ID = 'tenant-1';
const NOW = '2026-07-01T12:00:00.000Z';
const RESET = '2026-07-01T18:00:00.000Z';
const RESET_EPOCH_SECONDS = Date.parse(RESET) / 1000;
const originalFetch = global.fetch;

const encrypted = (raw: string) => encrypt(raw, getEncryptionSecret());

const oauthBlob = (token: string, resource?: string) =>
  JSON.stringify({
    t: token,
    r: `${token}-refresh`,
    e: Date.now() + 60 * 60 * 1000,
    ...(resource ? { u: resource } : {}),
  });

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const binaryResponse = (body: Uint8Array, status = 200) =>
  new Response(Buffer.from(body), {
    status,
    headers: { 'content-type': 'application/grpc-web+proto' },
  });

const varint = (value: number): number[] => {
  let remaining = value;
  const bytes: number[] = [];
  do {
    let byte = remaining & 0x7f;
    remaining = Math.floor(remaining / 128);
    if (remaining !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (remaining !== 0);
  return bytes;
};

const protobufPayload = (usedPercent: number, resetEpoch: number): Uint8Array => {
  const percent = Buffer.alloc(4);
  percent.writeFloatLE(usedPercent, 0);
  return Uint8Array.from([0x0d, ...percent, 0x10, ...varint(resetEpoch)]);
};

const grpcFrame = (payload: Uint8Array, flags = 0): Uint8Array => {
  const frame = new Uint8Array(5 + payload.length);
  frame[0] = flags;
  frame[1] = (payload.length >>> 24) & 0xff;
  frame[2] = (payload.length >>> 16) & 0xff;
  frame[3] = (payload.length >>> 8) & 0xff;
  frame[4] = payload.length & 0xff;
  frame.set(payload, 5);
  return frame;
};

const makeProvider = (overrides: Partial<TenantProvider>): TenantProvider =>
  ({
    id: 'provider-1',
    tenant_id: TENANT_ID,
    created_by_user_id: null,
    agent_id: null,
    provider: 'openai',
    api_key_encrypted: encrypted(oauthBlob('stored-access')),
    key_prefix: null,
    auth_type: 'subscription',
    label: 'Default',
    priority: 0,
    region: null,
    is_active: true,
    connected_at: NOW,
    updated_at: NOW,
    cached_models: null,
    models_fetched_at: null,
    ...overrides,
  }) as TenantProvider;

describe('SubscriptionUsageService', () => {
  let providerRepo: ProviderRepoMock;
  let agentRepo: AgentRepoMock;
  let openaiOauth: OauthMock;
  let anthropicOauth: OauthMock;
  let geminiOauth: OauthMock;
  let xaiOauth: OauthMock;
  let fetchMock: jest.Mock<Promise<Response>, [RequestInfo | URL, RequestInit?]>;
  let service: SubscriptionUsageService;

  beforeEach(() => {
    providerRepo = { find: jest.fn() };
    agentRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'agent-1', tenant_id: TENANT_ID } as Agent),
    };
    openaiOauth = { unwrapToken: jest.fn().mockResolvedValue('openai-access') };
    anthropicOauth = { unwrapToken: jest.fn().mockResolvedValue('anthropic-access') };
    geminiOauth = { unwrapToken: jest.fn().mockResolvedValue('gemini-access') };
    xaiOauth = { unwrapToken: jest.fn().mockResolvedValue('xai-access') };
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    service = new SubscriptionUsageService(
      providerRepo as never,
      agentRepo as never,
      openaiOauth as never,
      anthropicOauth as never,
      geminiOauth as never,
      xaiOauth as never,
    );
  });

  afterAll(() => {
    global.fetch = originalFetch;
    if (originalManifestEncryptionKey === undefined) {
      delete process.env['MANIFEST_ENCRYPTION_KEY'];
    } else {
      process.env['MANIFEST_ENCRYPTION_KEY'] = originalManifestEncryptionKey;
    }
  });

  it('normalizes Codex, Claude, Gemini, and Grok subscription limit windows', async () => {
    const xaiResetEpoch = Math.floor((Date.now() + 6 * 24 * 60 * 60 * 1000) / 1000);
    const xaiResetIso = new Date(xaiResetEpoch * 1000).toISOString();

    providerRepo.find.mockResolvedValue([
      makeProvider({
        id: 'openai-1',
        provider: 'openai',
        label: 'Codex',
        priority: 3,
        api_key_encrypted: encrypted(oauthBlob('stored-openai')),
      }),
      makeProvider({
        id: 'anthropic-1',
        provider: 'anthropic',
        label: 'Claude',
        priority: 1,
        api_key_encrypted: encrypted(oauthBlob('stored-anthropic')),
      }),
      makeProvider({
        id: 'gemini-1',
        provider: 'gemini',
        label: 'Gemini',
        priority: 2,
        api_key_encrypted: encrypted(oauthBlob('stored-gemini', 'project-123')),
      }),
      makeProvider({
        id: 'xai-1',
        provider: 'xai',
        label: 'Grok',
        priority: 4,
        api_key_encrypted: encrypted(oauthBlob('stored-xai')),
      }),
    ]);

    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname === 'chatgpt.com') {
        expect((init?.headers as Record<string, string>).Authorization).toBe(
          'Bearer openai-access',
        );
        return jsonResponse({
          rate_limit: {
            primary_window: {
              used_percent: 20,
              reset_at: RESET_EPOCH_SECONDS,
              limit_window_seconds: 18_000,
            },
            secondary_window: {
              used_percent: 55,
              reset_at: RESET_EPOCH_SECONDS,
              limit_window_seconds: 604_800,
            },
            individual_limit: { used: 12, limit: 50, remaining_percent: 76 },
          },
          credits: { balance: 9 },
          additional_rate_limits: [
            {
              limit_name: 'codex_spark',
              rate_limit: {
                primary_window: { used_percent: 80, reset_at: RESET_EPOCH_SECONDS },
              },
            },
          ],
        });
      }
      if (url.hostname === 'api.anthropic.com') {
        expect((init?.headers as Record<string, string>)['anthropic-beta']).toBe(
          'oauth-2025-04-20',
        );
        return jsonResponse({
          five_hour: { utilization: 33, resets_at: RESET },
          seven_day: { utilization: 44, resets_at: RESET },
          seven_day_sonnet: { utilization: '66', resets_at: RESET },
          extra_usage: { used_credits: 5, monthly_limit: 20, utilization: 25, currency: 'USD' },
        });
      }
      if (url.hostname === 'cloudcode-pa.googleapis.com') {
        expect(JSON.parse((init?.body as string) ?? '{}')).toEqual({ project: 'project-123' });
        return jsonResponse({
          buckets: [
            { modelId: 'gemini-2.5-pro', remainingFraction: 0.42, resetTime: RESET },
            { modelId: 'gemini-2.5-pro', remainingFraction: 0.9, resetTime: RESET },
            { modelId: 'gemini-2.5-flash', remainingFraction: 0.8, resetTime: RESET },
          ],
        });
      }
      if (url.hostname === 'grok.com') {
        const headers = init?.headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer xai-access');
        expect(headers['Content-Type']).toBe('application/grpc-web+proto');
        expect(init?.method).toBe('POST');
        return binaryResponse(grpcFrame(protobufPayload(42.5, xaiResetEpoch)));
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const result = await service.getUsage(TENANT_ID);

    expect(result.map((summary) => summary.provider)).toEqual([
      'anthropic',
      'gemini',
      'openai',
      'xai',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(openaiOauth.unwrapToken).toHaveBeenCalledWith(
      expect.any(String),
      'agent-1',
      TENANT_ID,
      'Codex',
    );
    expect(anthropicOauth.unwrapToken).toHaveBeenCalledWith(
      expect.any(String),
      'agent-1',
      TENANT_ID,
      'Claude',
    );
    expect(geminiOauth.unwrapToken).toHaveBeenCalledWith(
      expect.any(String),
      'agent-1',
      TENANT_ID,
      'Gemini',
    );
    expect(xaiOauth.unwrapToken).toHaveBeenCalledWith(
      expect.any(String),
      'agent-1',
      TENANT_ID,
      'Grok',
    );

    const openai = result.find((summary) => summary.provider === 'openai');
    expect(openai?.status).toBe('ok');
    expect(openai?.connections[0].windows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'codex-5h',
          label: 'Codex 5h',
          used_percent: 20,
          remaining_percent: 80,
          resets_at: RESET,
          window_seconds: 18_000,
        }),
        expect.objectContaining({
          id: 'codex-monthly',
          current: 12,
          limit: 50,
          unit: 'credits',
          remaining_percent: 76,
        }),
        expect.objectContaining({ id: 'codex-credits', current: 9, unit: 'credits' }),
        expect.objectContaining({ id: 'codex-extra-0-primary', label: 'Spark 5h' }),
      ]),
    );

    const anthropic = result.find((summary) => summary.provider === 'anthropic');
    expect(anthropic?.connections[0].windows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'claude-5h',
          used_percent: 33,
          resets_at: RESET,
          window_seconds: 18_000,
        }),
        expect.objectContaining({
          id: 'claude-weekly',
          used_percent: 44,
          resets_at: RESET,
          window_seconds: 604_800,
        }),
        expect.objectContaining({ id: 'claude-sonnet-weekly', used_percent: 66 }),
        expect.objectContaining({
          id: 'claude-extra-usage',
          current: 5,
          limit: 20,
          unit: 'USD',
        }),
      ]),
    );

    const gemini = result.find((summary) => summary.provider === 'gemini');
    expect(gemini?.connections[0].windows).toEqual([
      expect.objectContaining({
        id: 'gemini-gemini-2.5-flash',
        label: 'Gemini 2.5 Flash',
        used_percent: 20,
        remaining_percent: 80,
        resets_at: RESET,
        window_seconds: 86_400,
      }),
      expect.objectContaining({
        id: 'gemini-gemini-2.5-pro',
        label: 'Gemini 2.5 Pro',
        used_percent: 58,
        remaining_percent: 42,
        resets_at: RESET,
        window_seconds: 86_400,
      }),
    ]);

    const xai = result.find((summary) => summary.provider === 'xai');
    expect(xai?.connections[0].windows).toEqual([
      expect.objectContaining({
        id: 'grok-weekly',
        label: 'Grok weekly',
        used_percent: 42.5,
        remaining_percent: 57.5,
        resets_at: xaiResetIso,
        window_seconds: 604_800,
        unit: 'credits',
      }),
    ]);
  });

  it('combines multiple installed connections and marks partial results', async () => {
    providerRepo.find.mockResolvedValue([
      makeProvider({
        id: 'openai-active',
        provider: 'openai',
        label: 'Primary',
        priority: 1,
        api_key_encrypted: encrypted(oauthBlob('primary')),
      }),
      makeProvider({
        id: 'openai-inactive',
        provider: 'openai',
        label: 'Secondary',
        priority: 2,
        is_active: false,
        api_key_encrypted: encrypted(oauthBlob('secondary')),
      }),
    ]);
    fetchMock.mockResolvedValue(
      jsonResponse({
        rate_limit: { primary_window: { used_percent: 10, reset_at: RESET_EPOCH_SECONDS } },
      }),
    );

    const result = await service.getUsage(TENANT_ID);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        provider: 'openai',
        status: 'partial',
      }),
    );
    expect(result[0].connections).toEqual([
      expect.objectContaining({ id: 'openai-active', label: 'Primary', status: 'ok' }),
      expect.objectContaining({
        id: 'openai-inactive',
        label: 'Secondary',
        status: 'unavailable',
        message: 'Connection is inactive',
        windows: [],
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(openaiOauth.unwrapToken).toHaveBeenCalledTimes(1);
  });

  it('does not treat a trailer-only Grok response as protobuf usage', async () => {
    providerRepo.find.mockResolvedValue([
      makeProvider({
        id: 'xai-1',
        provider: 'xai',
        label: 'Grok',
        api_key_encrypted: encrypted(oauthBlob('stored-xai')),
      }),
    ]);
    fetchMock.mockResolvedValue(binaryResponse(grpcFrame(Buffer.from('grpc-status: 0\r\n'), 0x80)));

    const result = await service.getUsage(TENANT_ID);

    expect(result[0]?.connections[0]).toEqual(
      expect.objectContaining({
        status: 'error',
        message: 'Usage lookup failed',
        windows: [],
      }),
    );
  });

  it('reports missing, unreadable, and refreshless credentials as unavailable', async () => {
    providerRepo.find.mockResolvedValue([
      makeProvider({ id: 'missing', label: 'Missing', api_key_encrypted: null }),
      makeProvider({ id: 'invalid', label: 'Invalid', api_key_encrypted: 'not-ciphertext' }),
      makeProvider({ id: 'refreshless', label: 'Refreshless' }),
    ]);
    openaiOauth.unwrapToken.mockResolvedValue(null);

    const result = await service.getUsage(TENANT_ID);
    const connections = result[0]?.connections ?? [];

    expect(connections.find((connection) => connection.id === 'missing')).toEqual(
      expect.objectContaining({ message: 'Credential is unavailable', status: 'unavailable' }),
    );
    expect(connections.find((connection) => connection.id === 'invalid')).toEqual(
      expect.objectContaining({ message: 'Credential is unavailable', status: 'unavailable' }),
    );
    expect(connections.find((connection) => connection.id === 'refreshless')).toEqual(
      expect.objectContaining({
        message: 'Sign in again to refresh usage limits',
        status: 'unavailable',
      }),
    );
  });

  it('uses stored OAuth credentials when no fallback agent exists', async () => {
    agentRepo.findOne.mockResolvedValue(null);
    providerRepo.find.mockResolvedValue([
      makeProvider({
        id: 'openai-stored',
        label: 'Stored OpenAI',
        api_key_encrypted: encrypted(oauthBlob('stored-openai')),
      }),
      makeProvider({
        id: 'openai-expired',
        label: 'Expired OpenAI',
        api_key_encrypted: encrypted(
          JSON.stringify({ t: 'expired', r: 'refresh', e: Date.now() - 1_000 }),
        ),
      }),
      makeProvider({
        id: 'anthropic-raw',
        provider: 'anthropic',
        label: 'Raw Anthropic',
        api_key_encrypted: encrypted('raw-anthropic-token'),
      }),
    ]);
    fetchMock.mockImplementation(async (input) => {
      const hostname = new URL(String(input)).hostname;
      if (hostname === 'chatgpt.com' || hostname === 'api.anthropic.com') return jsonResponse({});
      throw new Error(`Unexpected URL ${String(input)}`);
    });

    const result = await service.getUsage(TENANT_ID);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(openaiOauth.unwrapToken).not.toHaveBeenCalled();
    expect(anthropicOauth.unwrapToken).not.toHaveBeenCalled();
    expect(
      result
        .find((summary) => summary.provider === 'openai')
        ?.connections.find((connection) => connection.id === 'openai-expired'),
    ).toEqual(
      expect.objectContaining({
        message: 'Sign in again to refresh usage limits',
        status: 'unavailable',
      }),
    );
  });

  it('normalizes JSON and binary transport failures', async () => {
    const internals = service as unknown as ServiceInternals;
    const capture = async (promise: Promise<unknown>): Promise<unknown> => {
      try {
        await promise;
        return null;
      } catch (error) {
        return error;
      }
    };

    fetchMock.mockResolvedValueOnce(new Response('unauthorized', { status: 401 }));
    const authError = await capture(internals.fetchJson('https://example.test', {}));
    expect(internals.errorMessage(authError)).toBe('Sign in again to refresh usage limits');

    fetchMock.mockResolvedValueOnce(new Response('slow down', { status: 429 }));
    const rateError = await capture(internals.fetchJson('https://example.test', {}));
    expect(internals.errorMessage(rateError)).toBe('Provider rate-limited the usage lookup');

    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    fetchMock.mockRejectedValueOnce(abortError);
    const timeoutError = await capture(internals.fetchJson('https://example.test', {}));
    expect(internals.errorMessage(timeoutError)).toBe('Usage lookup timed out');

    const networkError = new Error('network down');
    fetchMock.mockRejectedValueOnce(networkError);
    await expect(internals.fetchJson('https://example.test', {})).rejects.toBe(networkError);
    expect(internals.errorMessage(networkError)).toBe('Usage lookup failed');

    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array(), {
        headers: { 'grpc-status': '16', 'grpc-message': 'expired' },
      }),
    );
    await expect(internals.fetchBytes('https://example.test', {})).rejects.toMatchObject({
      status: 401,
    });

    fetchMock.mockResolvedValueOnce(new Response('bad gateway', { status: 502 }));
    await expect(internals.fetchBytes('https://example.test', {})).rejects.toMatchObject({
      status: 502,
    });

    fetchMock.mockRejectedValueOnce(abortError);
    await expect(internals.fetchBytes('https://example.test', {})).rejects.toMatchObject({
      status: 408,
    });

    fetchMock.mockRejectedValueOnce(networkError);
    await expect(internals.fetchBytes('https://example.test', {})).rejects.toBe(networkError);
  });

  it('validates Grok periods, frames, trailers, and raw protobuf payloads', () => {
    const internals = service as unknown as ServiceInternals;
    const futureReset = Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1_000) / 1_000);

    expect(internals.grokPeriodFromSeconds(30 * 86_400)).toEqual({
      id: 'monthly',
      label: 'monthly',
      windowSeconds: 2_592_000,
    });
    expect(internals.grokPeriodFromSeconds(2 * 86_400)).toBeNull();
    expect(internals.parseGrokWebBilling(protobufPayload(25, futureReset))).toEqual({
      usedPercent: 25,
      resetsAt: new Date(futureReset * 1_000).toISOString(),
    });
    expect(() =>
      internals.parseGrokWebBilling(Uint8Array.from([0x10, ...varint(futureReset)])),
    ).toThrow('Could not parse Grok web billing usage');

    expect(internals.grpcWebDataFrames(new Uint8Array())).toBeNull();
    expect(internals.grpcWebDataFrames(Uint8Array.from([0]))).toBeNull();
    expect(internals.grpcWebDataFrames(Uint8Array.from([0x02, 0, 0, 0, 0]))).toBeNull();
    expect(internals.grpcWebDataFrames(Uint8Array.from([0, 0, 0, 0, 2, 1]))).toBeNull();

    const trailer = grpcFrame(
      Buffer.from('ignored\r\ngrpc-status: 7\r\ngrpc-message: bad%ZZ\r\n'),
      0x80,
    );
    const fields = internals.grpcWebTrailerFields(trailer);
    expect(fields).toEqual({ 'grpc-status': '7', 'grpc-message': 'bad%ZZ' });
    expect(() => internals.validateGrpcStatusFields({})).not.toThrow();
    expect(() => internals.validateGrpcStatusFields({ 'grpc-status': '0' })).not.toThrow();
    expect(() => internals.validateGrpcStatusFields(fields)).toThrow('gRPC 7: bad%ZZ');
    expect(() => internals.throwGrpcStatus('4', 'deadline')).toThrow('gRPC 4: deadline');
    expect(() => internals.throwGrpcStatus('2', 'unknown')).toThrow('gRPC 2: unknown');

    expect(internals.looksLikeProtobufPayload(new Uint8Array())).toBe(false);
    expect(internals.looksLikeProtobufPayload(Uint8Array.from([0]))).toBe(false);
    expect(internals.looksLikeProtobufPayload(Uint8Array.from([0x0d]))).toBe(true);
  });

  it('recovers from malformed protobuf fields while retaining valid nested data', () => {
    const internals = service as unknown as ServiceInternals;
    const nestedPercent = protobufPayload(12.5, RESET_EPOCH_SECONDS).slice(0, 5);
    const nested = Uint8Array.from([0x0a, nestedPercent.length, ...nestedPercent]);

    expect(internals.scanProtobuf(nested, 0).fixed32Fields[0]).toEqual(
      expect.objectContaining({ path: [1, 1], value: 12.5 }),
    );
    expect(internals.scanProtobuf(Uint8Array.from([0]), 0).fixed32Fields).toEqual([]);
    expect(internals.scanProtobuf(Uint8Array.from([0x08, 0x80]), 0).varintFields).toEqual([]);
    expect(internals.scanProtobuf(Uint8Array.from([0x09]), 0).fixed32Fields).toEqual([]);
    expect(
      internals.scanProtobuf(Uint8Array.from([0x09, 0, 0, 0, 0, 0, 0, 0, 0]), 0).fixed32Fields,
    ).toEqual([]);
    expect(internals.scanProtobuf(Uint8Array.from([0x0a, 0x05, 0x01]), 0).fixed32Fields).toEqual(
      [],
    );
    expect(internals.scanProtobuf(Uint8Array.from([0x0d, 0]), 0).fixed32Fields).toEqual([]);
    expect(internals.scanProtobuf(Uint8Array.from([0x0b]), 0).fixed32Fields).toEqual([]);
  });

  it('does not query repositories when no tenant is scoped', async () => {
    await expect(service.getUsage(null)).resolves.toEqual([]);

    expect(providerRepo.find).not.toHaveBeenCalled();
    expect(agentRepo.findOne).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
