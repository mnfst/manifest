import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetAgents = vi.fn();
vi.mock('../../../src/services/api/agents.js', () => ({
  getAgents: (...args: unknown[]) => mockGetAgents(...args),
}));
const mockUsage = vi.fn();
vi.mock('../../../src/services/api/analytics.js', () => ({
  getOverviewAgentUsage: (...args: unknown[]) => mockUsage(...args),
}));
const mockGetProviders = vi.fn();
vi.mock('../../../src/services/api/providers.js', () => ({
  getProviders: (...args: unknown[]) => mockGetProviders(...args),
}));
const mockModels = vi.fn();
const mockTiers = vi.fn();
vi.mock('../../../src/services/api/routing.js', () => ({
  getAvailableModels: (...args: unknown[]) => mockModels(...args),
  getTierAssignments: (...args: unknown[]) => mockTiers(...args),
}));

import {
  compatTeamsApi as api,
  TEAMS_BACKEND_MISSING,
} from '../../../src/services/api/teams-compat';
import { enabledModelCount, paginate, regroupUsage } from '../../../src/services/api/teams-derive';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAgents.mockResolvedValue({
    agents: [
      { agent_name: 'beta', display_name: 'Beta', total_cost: 2, message_count: 5 },
      {
        agent_name: 'alpha',
        display_name: 'Alpha',
        total_cost: 9,
        message_count: 1,
        agent_platform: 'curl',
      },
    ],
  });
  mockGetProviders.mockResolvedValue({
    providers: [
      {
        provider: 'openai',
        auth_type: 'api_key',
        connections: [{ id: 'up-1', label: 'Default', is_active: true }],
      },
    ],
  });
  mockModels.mockResolvedValue([{ model_name: 'gpt-5', provider: 'openai', display_name: null }]);
  mockTiers.mockResolvedValue([]);
  mockUsage.mockResolvedValue({
    tokenUsage: { agents: ['alpha', 'ghost'], timeseries: [{ date: 'd', alpha: 1, ghost: 2 }] },
    messageUsage: { agents: [], timeseries: [] },
    costUsage: { agents: [], timeseries: [] },
  });
});

describe('compat transport (teams backend absent)', () => {
  it('serves the day-one state: no users, no projects, every agent unowned', async () => {
    expect(await api.getUsers()).toEqual({
      users: [],
      total: 0,
      spend_30d_usd_total: 0,
      spend_365d_usd_total: 0,
    });
    expect(await api.getUser('x')).toBeNull();
    expect(await api.getProjects()).toEqual({ projects: [], total: 0 });
    expect(await api.getProject('x')).toBeNull();
    expect(await api.getAgentTeam('alpha')).toEqual({
      owner: null,
      projects: [],
      archived_at: null,
    });
    expect(await api.getSelectionProjects({ kind: 'names', agent_names: ['alpha'] })).toEqual({});
  });

  it('lists, filters, sorts and pages the real agents', async () => {
    const list = await api.listAgents({ sort: 'spend_30d', dir: 'desc', page: 1, page_size: 1 });
    expect(list.total).toBe(2);
    expect(list.unowned_total).toBe(2);
    expect(list.agents.map((a) => a.agent_name)).toEqual(['alpha']);
    expect(list.agents[0]).toMatchObject({ owner: null, projects: [], models_enabled: 0 });
    expect((await api.listAgents({ types: ['curl'] })).total).toBe(1);
    expect((await api.listAgents({ owners: ['u-1'] })).total).toBe(0);
    expect((await api.listAgents()).total).toBe(2);
  });

  it('checks names tenant-wide like the create endpoint does today', async () => {
    expect(await api.checkAgentName(' Alpha ', 'u-1')).toEqual({
      available: false,
      suggestion: 'alpha-2',
    });
    expect(await api.checkAgentName('gamma', null)).toEqual({ available: true, suggestion: null });
  });

  it('accepts a new agent with no team and refuses one that needs the backend', async () => {
    await expect(api.assignNewAgent('gamma', null, [])).resolves.toBeUndefined();
    await expect(api.assignNewAgent('gamma', 'u-1', [])).rejects.toThrow(TEAMS_BACKEND_MISSING);
    await expect(api.assignNewAgent('gamma', null, ['p-1'])).rejects.toThrow(TEAMS_BACKEND_MISSING);
  });

  it('counts selections by names or by query', async () => {
    expect(await api.countSelection({ kind: 'names', agent_names: ['alpha', 'nope'] })).toBe(1);
    expect(
      await api.countSelection({ kind: 'query', query: { search: 'a' }, expected_total: 2 }),
    ).toBe(2);
  });

  it('builds model access from the real endpoints with every model allowed', async () => {
    const access = await api.getAgentModelAccess('alpha');
    expect(access).toEqual([
      {
        user_provider_id: 'up-1',
        provider: 'openai',
        auth_type: 'api_key',
        label: 'Default',
        provider_enabled: true,
        all_models: true,
        models: [{ id: 'gpt-5', name: 'gpt-5', enabled: true, in_routing: false }],
        enabled_count: 1,
        total_count: 1,
      },
    ]);
  });

  it('regroups usage by agent, owner and project without a team layer', async () => {
    const byOwner = await api.getOverviewGroupedUsage('7d', 'owner');
    expect(byOwner.tokenUsage).toEqual({
      agents: ['No user'],
      timeseries: [{ date: 'd', 'No user': 3 }],
    });
    const byProject = await api.getOverviewGroupedUsage('7d', 'project');
    expect(byProject.tokenUsage.agents).toEqual(['No project']);
    const byAgent = await api.getOverviewGroupedUsage('7d', 'agent');
    expect(byAgent.tokenUsage.agents).toEqual(['alpha', 'ghost']);
  });

  it('refuses every write with a clear message', async () => {
    const writes: Array<() => Promise<unknown>> = [
      () => api.createUser({ name: 'x' }),
      () => api.updateUser('u', {}),
      () => api.archiveUser('u'),
      () => api.unarchiveUser('u'),
      () => api.deleteUser('u', { agents: 'unassign' }),
      () => api.getUserOverview('u'),
      () => api.removeAgentFromUser('u', 'a'),
      () => api.createProject({ name: 'p' }),
      () => api.updateProject('p', {}),
      () => api.archiveProject('p'),
      () => api.unarchiveProject('p'),
      () => api.deleteProject('p'),
      () => api.getProjectOverview('p'),
      () => api.setAgentProjects('a', []),
      () => api.archiveAgent('a'),
      () => api.unarchiveAgent('a'),
      () => api.bulkUpdateProjects({ kind: 'names', agent_names: [] }, { add: [], remove: [] }),
      () =>
        api.bulkCopySettings({ kind: 'names', agent_names: [] }, 'a', {
          providers_and_models: true,
          routing: false,
          limits: false,
        }),
      () => api.updateAgentModelAccess('a', 'up', { all_models: true, enabled_model_ids: [] }),
      () => api.applyModelAccessToAgents('a', 'up', []),
    ];
    for (const write of writes) {
      await expect(write()).rejects.toThrow(TEAMS_BACKEND_MISSING);
    }
  });
});

describe('teams-derive helpers', () => {
  it('paginates with defaults and clamps bad pages', () => {
    const rows = [1, 2, 3];
    expect(paginate(rows, {})).toEqual({ page: 1, page_size: 50, items: [1, 2, 3] });
    expect(paginate(rows, { page: 0, page_size: 0 })).toEqual({
      page: 1,
      page_size: 1,
      items: [1],
    });
    expect(paginate(rows, { page: 2, page_size: 2 })).toEqual({
      page: 2,
      page_size: 2,
      items: [3],
    });
  });

  it('counts enabled models per connection and falls back to the total', () => {
    expect(enabledModelCount(undefined, { a: 3 }, 3)).toBe(3);
    expect(enabledModelCount({ a: { all_models: true, enabled: [] } }, undefined, 3)).toBe(3);
    expect(
      enabledModelCount(
        {
          a: { all_models: false, enabled: ['x', 'y', 'z', 'w'] },
          b: { all_models: true, enabled: [] },
        },
        { a: 3, b: 2, c: 4 },
        9,
      ),
    ).toBe(3 + 2 + 4);
  });

  it('keeps an unknown agent only while no filter is active', () => {
    const usage = {
      tokenUsage: { agents: ['ghost'], timeseries: [{ hour: 'h', ghost: 1 }] },
      messageUsage: { agents: [], timeseries: [] },
      costUsage: { agents: [], timeseries: [] },
    };
    expect(regroupUsage(usage, 'agent', {}, () => undefined).tokenUsage.agents).toEqual(['ghost']);
    expect(
      regroupUsage(usage, 'agent', { projects: ['p'] }, () => undefined).tokenUsage.agents,
    ).toEqual([]);
  });
});

describe('compat transport — second review round', () => {
  it('slugifies the name before checking it', async () => {
    expect(await api.checkAgentName('Alpha!', null)).toEqual({
      available: false,
      suggestion: 'alpha-2',
    });
    expect(await api.checkAgentName('Al pha', null)).toEqual({ available: true, suggestion: null });
    mockGetAgents.mockResolvedValue({ agents: [{ agent_name: 'al-pha' }] });
    expect(await api.checkAgentName('AL PHA', null)).toEqual({
      available: false,
      suggestion: 'al-pha-2',
    });
  });

  it('applies the owner filter to the grouped usage (nothing matches without a team layer)', async () => {
    const filtered = await api.getOverviewGroupedUsage('7d', 'agent', { owners: ['u-1'] });
    expect(filtered.tokenUsage.agents).toEqual([]);
    const unowned = await api.getOverviewGroupedUsage('7d', 'agent', { owners: ['none'] });
    expect(unowned.tokenUsage.agents).toEqual(['alpha']);
  });

  it('only offers models discovered for the connection auth type', async () => {
    mockGetProviders.mockResolvedValue({
      providers: [
        {
          provider: 'openai',
          auth_type: 'api_key',
          connections: [{ id: 'up-key', label: 'Default', is_active: true }],
        },
        {
          provider: 'openai',
          auth_type: 'subscription',
          connections: [{ id: 'up-sub', label: 'Plus', is_active: true }],
        },
      ],
    });
    mockModels.mockResolvedValue([
      { model_name: 'gpt-5', provider: 'openai', auth_type: 'api_key', display_name: null },
      { model_name: 'codex', provider: 'openai', auth_type: 'subscription', display_name: null },
      { model_name: 'shared', provider: 'openai', display_name: null },
    ]);
    mockTiers.mockResolvedValue([
      {
        tier: 'default',
        override_route: {
          provider: 'OpenAI',
          authType: 'API_KEY',
          keyLabel: 'default',
          model: 'gpt-5',
        },
        auto_assigned_route: null,
        fallback_routes: null,
      },
    ]);
    const access = await api.getAgentModelAccess('alpha');
    expect(access.map((p) => [p.user_provider_id, p.models.map((m) => m.id)])).toEqual([
      ['up-key', ['gpt-5', 'shared']],
      ['up-sub', ['codex', 'shared']],
    ]);
    // The routing lock ignores case on provider, auth type and key label.
    expect(access[0]!.models[0]!.in_routing).toBe(true);
    expect(access[1]!.models.every((m) => !m.in_routing)).toBe(true);
  });
});

describe('compat transport — third review round', () => {
  it('mirrors the backend slug rule and rejects an empty slug', async () => {
    mockGetAgents.mockResolvedValue({ agents: [{ agent_name: 'foobar' }, { agent_name: 'a-b' }] });
    // `foo.bar` slugs to `foobar` on the backend (punctuation is dropped).
    expect(await api.checkAgentName('foo.bar', null)).toEqual({
      available: false,
      suggestion: 'foobar-2',
    });
    expect(await api.checkAgentName('  A _ B  ', null)).toEqual({
      available: false,
      suggestion: 'a-b-2',
    });
    expect(await api.checkAgentName('foo--bar', null)).toEqual({
      available: true,
      suggestion: null,
    });
    expect(await api.checkAgentName('!!!', null)).toEqual({ available: false, suggestion: null });
    expect(mockGetAgents).toHaveBeenCalledTimes(3);
  });
});
