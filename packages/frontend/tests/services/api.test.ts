import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAgents,
  getOverview,
  getTokens,
  getCosts,
  getMessages,
  getSecurity,
  getHealth,
  getAgentKey,
  rotateAgentKey,
  createAgent,
  renameAgent,
  deleteAgent,
  getModelPrices,
  getProviders,
  connectProvider,
  deactivateAllProviders,
  disconnectProvider,
  getOpenaiOAuthUrl,
  pollMinimaxOAuth,
  revokeOpenaiOAuth,
  startMinimaxOAuth,
  getTierAssignments,
  overrideTier,
  resetTier,
  resetAllTiers,
  getAvailableModels,
  getNotificationRules,
  createNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
  getEmailProvider,
  setEmailProvider,
  removeEmailProvider,
  testEmailProvider,
  testSavedEmailProvider,
  getNotificationEmailForProvider,
  saveNotificationEmailForProvider,
  getEmailConfig,
  saveEmailConfig,
  testEmailConfig,
  clearEmailConfig,
  getNotificationEmail,
  saveNotificationEmail,
  getCustomProviders,
  createCustomProvider,
  updateCustomProvider,
  deleteCustomProvider,
  getRoutingStatus,
  getFallbacks,
  setFallbacks,
  clearFallbacks,
} from '../../src/services/api.js';

vi.mock('../../src/services/toast-store.js', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('location', { origin: 'http://localhost:3000' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Mock a successful response for fetchJson (returns .json()) */
function mockOk(body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

/** Mock a failed response for fetchJson (returns .text()) */
function mockError(status: number, statusText: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText,
    text: () => Promise.resolve(''),
  });
}

/** Mock a successful response for fetchMutate (returns .text()) */
function mockMutateOk(body?: unknown) {
  const text = body !== undefined ? JSON.stringify(body) : '';
  mockFetch.mockResolvedValueOnce({
    ok: true,
    text: () => Promise.resolve(text),
  });
}

/** Mock a failed response for fetchMutate (returns .json() for parseErrorMessage) */
function mockMutateError(status: number, message: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve({ message }),
  });
}

describe('getAgents', () => {
  it('fetches /api/v1/agents', async () => {
    const payload = { agents: [{ agent_name: 'bot1' }] };
    mockOk(payload);

    const result = await getAgents();
    expect(result).toEqual(payload);
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api/v1/agents', {
      credentials: 'include',
      cache: 'no-store',
    });
  });
});

describe('getOverview', () => {
  it('includes range and agent_name params', async () => {
    mockOk({ summary: {} });

    await getOverview('7d', 'my-agent');
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('range=7d');
    expect(url).toContain('agent_name=my-agent');
  });

  it('defaults range to 24h', async () => {
    mockOk({ summary: {} });

    await getOverview();
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('range=24h');
  });

  it('omits agent_name when not provided', async () => {
    mockOk({ summary: {} });

    await getOverview('24h');
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).not.toContain('agent_name');
  });
});

describe('getTokens', () => {
  it('sends range and agent_name', async () => {
    mockOk([]);

    await getTokens('6h', 'agent-x');
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('range=6h');
    expect(url).toContain('agent_name=agent-x');
  });
});

describe('getCosts', () => {
  it('sends range and agent_name', async () => {
    mockOk([]);

    await getCosts('30d', 'agent-y');
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('range=30d');
    expect(url).toContain('agent_name=agent-y');
  });
});

describe('getMessages', () => {
  it('sends all filter params', async () => {
    mockOk({ items: [] });

    await getMessages({ range: '7d', status: 'error', agent_name: 'bot' });
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('range=7d');
    expect(url).toContain('status=error');
    expect(url).toContain('agent_name=bot');
  });

  it('skips empty params', async () => {
    mockOk({ items: [] });

    await getMessages({ range: '24h', status: '' });
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('range=24h');
    expect(url).not.toContain('status=');
  });
});

describe('getSecurity', () => {
  it('sends range param', async () => {
    mockOk({ score: {} });

    await getSecurity('7d');
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('range=7d');
  });
});

describe('getHealth', () => {
  it('fetches /api/v1/health', async () => {
    mockOk({ status: 'ok' });

    const result = await getHealth();
    expect(result).toEqual({ status: 'ok' });
  });
});

describe('error handling', () => {
  it('throws on non-ok response', async () => {
    mockError(500, 'Internal Server Error');

    await expect(getHealth()).rejects.toThrow('API error: 500 Internal Server Error');
  });

  it('throws on 404', async () => {
    mockError(404, 'Not Found');

    await expect(getAgents()).rejects.toThrow('API error: 404 Not Found');
  });
});

describe('getAgentKey', () => {
  it('should return keyPrefix instead of full apiKey', async () => {
    const payload = { keyPrefix: 'mnfst_abc12' };
    mockOk(payload);

    const result = await getAgentKey('my-agent');

    expect(result).toEqual({ keyPrefix: 'mnfst_abc12' });
    expect(result).not.toHaveProperty('apiKey');
  });

  it('should include pluginEndpoint when present', async () => {
    const payload = { keyPrefix: 'mnfst_xyz99', pluginEndpoint: 'https://example.com/otlp' };
    mockOk(payload);

    const result = await getAgentKey('my-agent');

    expect(result).toEqual({
      keyPrefix: 'mnfst_xyz99',
      pluginEndpoint: 'https://example.com/otlp',
    });
  });

  it('should fetch the correct URL with encoded agent name', async () => {
    mockOk({ keyPrefix: 'mnfst_test' });

    await getAgentKey('agent with spaces');

    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/agents/agent%20with%20spaces/key');
  });

  it('should encode special characters in agent name', async () => {
    mockOk({ keyPrefix: 'mnfst_test' });

    await getAgentKey('agent/name');

    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/agents/agent%2Fname/key');
  });

  it('should use GET with credentials: include', async () => {
    mockOk({ keyPrefix: 'mnfst_test' });

    await getAgentKey('bot');

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/agents/bot/key'), {
      credentials: 'include',
      cache: 'no-store',
    });
  });
});

describe('rotateAgentKey', () => {
  it('should POST to the rotate-key endpoint and return the new full key', async () => {
    const payload = { apiKey: 'mnfst_newFullKey123abc' };
    mockMutateOk(payload);

    const result = await rotateAgentKey('my-agent');

    expect(result).toEqual({ apiKey: 'mnfst_newFullKey123abc' });
  });

  it('should use POST method with credentials: include', async () => {
    mockMutateOk({ apiKey: 'mnfst_abc' });

    await rotateAgentKey('my-agent');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/agents/my-agent/rotate-key',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('should encode special characters in agent name', async () => {
    mockMutateOk({ apiKey: 'mnfst_abc' });

    await rotateAgentKey('agent/special name');

    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/agents/agent%2Fspecial%20name/rotate-key');
  });

  it('should throw and call toast.error on failure', async () => {
    const { toast } = await import('../../src/services/toast-store.js');
    mockMutateError(403, 'Forbidden');

    await expect(rotateAgentKey('my-agent')).rejects.toThrow('Forbidden');
    expect(toast.error).toHaveBeenCalledWith('Forbidden');
  });
});

describe('createAgent', () => {
  it('should return agent object and full apiKey', async () => {
    const payload = {
      agent: { id: 'uuid-123', name: 'new-bot' },
      apiKey: 'mnfst_fullKeyShownOnce',
    };
    mockMutateOk(payload);

    const result = await createAgent('new-bot');

    expect(result).toEqual({
      agent: { id: 'uuid-123', name: 'new-bot' },
      apiKey: 'mnfst_fullKeyShownOnce',
    });
  });

  it('should POST to /api/v1/agents with JSON body', async () => {
    mockMutateOk({ agent: { id: '1', name: 'bot' }, apiKey: 'mnfst_x' });

    await createAgent('bot');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/agents',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'bot' }),
      }),
    );
  });

  it('should throw and show toast on validation error', async () => {
    const { toast } = await import('../../src/services/toast-store.js');
    mockMutateError(400, 'Agent name is required');

    await expect(createAgent('')).rejects.toThrow('Agent name is required');
    expect(toast.error).toHaveBeenCalledWith('Agent name is required');
  });
});

describe('deleteAgent', () => {
  it('should send DELETE to the correct URL', async () => {
    mockMutateOk();

    await deleteAgent('old-bot');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/agents/old-bot',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
    );
  });

  it('should encode agent name in URL', async () => {
    mockMutateOk();

    await deleteAgent('bot/with spaces');

    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/agents/bot%2Fwith%20spaces');
  });

  it('should return undefined for empty response body', async () => {
    mockMutateOk();

    const result = await deleteAgent('bot');

    expect(result).toBeUndefined();
  });
});

describe('renameAgent', () => {
  it('should PATCH to the correct URL with JSON body', async () => {
    const payload = { renamed: true, name: 'new-bot' };
    mockMutateOk(payload);

    const result = await renameAgent('old-bot', 'new-bot');

    expect(result).toEqual(payload);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/agents/old-bot',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'new-bot' }),
      }),
    );
  });

  it('should encode agent name in URL', async () => {
    mockMutateOk({ renamed: true, name: 'new-name' });

    await renameAgent('agent/special name', 'new-name');

    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/agents/agent%2Fspecial%20name');
  });

  it('should throw and call toast.error on failure', async () => {
    const { toast } = await import('../../src/services/toast-store.js');
    mockMutateError(409, 'Agent "new-bot" already exists');

    await expect(renameAgent('old-bot', 'new-bot')).rejects.toThrow(
      'Agent "new-bot" already exists',
    );
    expect(toast.error).toHaveBeenCalledWith('Agent "new-bot" already exists');
  });
});

describe('getModelPrices', () => {
  it('should fetch /api/v1/model-prices', async () => {
    const prices = [{ model: 'gpt-4', input_cost: 0.03, output_cost: 0.06 }];
    mockOk(prices);

    const result = await getModelPrices();

    expect(result).toEqual(prices);
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api/v1/model-prices', {
      credentials: 'include',
      cache: 'no-store',
    });
  });
});

describe('fetchMutate error handling', () => {
  it('should parse JSON error message from response body', async () => {
    const { toast } = await import('../../src/services/toast-store.js');
    mockMutateError(422, 'Name already taken');

    await expect(createAgent('dup')).rejects.toThrow('Name already taken');
    expect(toast.error).toHaveBeenCalledWith('Name already taken');
  });

  it('should parse array error messages joined by comma', async () => {
    const { toast } = await import('../../src/services/toast-store.js');
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: ['field is required', 'name too short'] }),
    });

    await expect(createAgent('x')).rejects.toThrow('field is required, name too short');
    expect(toast.error).toHaveBeenCalledWith('field is required, name too short');
  });

  it('should fall back to status code when body is not JSON', async () => {
    const { toast } = await import('../../src/services/toast-store.js');
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
    });

    await expect(deleteAgent('bot')).rejects.toThrow('Request failed (500)');
    expect(toast.error).toHaveBeenCalledWith('Request failed (500)');
  });
});

describe('getProviders', () => {
  it('fetches /routing/:agentName/providers', async () => {
    const payload = [{ id: '1', provider: 'openai', is_active: true, connected_at: '2026-01-01' }];
    mockOk(payload);

    const result = await getProviders('my-agent');
    expect(result).toEqual(payload);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/routing/my-agent/providers',
      { credentials: 'include', cache: 'no-store' },
    );
  });
});

describe('connectProvider', () => {
  it('POSTs to /routing/:agentName/providers with provider only (no apiKey)', async () => {
    const payload = { id: '1', provider: 'openai', is_active: true };
    mockMutateOk(payload);

    const result = await connectProvider('my-agent', { provider: 'openai' });
    expect(result).toEqual(payload);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/routing/my-agent/providers',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'openai' }),
      }),
    );
  });

  it('POSTs with optional apiKey when provided', async () => {
    const payload = { id: '1', provider: 'openai', is_active: true };
    mockMutateOk(payload);

    await connectProvider('my-agent', { provider: 'openai', apiKey: 'sk-test' });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/routing/my-agent/providers',
      expect.objectContaining({
        body: JSON.stringify({ provider: 'openai', apiKey: 'sk-test' }),
      }),
    );
  });

  it('POSTs qwen connections without a client-side region override', async () => {
    const payload = { id: '1', provider: 'qwen', is_active: true, region: 'singapore' };
    mockMutateOk(payload);

    await connectProvider('my-agent', {
      provider: 'qwen',
      apiKey: 'sk-qwen-test',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/routing/my-agent/providers',
      expect.objectContaining({
        body: JSON.stringify({
          provider: 'qwen',
          apiKey: 'sk-qwen-test',
        }),
      }),
    );
  });

  it('throws and shows toast on error', async () => {
    const { toast } = await import('../../src/services/toast-store.js');
    mockMutateError(400, 'Invalid provider');

    await expect(connectProvider('my-agent', { provider: '' })).rejects.toThrow('Invalid provider');
    expect(toast.error).toHaveBeenCalledWith('Invalid provider');
  });
});

describe('deactivateAllProviders', () => {
  it('POSTs to /routing/:agentName/providers/deactivate-all', async () => {
    mockMutateOk({ ok: true });

    const result = await deactivateAllProviders('my-agent');
    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/routing/my-agent/providers/deactivate-all',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });
});

describe('getOpenaiOAuthUrl', () => {
  it('fetches /oauth/openai/authorize with agentName param', async () => {
    const payload = { url: 'https://auth.openai.com/oauth/authorize?state=abc' };
    mockOk(payload);

    const result = await getOpenaiOAuthUrl('my-agent');
    expect(result).toEqual(payload);
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/api/v1/oauth/openai/authorize');
    expect(url).toContain('agentName=my-agent');
  });
});

describe('revokeOpenaiOAuth', () => {
  it('sends POST to /oauth/openai/revoke with agentName param', async () => {
    const payload = { ok: true };
    mockMutateOk(payload);

    const result = await revokeOpenaiOAuth('my-agent');
    expect(result).toEqual(payload);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/oauth/openai/revoke?agentName=my-agent',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });
});

describe('startMinimaxOAuth', () => {
  it('sends POST to /oauth/minimax/start with agentName and default region params', async () => {
    const payload = {
      flowId: 'flow-1',
      userCode: 'ABCD-1234',
      verificationUri: 'https://www.minimax.io/verify',
      expiresAt: 1760000000000,
      pollIntervalMs: 2000,
    };
    mockMutateOk(payload);

    const result = await startMinimaxOAuth('my-agent');
    expect(result).toEqual(payload);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/oauth/minimax/start?agentName=my-agent&region=global',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('sends POST to /oauth/minimax/start with the selected region', async () => {
    const payload = {
      flowId: 'flow-1',
      userCode: 'ABCD-1234',
      verificationUri: 'https://www.minimax.io/verify',
      expiresAt: 1760000000000,
      pollIntervalMs: 2000,
    };
    mockMutateOk(payload);

    const result = await startMinimaxOAuth('my-agent', 'cn');
    expect(result).toEqual(payload);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/oauth/minimax/start?agentName=my-agent&region=cn',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });
});

describe('pollMinimaxOAuth', () => {
  it('fetches /oauth/minimax/poll with flowId param', async () => {
    const payload = { status: 'pending', message: 'Waiting', pollIntervalMs: 2000 };
    mockOk(payload);

    const result = await pollMinimaxOAuth('flow-1');
    expect(result).toEqual(payload);
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/api/v1/oauth/minimax/poll');
    expect(url).toContain('flowId=flow-1');
  });
});

describe('disconnectProvider', () => {
  it('sends DELETE to /routing/:agentName/providers/:provider', async () => {
    const payload = { ok: true, notifications: [] };
    mockMutateOk(payload);

    const result = await disconnectProvider('my-agent', 'openai');
    expect(result).toEqual(payload);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/routing/my-agent/providers/openai',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
    );
  });

  it('encodes provider name in URL', async () => {
    mockMutateOk({ ok: true, notifications: [] });

    await disconnectProvider('my-agent', 'my provider');
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/routing/my-agent/providers/my%20provider');
  });

  it('appends authType query parameter when provided', async () => {
    mockMutateOk({ ok: true, notifications: [] });

    await disconnectProvider('my-agent', 'anthropic', 'subscription');
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/routing/my-agent/providers/anthropic?authType=subscription');
  });
});

describe('getTierAssignments', () => {
  it('fetches /routing/:agentName/tiers', async () => {
    const payload = [
      { id: '1', tier: 'tier-1', override_model: null, auto_assigned_model: 'gpt-4' },
    ];
    mockOk(payload);

    const result = await getTierAssignments('my-agent');
    expect(result).toEqual(payload);
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api/v1/routing/my-agent/tiers', {
      credentials: 'include',
      cache: 'no-store',
    });
  });
});

describe('overrideTier', () => {
  it('PUTs to /routing/:agentName/tiers/:tier with JSON body', async () => {
    const payload = {
      id: '1',
      tier: 'tier-1',
      override_model: 'gpt-4o',
      auto_assigned_model: null,
      updated_at: '2026-01-01',
    };
    mockMutateOk(payload);

    const result = await overrideTier('my-agent', 'tier-1', 'gpt-4o');
    expect(result).toEqual(payload);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/routing/my-agent/tiers/tier-1',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o' }),
      }),
    );
  });

  it('encodes tier name in URL', async () => {
    mockMutateOk({});

    await overrideTier('my-agent', 'tier 1', 'gpt-4o');
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/routing/my-agent/tiers/tier%201');
  });

  it('includes authType in body when provided', async () => {
    mockMutateOk({});

    await overrideTier('my-agent', 'simple', 'claude-sonnet-4', 'subscription');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/routing/my-agent/tiers/simple',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ model: 'claude-sonnet-4', authType: 'subscription' }),
      }),
    );
  });
});

describe('resetTier', () => {
  it('sends DELETE to /routing/:agentName/tiers/:tier', async () => {
    mockMutateOk();

    await resetTier('my-agent', 'tier-1');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/routing/my-agent/tiers/tier-1',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
    );
  });

  it('encodes tier name in URL', async () => {
    mockMutateOk();

    await resetTier('my-agent', 'tier/special');
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/routing/my-agent/tiers/tier%2Fspecial');
  });
});

describe('resetAllTiers', () => {
  it('POSTs to /routing/:agentName/tiers/reset-all', async () => {
    mockMutateOk();

    await resetAllTiers('my-agent');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/routing/my-agent/tiers/reset-all',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });
});

describe('getAvailableModels', () => {
  it('fetches /routing/:agentName/available-models', async () => {
    const payload = [{ model_name: 'gpt-4o', provider: 'openai', input_price_per_token: 0.01 }];
    mockOk(payload);

    const result = await getAvailableModels('my-agent');
    expect(result).toEqual(payload);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/routing/my-agent/available-models',
      { credentials: 'include', cache: 'no-store' },
    );
  });
});

describe('getNotificationRules', () => {
  it('fetches /notifications with agent_name param', async () => {
    const payload = [{ id: '1', agent_name: 'bot', metric_type: 'tokens', threshold: 1000 }];
    mockOk(payload);

    const result = await getNotificationRules('bot');
    expect(result).toEqual(payload);
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/api/v1/notifications');
    expect(url).toContain('agent_name=bot');
  });
});

describe('createNotificationRule', () => {
  it('POSTs to /notifications with JSON body', async () => {
    const data = { agent_name: 'bot', metric_type: 'tokens', threshold: 1000, period: 'hour' };
    mockMutateOk({ id: '1', ...data });

    await createNotificationRule(data);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/notifications',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    );
  });

  it('throws and shows toast on error', async () => {
    const { toast } = await import('../../src/services/toast-store.js');
    mockMutateError(400, 'Threshold must be positive');

    await expect(
      createNotificationRule({
        agent_name: 'bot',
        metric_type: 'tokens',
        threshold: -1,
        period: 'hour',
      }),
    ).rejects.toThrow('Threshold must be positive');
    expect(toast.error).toHaveBeenCalledWith('Threshold must be positive');
  });
});

describe('updateNotificationRule', () => {
  it('PATCHes to /notifications/:id with JSON body', async () => {
    const updates = { threshold: 2000 };
    mockMutateOk({ id: 'rule-1', threshold: 2000 });

    await updateNotificationRule('rule-1', updates);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/notifications/rule-1',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }),
    );
  });

  it('encodes rule id in URL', async () => {
    mockMutateOk({});

    await updateNotificationRule('id/special', { threshold: 500 });
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/notifications/id%2Fspecial');
  });
});

describe('deleteNotificationRule', () => {
  it('sends DELETE to /notifications/:id', async () => {
    mockMutateOk();

    await deleteNotificationRule('rule-1');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/notifications/rule-1',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
    );
  });

  it('encodes rule id in URL', async () => {
    mockMutateOk();

    await deleteNotificationRule('id/special');
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/notifications/id%2Fspecial');
  });
});

describe('getEmailProvider', () => {
  it('returns config when provider is configured', async () => {
    const payload = {
      provider: 'resend',
      domain: 'example.com',
      keyPrefix: 're_abc',
      is_active: true,
      notificationEmail: 'me@example.com',
    };
    mockOk(payload);

    const result = await getEmailProvider();
    expect(result).toEqual(payload);
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/api/v1/notifications/email-provider');
  });

  it('returns null when configured is false', async () => {
    mockOk({ configured: false });

    const result = await getEmailProvider();
    expect(result).toBeNull();
  });
});

describe('setEmailProvider', () => {
  it('POSTs provider config with apiKey', async () => {
    mockMutateOk();

    await setEmailProvider({ provider: 'resend', apiKey: 're_test123', domain: 'example.com' });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/notifications/email-provider',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'resend', apiKey: 're_test123', domain: 'example.com' }),
      }),
    );
  });

  it('POSTs without optional apiKey', async () => {
    mockMutateOk();

    await setEmailProvider({ provider: 'resend' });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/notifications/email-provider',
      expect.objectContaining({
        body: JSON.stringify({ provider: 'resend' }),
      }),
    );
  });
});

describe('removeEmailProvider', () => {
  it('sends DELETE to /notifications/email-provider', async () => {
    mockMutateOk();

    await removeEmailProvider();
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/notifications/email-provider',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
    );
  });
});

describe('testEmailProvider', () => {
  it('POSTs test credentials', async () => {
    mockMutateOk({ success: true });

    const result = await testEmailProvider({
      provider: 'resend',
      apiKey: 're_key',
      domain: 'example.com',
      to: 'test@example.com',
    });
    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/notifications/email-provider/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'resend',
          apiKey: 're_key',
          domain: 'example.com',
          to: 'test@example.com',
        }),
      }),
    );
  });
});

describe('testSavedEmailProvider', () => {
  it('POSTs with just recipient email', async () => {
    mockMutateOk({ success: true });

    const result = await testSavedEmailProvider('user@example.com');
    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/notifications/email-provider/test-saved',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'user@example.com' }),
      }),
    );
  });
});

describe('getNotificationEmailForProvider', () => {
  it('fetches /notifications/notification-email', async () => {
    mockOk({ email: 'user@example.com' });

    const result = await getNotificationEmailForProvider();
    expect(result).toEqual({ email: 'user@example.com' });
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/api/v1/notifications/notification-email');
  });

  it('returns null email when not set', async () => {
    mockOk({ email: null });

    const result = await getNotificationEmailForProvider();
    expect(result).toEqual({ email: null });
  });
});

describe('saveNotificationEmailForProvider', () => {
  it('POSTs email to /notifications/notification-email', async () => {
    mockMutateOk({ saved: true });

    const result = await saveNotificationEmailForProvider('new@example.com');
    expect(result).toEqual({ saved: true });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/notifications/notification-email',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'new@example.com' }),
      }),
    );
  });
});

describe('getEmailConfig', () => {
  it('fetches /email-config', async () => {
    const payload = {
      configured: true,
      provider: 'mailgun',
      domain: 'mg.example.com',
      fromEmail: 'noreply@example.com',
    };
    mockOk(payload);

    const result = await getEmailConfig();
    expect(result).toEqual(payload);
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/api/v1/email-config');
  });
});

describe('saveEmailConfig', () => {
  it('POSTs to /email-config with JSON body', async () => {
    mockMutateOk();

    await saveEmailConfig({
      provider: 'mailgun',
      apiKey: 'key-123',
      domain: 'mg.example.com',
      fromEmail: 'noreply@example.com',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/email-config',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'mailgun',
          apiKey: 'key-123',
          domain: 'mg.example.com',
          fromEmail: 'noreply@example.com',
        }),
      }),
    );
  });
});

describe('testEmailConfig', () => {
  it('POSTs to /email-config/test with config + toEmail', async () => {
    mockMutateOk({ success: true });

    const config = { provider: 'mailgun', apiKey: 'key-123', domain: 'mg.example.com' };
    const result = await testEmailConfig(config, 'test@example.com');
    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/email-config/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, toEmail: 'test@example.com' }),
      }),
    );
  });
});

describe('clearEmailConfig', () => {
  it('sends DELETE to /email-config', async () => {
    mockMutateOk();

    await clearEmailConfig();
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/email-config',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
    );
  });
});

describe('getNotificationEmail', () => {
  it('fetches /notification-email', async () => {
    mockOk({ email: 'user@example.com', isDefault: false });

    const result = await getNotificationEmail();
    expect(result).toEqual({ email: 'user@example.com', isDefault: false });
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/api/v1/notification-email');
  });
});

describe('saveNotificationEmail', () => {
  it('POSTs to /notification-email', async () => {
    mockMutateOk();

    await saveNotificationEmail('new@example.com');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/notification-email',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'new@example.com' }),
      }),
    );
  });
});

describe('getRoutingStatus', () => {
  it('fetches /routing/:agentName/status', async () => {
    const payload = { enabled: true };
    mockOk(payload);

    const result = await getRoutingStatus('my-agent');
    expect(result).toEqual(payload);
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/api/v1/routing/my-agent/status');
  });
});

describe('getCustomProviders', () => {
  it('fetches /routing/:agentName/custom-providers', async () => {
    const payload = [
      {
        id: 'cp-1',
        name: 'Groq',
        base_url: 'https://api.groq.com/v1',
        has_api_key: true,
        models: [],
        created_at: '2026-03-04',
      },
    ];
    mockOk(payload);

    const result = await getCustomProviders('my-agent');
    expect(result).toEqual(payload);
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/api/v1/routing/my-agent/custom-providers');
  });

  it('encodes agent name in URL', async () => {
    mockOk([]);

    await getCustomProviders('agent/special name');
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/routing/agent%2Fspecial%20name/custom-providers');
  });
});

describe('createCustomProvider', () => {
  it('POSTs to /routing/:agentName/custom-providers with JSON body', async () => {
    const payload = {
      id: 'cp-1',
      name: 'Groq',
      base_url: 'https://api.groq.com/v1',
      has_api_key: true,
      models: [{ model_name: 'llama' }],
      created_at: '2026-03-04',
    };
    mockMutateOk(payload);

    const data = {
      name: 'Groq',
      base_url: 'https://api.groq.com/v1',
      apiKey: 'gsk_test',
      models: [{ model_name: 'llama' }],
    };
    const result = await createCustomProvider('my-agent', data);

    expect(result).toEqual(payload);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/routing/my-agent/custom-providers',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    );
  });

  it('throws and shows toast on error', async () => {
    const { toast } = await import('../../src/services/toast-store.js');
    mockMutateError(409, 'Name already exists');

    await expect(
      createCustomProvider('my-agent', { name: 'Dup', base_url: 'http://localhost', models: [] }),
    ).rejects.toThrow('Name already exists');
    expect(toast.error).toHaveBeenCalledWith('Name already exists');
  });
});

describe('updateCustomProvider', () => {
  it('PUTs to /routing/:agentName/custom-providers/:id with JSON body', async () => {
    const payload = {
      id: 'cp-1',
      name: 'Updated Groq',
      base_url: 'https://api.groq.com/v1',
      has_api_key: true,
      models: [{ model_name: 'llama-3.1-70b' }],
      created_at: '2026-03-04',
    };
    mockMutateOk(payload);

    const data = {
      name: 'Updated Groq',
      base_url: 'https://api.groq.com/v1',
      models: [{ model_name: 'llama-3.1-70b' }],
    };
    const result = await updateCustomProvider('my-agent', 'cp-1', data);

    expect(result).toEqual(payload);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/routing/my-agent/custom-providers/cp-1',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    );
  });

  it('encodes agent name and id in URL', async () => {
    mockMutateOk({});

    await updateCustomProvider('agent/special', 'id/special', { name: 'Test' });
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/routing/agent%2Fspecial/custom-providers/id%2Fspecial');
  });

  it('throws and shows toast on error', async () => {
    const { toast } = await import('../../src/services/toast-store.js');
    mockMutateError(400, 'Name already exists');

    await expect(updateCustomProvider('my-agent', 'cp-1', { name: 'Dup' })).rejects.toThrow(
      'Name already exists',
    );
    expect(toast.error).toHaveBeenCalledWith('Name already exists');
  });
});

describe('deleteCustomProvider', () => {
  it('sends DELETE to /routing/:agentName/custom-providers/:id', async () => {
    mockMutateOk({ ok: true });

    const result = await deleteCustomProvider('my-agent', 'cp-1');
    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/routing/my-agent/custom-providers/cp-1',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
    );
  });

  it('encodes agent name and id in URL', async () => {
    mockMutateOk({ ok: true });

    await deleteCustomProvider('agent/special', 'id/special');
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/routing/agent%2Fspecial/custom-providers/id%2Fspecial');
  });
});

describe('fallback API functions', () => {
  it('getFallbacks fetches fallback models for a tier', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(['model-a', 'model-b']),
    });
    const result = await getFallbacks('my-agent', 'simple');
    expect(result).toEqual(['model-a', 'model-b']);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/routing/my-agent/tiers/simple/fallbacks'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('setFallbacks sends PUT with models array', async () => {
    mockMutateOk(['model-a']);
    const result = await setFallbacks('my-agent', 'standard', ['model-a']);
    expect(result).toEqual(['model-a']);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/routing/my-agent/tiers/standard/fallbacks'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ models: ['model-a'] }),
      }),
    );
  });

  it('clearFallbacks sends DELETE', async () => {
    mockMutateOk();
    await clearFallbacks('my-agent', 'complex');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/routing/my-agent/tiers/complex/fallbacks'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('getFallbacks encodes special characters in agent name', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
    await getFallbacks('agent/special', 'simple');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/routing/agent%2Fspecial/tiers/simple/fallbacks'),
      expect.anything(),
    );
  });
});

describe('fetchJson 401 redirect', () => {
  it('redirects to /login on 401 response', async () => {
    const loc = { origin: 'http://localhost:3000', pathname: '/overview', href: '' };
    vi.stubGlobal('location', loc);
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    // fetchJson returns a never-resolving promise on 401, so race with a timeout
    const result = await Promise.race([
      getHealth().then(() => 'resolved'),
      new Promise<string>((r) => setTimeout(() => r('pending'), 50)),
    ]);

    expect(result).toBe('pending');
    expect(loc.href).toBe('/login');
  });

  it('does not redirect if already on /login', async () => {
    const loc = { origin: 'http://localhost:3000', pathname: '/login', href: '' };
    vi.stubGlobal('location', loc);
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    await Promise.race([getHealth(), new Promise<string>((r) => setTimeout(() => r('done'), 50))]);

    expect(loc.href).toBe('');
  });
});
