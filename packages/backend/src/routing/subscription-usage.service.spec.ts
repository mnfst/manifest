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
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    service = new SubscriptionUsageService(
      providerRepo as never,
      agentRepo as never,
      openaiOauth as never,
      anthropicOauth as never,
      geminiOauth as never,
    );
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('normalizes Codex, Claude, and Gemini subscription limit windows', async () => {
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
    ]);

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('chatgpt.com')) {
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
      if (url.includes('api.anthropic.com')) {
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
      if (url.includes('cloudcode-pa.googleapis.com')) {
        expect(JSON.parse((init?.body as string) ?? '{}')).toEqual({ project: 'project-123' });
        return jsonResponse({
          buckets: [
            { modelId: 'gemini-2.5-pro', remainingFraction: 0.42, resetTime: RESET },
            { modelId: 'gemini-2.5-pro', remainingFraction: 0.9, resetTime: RESET },
            { modelId: 'gemini-2.5-flash', remainingFraction: 0.8, resetTime: RESET },
          ],
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const result = await service.getUsage(TENANT_ID);

    expect(result.map((summary) => summary.provider)).toEqual(['anthropic', 'gemini', 'openai']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
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
        expect.objectContaining({ id: 'claude-5h', used_percent: 33, resets_at: RESET }),
        expect.objectContaining({ id: 'claude-weekly', used_percent: 44, resets_at: RESET }),
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
      }),
      expect.objectContaining({
        id: 'gemini-gemini-2.5-pro',
        label: 'Gemini 2.5 Pro',
        used_percent: 58,
        remaining_percent: 42,
        resets_at: RESET,
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

  it('does not query repositories when no tenant is scoped', async () => {
    await expect(service.getUsage(null)).resolves.toEqual([]);

    expect(providerRepo.find).not.toHaveBeenCalled();
    expect(agentRepo.findOne).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
