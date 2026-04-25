import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAgents,
  getAgentInfo,
  updateAgent,
  getOverview,
  getMessages,
  getHealth,
  getAgentKey,
  rotateAgentKey,
  createAgent,
  renameAgent,
  deleteAgent,
  getModelPrices,
  getProviders,
  connectProvider,
  disconnectProvider,
  copilotDeviceCode,
  copilotPollToken,
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
  getCustomProviders,
  createCustomProvider,
  updateCustomProvider,
  deleteCustomProvider,
  getRoutingStatus,
  getFallbacks,
  setFallbacks,
  clearFallbacks,
  getPricingHealth,
  refreshPricing,
  setMessageFeedback,
  clearMessageFeedback,
  getMessageDetails,
  flagMessageMiscategorized,
  clearMessageMiscategorized,
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

    const result = await createAgent({ name: 'new-bot' });

    expect(result).toEqual({
      agent: { id: 'uuid-123', name: 'new-bot' },
      apiKey: 'mnfst_fullKeyShownOnce',
    });
  });

  it('should POST to /api/v1/agents with JSON body', async () => {
    mockMutateOk({ agent: { id: '1', name: 'bot' }, apiKey: 'mnfst_x' });

    await createAgent({ name: 'bot' });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/agents',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'bot' }),  // createAgent({ name: 'bot' })
      }),
    );
  });

  it('should throw and show toast on validation error', async () => {
    const { toast } = await import('../../src/services/toast-store.js');
    mockMutateError(400, 'Agent name is required');

    await expect(createAgent({ name: '' })).rejects.toThrow('Agent name is required');
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

describe('getAgentInfo', () => {
  it('should return agent info when agent exists', async () => {
    const agents = [
      { agent_name: 'my-agent', display_name: 'My Agent', agent_category: 'personal', agent_platform: 'openclaw' },
      { agent_name: 'other', display_name: 'Other', agent_category: null, agent_platform: null },
    ];
    mockOk({ agents });

    const result = await getAgentInfo('my-agent');

    expect(result).toEqual(agents[0]);
  });

  it('should return null when agent not found', async () => {
    mockOk({ agents: [{ agent_name: 'other', display_name: 'Other', agent_category: null, agent_platform: null }] });

    const result = await getAgentInfo('missing-agent');

    expect(result).toBeNull();
  });

  it('should return null when agents list is empty', async () => {
    mockOk({ agents: [] });

    const result = await getAgentInfo('any-agent');

    expect(result).toBeNull();
  });
});

describe('updateAgent', () => {
  it('should PATCH to the correct URL with fields', async () => {
    mockMutateOk({ updated: true });

    const result = await updateAgent('my-agent', { agent_category: 'app', agent_platform: 'openai-sdk' });

    expect(result).toEqual({ updated: true });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/agents/my-agent',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_category: 'app', agent_platform: 'openai-sdk' }),
      }),
    );
  });

  it('should encode agent name in URL', async () => {
    mockMutateOk({});

    await updateAgent('agent/special name', { name: 'new' });

    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/agents/agent%2Fspecial%20name');
  });

  it('should throw and call toast.error on failure', async () => {
    const { toast } = await import('../../src/services/toast-store.js');
    mockMutateError(400, 'Invalid category');

    await expect(updateAgent('my-agent', { agent_category: 'bad' })).rejects.toThrow('Invalid category');
    expect(toast.error).toHaveBeenCalledWith('Invalid category');
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

    await expect(createAgent({ name: 'dup' })).rejects.toThrow('Name already taken');
    expect(toast.error).toHaveBeenCalledWith('Name already taken');
  });

  it('should parse array error messages joined by comma', async () => {
    const { toast } = await import('../../src/services/toast-store.js');
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: ['field is required', 'name too short'] }),
    });

    await expect(createAgent({ name: 'x' })).rejects.toThrow('field is required, name too short');
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

    const result = await overrideTier('my-agent', 'tier-1', 'gpt-4o', 'openai');
    expect(result).toEqual(payload);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/routing/my-agent/tiers/tier-1',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o', provider: 'openai' }),
      }),
    );
  });

  it('encodes tier name in URL', async () => {
    mockMutateOk({});

    await overrideTier('my-agent', 'tier 1', 'gpt-4o', 'openai');
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/routing/my-agent/tiers/tier%201');
  });

  it('includes authType in body when provided', async () => {
    mockMutateOk({});

    await overrideTier('my-agent', 'simple', 'claude-sonnet-4', 'anthropic', 'subscription');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/routing/my-agent/tiers/simple',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          model: 'claude-sonnet-4',
          provider: 'anthropic',
          authType: 'subscription',
        }),
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

describe('getRoutingStatus', () => {
  it('fetches /routing/:agentName/status', async () => {
    const payload = { enabled: true, reason: null };
    mockOk(payload);

    const result = await getRoutingStatus('my-agent');
    expect(result).toEqual(payload);
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/api/v1/routing/my-agent/status');
  });
});

describe('getPricingHealth', () => {
  it('fetches /routing/pricing-health', async () => {
    const payload = { model_count: 348, last_fetched_at: '2026-04-13T00:00:00.000Z' };
    mockOk(payload);

    const result = await getPricingHealth();
    expect(result).toEqual(payload);
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/api/v1/routing/pricing-health');
  });
});

describe('refreshPricing', () => {
  it('POSTs /routing/pricing/refresh', async () => {
    const payload = { ok: true, model_count: 350, last_fetched_at: '2026-04-13T12:00:00.000Z' };
    mockMutateOk(payload);

    const result = await refreshPricing();
    expect(result).toEqual(payload);
    const call = mockFetch.mock.calls[0];
    const url = call?.[0] as string;
    const init = call?.[1] as RequestInit;
    expect(url).toContain('/api/v1/routing/pricing/refresh');
    expect(init.method).toBe('POST');
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

describe('copilotDeviceCode', () => {
  it('POSTs to /routing/:agentName/copilot/device-code', async () => {
    const payload = {
      device_code: 'dc_abc',
      user_code: 'ABCD-1234',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 5,
    };
    mockMutateOk(payload);

    const result = await copilotDeviceCode('my-agent');
    expect(result).toEqual(payload);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/routing/my-agent/copilot/device-code',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('encodes agent name in URL', async () => {
    mockMutateOk({
      device_code: 'dc',
      user_code: 'X',
      verification_uri: '',
      expires_in: 0,
      interval: 5,
    });

    await copilotDeviceCode('agent/special name');
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/routing/agent%2Fspecial%20name/copilot/device-code');
  });
});

describe('copilotPollToken', () => {
  it('POSTs to /routing/:agentName/copilot/poll-token with deviceCode', async () => {
    const payload = { status: 'pending' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => payload });

    const result = await copilotPollToken('my-agent', 'dc_abc');
    expect(result).toEqual(payload);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/routing/my-agent/copilot/poll-token',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceCode: 'dc_abc' }),
      }),
    );
  });

  it('encodes agent name in URL', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'complete' }) });

    await copilotPollToken('agent/special name', 'dc_test');
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/routing/agent%2Fspecial%20name/copilot/poll-token');
  });

  it('throws on non-ok response without showing toast', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(copilotPollToken('agent', 'dc_x')).rejects.toThrow('Poll failed: 503');
  });
});

describe('getMessageDetails', () => {
  it('fetches /messages/:id/details', async () => {
    const detail = { message: { id: 'abc' }, llm_calls: [], tool_executions: [], agent_logs: [] };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(detail) });
    const result = await getMessageDetails('abc');
    expect(result).toEqual(detail);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/messages/abc/details'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('encodes special characters in id', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    await getMessageDetails('a/b');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/messages/a%2Fb/details'),
      expect.any(Object),
    );
  });
});

describe('setMessageFeedback', () => {
  it('PATCHes /messages/:id/feedback with body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('') });
    await setMessageFeedback('msg-1', { rating: 'like' });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/messages/msg-1/feedback'),
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 'like' }),
      }),
    );
  });

  it('sends tags and details when provided', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('') });
    await setMessageFeedback('msg-1', { rating: 'dislike', tags: ['Buggy'], details: 'broken' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({ rating: 'dislike', tags: ['Buggy'], details: 'broken' });
  });

  it('throws and shows toast on error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'Bad request' }),
    });
    await expect(setMessageFeedback('msg-1', { rating: 'like' })).rejects.toThrow('Bad request');
  });
});

describe('clearMessageFeedback', () => {
  it('DELETEs /messages/:id/feedback', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('') });
    await clearMessageFeedback('msg-1');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/messages/msg-1/feedback'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('encodes special characters in id', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('') });
    await clearMessageFeedback('a/b');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/messages/a%2Fb/feedback'),
      expect.any(Object),
    );
  });
});

describe('flagMessageMiscategorized', () => {
  it('PATCHes /messages/:id/miscategorized', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('') });
    await flagMessageMiscategorized('msg-1');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/messages/msg-1/miscategorized'),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('encodes special characters in id', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('') });
    await flagMessageMiscategorized('a/b');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/messages/a%2Fb/miscategorized'),
      expect.any(Object),
    );
  });

  it('throws and surfaces the toast on error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ message: 'Message not found' }),
    });
    await expect(flagMessageMiscategorized('msg-1')).rejects.toThrow('Message not found');
  });
});

describe('clearMessageMiscategorized', () => {
  it('DELETEs /messages/:id/miscategorized', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('') });
    await clearMessageMiscategorized('msg-1');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/messages/msg-1/miscategorized'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('encodes special characters in id', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('') });
    await clearMessageMiscategorized('a/b');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/messages/a%2Fb/miscategorized'),
      expect.any(Object),
    );
  });
});

describe('fetchJson 401 redirect', () => {
  it('redirects to /login on 401 response and throws', async () => {
    const loc = { origin: 'http://localhost:3000', pathname: '/overview', href: '' };
    vi.stubGlobal('location', loc);
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(getHealth()).rejects.toThrow('Session expired');
    expect(loc.href).toBe('/login');
  });

  it('does not redirect if already on /login but still throws', async () => {
    const loc = { origin: 'http://localhost:3000', pathname: '/login', href: '' };
    vi.stubGlobal('location', loc);
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(getHealth()).rejects.toThrow('Session expired');
    expect(loc.href).toBe('');
  });
});
