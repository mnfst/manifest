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

import { mockTeamsApi as api, resetMockTeams } from '../../../src/services/api/teams-mock';
import { NO_OWNER } from '../../../src/services/api/teams';

// Six agents fill every seed slot: Maya/Atlas, Tom/Atlas+HSBC, Sara/Support,
// none/HSBC, Deniz/none, none/none.
const AGENTS = [
  {
    agent_name: 'claude-code',
    display_name: 'Claude Code',
    agent_platform: 'claude-code',
    agent_category: 'coding',
    message_count: 100,
    last_active: '2026-08-27T10:00:00Z',
    total_cost: 121.3,
    total_tokens: 1000,
    sparkline: [1, 2],
  },
  {
    agent_name: 'windsurf',
    display_name: 'Windsurf',
    agent_platform: 'other',
    agent_category: 'coding',
    message_count: 50,
    last_active: '2026-08-26T10:00:00Z',
    total_cost: 41.75,
  },
  {
    agent_name: 'support-triage',
    display_name: 'Support triage',
    agent_platform: 'openclaw',
    agent_category: 'personal',
    message_count: 30,
    last_active: '2026-08-20T10:00:00Z',
    total_cost: 58.4,
  },
  {
    agent_name: 'daily-report',
    display_name: 'Daily report',
    agent_platform: 'openai-sdk',
    agent_category: 'app',
    message_count: 200,
    last_active: '2026-08-28T10:00:00Z',
    total_cost: 88.1,
  },
  {
    agent_name: 'invoice-parser',
    agent_platform: null,
    agent_category: null,
    message_count: 0,
    last_active: null,
    total_cost: 24.05,
  },
  {
    agent_name: 'zeta',
    display_name: 'Zeta',
    agent_platform: 'curl',
    agent_category: 'app',
    message_count: 1,
    last_active: '2026-08-01T00:00:00Z',
    total_cost: 0,
  },
];

const providers = () => ({
  providers: [
    {
      provider: 'anthropic',
      auth_type: 'subscription',
      connections: [
        { id: 'up-ant', label: 'Max', is_active: true },
        { id: 'up-off', label: 'Old', is_active: false },
      ],
    },
    {
      provider: 'openai',
      auth_type: 'api_key',
      connections: [{ id: 'up-oai', label: 'Work', is_active: true }],
    },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  resetMockTeams();
  mockGetAgents.mockResolvedValue({ agents: AGENTS });
  mockGetProviders.mockResolvedValue(providers());
  mockModels.mockResolvedValue([
    { model_name: 'claude-opus-5', provider: 'anthropic', display_name: 'Claude Opus 5' },
    { model_name: 'claude-haiku', provider: 'anthropic', display_name: null },
    { model_name: 'gpt-5', provider: 'openai', display_name: 'GPT-5' },
  ]);
  mockTiers.mockResolvedValue([
    {
      tier: 'default',
      override_route: { provider: 'anthropic', model: 'claude-opus-5' },
      auto_assigned_route: null,
      fallback_routes: [{ provider: 'openai', model: 'gpt-5' }],
    },
    { tier: 'simple', override_route: null, auto_assigned_route: null, fallback_routes: null },
  ]);
  mockUsage.mockResolvedValue({
    tokenUsage: {
      agents: ['claude-code', 'windsurf', 'daily-report', 'ghost'],
      timeseries: [
        { date: '2026-08-27', 'claude-code': 10, windsurf: 5, 'daily-report': 2, ghost: 1 },
        { date: '2026-08-28', 'claude-code': 20, windsurf: 5, 'daily-report': 3, ghost: 1 },
      ],
    },
    messageUsage: { agents: ['claude-code'], timeseries: [{ hour: '10', 'claude-code': 4 }] },
    costUsage: {
      agents: ['claude-code'],
      timeseries: [{ date: '2026-08-27', 'claude-code': 1.5 }],
    },
  });
});

describe('seeding and persistence', () => {
  it('assigns seeded users and projects to real agents round-robin, one slot without owner', async () => {
    const { agents, total, unowned_total } = await api.listAgents();
    expect(total).toBe(6);
    expect(unowned_total).toBe(2);
    const byName = Object.fromEntries(agents.map((a) => [a.agent_name, a]));
    expect(byName['claude-code']!.owner?.name).toBe('Maya Okonkwo');
    expect(byName['claude-code']!.projects.map((p) => p.name)).toEqual(['Atlas']);
    expect(byName['windsurf']!.projects.map((p) => p.name)).toEqual(['Atlas', 'HSBC']);
    expect(byName['daily-report']!.owner).toBeNull();
    expect(byName['invoice-parser']!.display_name).toBe('invoice-parser');
    expect(byName['invoice-parser']!.spend_30d_usd).toBe(24.05);
    expect(byName['claude-code']!.models_total).toBe(40);
    expect(byName['claude-code']!.models_enabled).toBe(40);
  });

  it('persists to localStorage, reloads it, and reseeds on corrupt data', async () => {
    await api.createUser({ name: 'New Person' });
    expect(localStorage.getItem('manifest-teams-mock')).toContain('New Person');
    // A fresh module state reads the persisted store back.
    resetMockTeamsKeepStorage();
    const { users } = await api.getUsers();
    expect(users.some((u) => u.name === 'New Person')).toBe(true);

    localStorage.setItem('manifest-teams-mock', '{not json');
    resetMockTeamsKeepStorage();
    const fresh = await api.getUsers();
    expect(fresh.users.some((u) => u.name === 'New Person')).toBe(false);
    expect(fresh.users.length).toBe(4);
  });

  it('accepts a bare-array agents response and survives storage errors', async () => {
    mockGetAgents.mockResolvedValue(AGENTS.slice(0, 1));
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('quota');
    });
    try {
      const res = await api.listAgents();
      expect(res.total).toBe(1);
      resetMockTeams();
    } finally {
      setItem.mockRestore();
      removeItem.mockRestore();
    }
  });
});

describe('users', () => {
  it('lists users with agent counts, spend, sorting, search and archived filter', async () => {
    const byName = await api.getUsers();
    expect(byName.users.map((u) => u.name)).toEqual([
      'Deniz Kaya',
      'Maya Okonkwo',
      'Sara Lindqvist',
      'Tom Reyes',
    ]);
    const maya = byName.users.find((u) => u.name === 'Maya Okonkwo')!;
    expect(maya.agent_count).toBe(1);
    expect(maya.spend_month_usd).toBe(121.3);
    expect(maya.last_active_at).toBe('2026-08-27T10:00:00Z');
    expect(byName.budget_month_usd_total).toBe(500);
    expect(byName.spend_month_usd_total).toBeCloseTo(121.3 + 41.75 + 58.4 + 24.05, 2);
    expect(byName.users.find((u) => u.name === 'Deniz Kaya')!.last_active_at).toBeNull();

    const bySpend = await api.getUsers({ sort: 'spend', dir: 'desc' });
    expect(bySpend.users[0]!.name).toBe('Maya Okonkwo');
    const byLeft = await api.getUsers({ sort: 'budget_left', dir: 'asc' });
    expect(byLeft.users[0]!.name).toBe('Sara Lindqvist');
    await api.updateUser('u-tom', { monthly_budget_usd: null });
    const noBudgetLast = await api.getUsers({ sort: 'budget_left' });
    expect(noBudgetLast.users.at(-1)!.name).toBe('Tom Reyes');
    const descName = await api.getUsers({ dir: 'desc' });
    expect(descName.users[0]!.name).toBe('Tom Reyes');

    expect((await api.getUsers({ search: 'sara' })).users.map((u) => u.id)).toEqual(['u-sara']);
    await api.archiveUser('u-deniz');
    expect((await api.getUsers()).total).toBe(3);
    expect((await api.getUsers({ include_archived: true })).total).toBe(4);
    await api.unarchiveUser('u-deniz');
    expect((await api.getUsers()).total).toBe(4);
  });

  it('creates, reads, updates and deletes a user', async () => {
    const user = await api.createUser({
      name: '  Ana  ',
      email: ' ana@x.io ',
      role: '',
      monthly_budget_usd: 75,
    });
    expect(user).toMatchObject({
      name: 'Ana',
      email: 'ana@x.io',
      role: null,
      monthly_budget_usd: 75,
    });
    expect(await api.getUser(user.id)).toEqual(user);
    expect(await api.getUser('nope')).toBeNull();
    const updated = await api.updateUser(user.id, { name: 'Ana R', email: '', role: 'Ops' });
    expect(updated).toMatchObject({
      name: 'Ana R',
      email: null,
      role: 'Ops',
      monthly_budget_usd: 75,
    });
    await expect(api.updateUser('nope', {})).rejects.toThrow('User not found');
    await expect(api.archiveUser('nope')).rejects.toThrow('User not found');
    await expect(api.unarchiveUser('nope')).rejects.toThrow('User not found');
    await api.deleteUser(user.id, { agents: 'unassign' });
    expect(await api.getUser(user.id)).toBeNull();
  });

  it('deleting a user unassigns or archives their agents', async () => {
    await api.listAgents();
    await api.deleteUser('u-maya', { agents: 'unassign' });
    let team = await api.getAgentTeam('claude-code');
    expect(team.owner).toBeNull();
    expect(team.archived_at).toBeNull();
    await api.deleteUser('u-tom', { agents: 'delete' });
    team = await api.getAgentTeam('windsurf');
    expect(team.owner).toBeNull();
    expect(team.archived_at).not.toBeNull();
  });

  it('builds a user overview and removes an agent from a user', async () => {
    const overview = await api.getUserOverview('u-maya');
    expect(overview.budget_usd).toBe(200);
    expect(overview.cost_month_usd).toBe(121.3);
    expect(overview.requests).toBe(100);
    expect(overview.tokens).toBe(180000);
    expect(overview.agents.map((a) => a.agent_name)).toEqual(['claude-code']);
    expect(overview.cost_series.length).toBe(new Date().getDate());
    const sum = overview.cost_series.reduce((s, d) => s + d.cost_usd, 0);
    expect(sum).toBeCloseTo(121.3, 0);
    await expect(api.getUserOverview('nope')).rejects.toThrow('User not found');

    await api.removeAgentFromUser('u-tom', 'claude-code'); // wrong owner: no-op
    expect((await api.getAgentTeam('claude-code')).owner?.id).toBe('u-maya');
    await api.removeAgentFromUser('u-maya', 'claude-code');
    expect((await api.getAgentTeam('claude-code')).owner).toBeNull();
  });
});

describe('projects', () => {
  it('lists projects with members, recency-ordered users, sparklines and the shared marker', async () => {
    const { projects, total } = await api.getProjects();
    expect(total).toBe(5);
    const atlas = projects.find((p) => p.name === 'Atlas')!;
    expect(atlas.agent_count).toBe(2);
    expect(atlas.users.map((u) => u.name)).toEqual(['Maya Okonkwo', 'Tom Reyes']);
    expect(atlas.requests_7d.length).toBe(7);
    expect(atlas.requests_7d_total).toBe(atlas.requests_7d.reduce((a, b) => a + b, 0));
    expect(atlas.spend_month_usd).toBeCloseTo(121.3 + 41.75, 2);
    expect(atlas.spend_shared).toBe(true);
    const support = projects.find((p) => p.name === 'Support desk')!;
    expect(support.spend_shared).toBe(false);
    expect(support.spend_last_month_usd).toBeGreaterThan(0);
    const tools = projects.find((p) => p.name === 'Internal tools')!;
    expect(tools.users).toEqual([]);
    expect((await api.getProjects({ search: 'hsbc' })).projects.map((p) => p.id)).toEqual([
      'p-hsbc',
    ]);
  });

  it('creates, reads, updates, archives and deletes a project (removing its tag)', async () => {
    const project = await api.createProject({ name: ' Northstar ', description: ' Client ' });
    expect(project).toMatchObject({ name: 'Northstar', description: 'Client' });
    expect(await api.getProject(project.id)).toEqual(project);
    expect(await api.getProject('nope')).toBeNull();
    expect((await api.updateProject(project.id, { description: '' })).description).toBeNull();
    expect((await api.updateProject(project.id, { name: 'NS' })).name).toBe('NS');
    await expect(api.updateProject('nope', {})).rejects.toThrow('Project not found');
    await api.archiveProject(project.id);
    expect((await api.getProjects()).projects.some((p) => p.id === project.id)).toBe(false);
    expect(
      (await api.getProjects({ include_archived: true })).projects.some((p) => p.id === project.id),
    ).toBe(true);
    await api.unarchiveProject(project.id);
    await expect(api.archiveProject('nope')).rejects.toThrow('Project not found');
    await expect(api.unarchiveProject('nope')).rejects.toThrow('Project not found');

    await api.listAgents();
    await api.deleteProject('p-atlas');
    expect((await api.getAgentTeam('claude-code')).projects).toEqual([]);
    expect(await api.getProject('p-atlas')).toBeNull();
  });

  it('builds a project overview with cost by owner (including the no-owner bucket)', async () => {
    const overview = await api.getProjectOverview('p-hsbc');
    expect(overview.agents.map((a) => a.agent_name).sort()).toEqual(['daily-report', 'windsurf']);
    expect(overview.cost_by_owner.map((r) => r.owner?.name ?? null)).toEqual([null, 'Tom Reyes']);
    expect(overview.cost_by_owner[0]!.cost_usd).toBe(88.1);
    expect(overview.users.map((u) => u.id)).toEqual(['u-tom']);
    expect(overview.spend_shared).toBe(true);
    expect(overview.requests).toBe(250);
    expect(overview.tokens_series.length).toBe(overview.cost_series.length);
    await expect(api.getProjectOverview('nope')).rejects.toThrow('Project not found');
  });
});

describe('agents list', () => {
  it('filters by search, owner (incl. none), project, type and archived', async () => {
    expect((await api.listAgents({ search: 'CLAUDE' })).agents.map((a) => a.agent_name)).toEqual([
      'claude-code',
    ]);
    expect((await api.listAgents({ search: 'support tri' })).total).toBe(1);
    expect(
      (await api.listAgents({ owners: ['u-maya', NO_OWNER] })).agents
        .map((a) => a.agent_name)
        .sort(),
    ).toEqual(['claude-code', 'daily-report', 'zeta']);
    expect((await api.listAgents({ projects: ['p-hsbc'] })).total).toBe(2);
    expect(
      (await api.listAgents({ types: ['openclaw', 'other'] })).agents
        .map((a) => a.agent_name)
        .sort(),
    ).toEqual(['invoice-parser', 'support-triage', 'windsurf']);
    await api.archiveAgent('zeta');
    expect((await api.listAgents()).total).toBe(5);
    expect((await api.listAgents({ include_archived: true })).total).toBe(6);
    await api.unarchiveAgent('zeta');
    expect((await api.listAgents()).total).toBe(6);
  });

  it('sorts by every key in both directions and pages', async () => {
    const names = async (q: Parameters<typeof api.listAgents>[0]) =>
      (await api.listAgents(q)).agents.map((a) => a.agent_name);
    expect(await names({ sort: 'agent' })).toEqual([
      'claude-code',
      'daily-report',
      'invoice-parser',
      'support-triage',
      'windsurf',
      'zeta',
    ]);
    expect((await names({ sort: 'agent', dir: 'desc' }))[0]).toBe('zeta');
    expect((await names({ sort: 'spend_30d', dir: 'desc' }))[0]).toBe('claude-code');
    expect((await names({ sort: 'last_used', dir: 'desc' }))[0]).toBe('daily-report');
    expect((await names({ sort: 'owner' }))[0]).toBe('daily-report');
    expect((await names({ sort: 'projects', dir: 'desc' }))[0]).toBe('support-triage');
    const models = await names({ sort: 'models' });
    expect(models.length).toBe(6);
    const page = await api.listAgents({ sort: 'agent', page: 2, page_size: 4 });
    expect(page.agents.map((a) => a.agent_name)).toEqual(['windsurf', 'zeta']);
    expect(page.page).toBe(2);
    expect(page.page_size).toBe(4);
  });

  it('manages team fields, name checks and new-agent assignment', async () => {
    await api.listAgents(); // seed in canonical order
    await api.setAgentProjects('claude-code', ['p-hsbc', 'nope']);
    expect((await api.getAgentTeam('claude-code')).projects.map((p) => p.id)).toEqual(['p-hsbc']);
    // A real agent the store has never seen gets a slot on first sight.
    const team = await api.getAgentTeam('brand-new');
    expect(team.archived_at).toBeNull();

    expect(await api.checkAgentName('Claude Code', 'u-maya')).toEqual({
      available: false,
      suggestion: 'claude-code-2',
    });
    expect(await api.checkAgentName('claude-code', 'u-tom')).toEqual({
      available: true,
      suggestion: null,
    });
    expect(await api.checkAgentName('daily-report', null)).toEqual({
      available: false,
      suggestion: 'daily-report-2',
    });
    await api.assignNewAgent('daily-report-2', null, ['p-hsbc', 'nope']);
    expect(await api.checkAgentName('daily-report', null)).toEqual({
      available: false,
      suggestion: 'daily-report-2',
    });
    await api.assignNewAgent('claude-code-2', 'u-maya', []);
    mockGetAgents.mockResolvedValue({
      agents: [...AGENTS, { agent_name: 'claude-code-2', total_cost: 0 }],
    });
    expect(await api.checkAgentName('claude-code', 'u-maya')).toEqual({
      available: false,
      suggestion: 'claude-code-3',
    });
    await api.assignNewAgent('claude-code-2', 'u-maya', []);
  });
});

describe('bulk actions', () => {
  it('resolves selections by names or by query', async () => {
    expect(await api.countSelection({ kind: 'names', agent_names: ['claude-code', 'nope'] })).toBe(
      1,
    );
    expect(
      await api.countSelection({
        kind: 'query',
        query: { projects: ['p-atlas'] },
        expected_total: 2,
      }),
    ).toBe(2);
  });

  it('updates projects with a partial failure for archived agents', async () => {
    await api.listAgents(); // seed in canonical order
    await api.archiveAgent('zeta');
    const result = await api.bulkUpdateProjects(
      { kind: 'query', query: { include_archived: true }, expected_total: 6 },
      { add: ['p-tools'], remove: ['p-atlas'] },
    );
    expect(result.applied.length).toBe(5);
    expect(result.failed).toEqual([{ agent_name: 'zeta', reason: 'Agent is archived' }]);
    expect((await api.getAgentTeam('claude-code')).projects.map((p) => p.id)).toEqual(['p-tools']);
    const summary = await api.getSelectionProjects({
      kind: 'names',
      agent_names: ['claude-code', 'windsurf'],
    });
    expect(summary).toEqual({ 'p-tools': 2, 'p-hsbc': 1 });
  });

  it('copies settings, skipping the source and archived agents', async () => {
    await api.listAgents(); // seed in canonical order
    await api.updateAgentModelAccess('claude-code', 'up-ant', {
      all_models: false,
      enabled_model_ids: ['claude-haiku'],
    });
    await api.archiveAgent('zeta');
    const result = await api.bulkCopySettings(
      { kind: 'names', agent_names: ['claude-code', 'windsurf', 'zeta'] },
      'claude-code',
      { providers_and_models: true, routing: true, limits: false },
    );
    expect(result.applied).toEqual(['windsurf']);
    expect(result.failed).toEqual([
      { agent_name: 'claude-code', reason: 'Source agent skipped' },
      { agent_name: 'zeta', reason: 'Agent is archived' },
    ]);
    const copied = await api.getAgentModelAccess('windsurf');
    expect(copied.find((p) => p.user_provider_id === 'up-ant')!.all_models).toBe(false);
    // Nothing to copy when the source has no model access record.
    const noop = await api.bulkCopySettings(
      { kind: 'names', agent_names: ['windsurf'] },
      'daily-report',
      { providers_and_models: true, routing: false, limits: false },
    );
    expect(noop.applied).toEqual(['windsurf']);
  });
});

describe('model access', () => {
  it('reads models per active connection with the routing lock, defaulting to all models', async () => {
    const access = await api.getAgentModelAccess('claude-code');
    expect(access.map((p) => p.user_provider_id)).toEqual(['up-ant', 'up-oai']);
    const ant = access[0]!;
    expect(ant).toMatchObject({
      provider: 'anthropic',
      auth_type: 'subscription',
      label: 'Max',
      all_models: true,
      enabled_count: 2,
      total_count: 2,
    });
    expect(ant.models).toEqual([
      { id: 'claude-opus-5', name: 'Claude Opus 5', enabled: true, in_routing: true },
      { id: 'claude-haiku', name: 'claude-haiku', enabled: true, in_routing: false },
    ]);
    expect(access[1]!.models[0]!.in_routing).toBe(true);
    // The list row now knows the real model total.
    const row = (await api.listAgents({ search: 'claude-code' })).agents[0]!;
    expect(row.models_total).toBe(3);
    expect(row.models_enabled).toBe(3);
  });

  it('updates a partial selection, applies it to other agents, and reports the count on rows', async () => {
    const updated = await api.updateAgentModelAccess('claude-code', 'up-ant', {
      all_models: false,
      enabled_model_ids: ['claude-opus-5'],
    });
    expect(updated.all_models).toBe(false);
    expect(updated.enabled_count).toBe(1);
    expect(updated.models.find((m) => m.id === 'claude-haiku')!.enabled).toBe(false);
    const row = (await api.listAgents({ search: 'claude-code' })).agents[0]!;
    expect(row.models_enabled).toBe(1);
    await expect(
      api.updateAgentModelAccess('claude-code', 'nope', {
        all_models: true,
        enabled_model_ids: [],
      }),
    ).rejects.toThrow('Provider connection not found');

    const result = await api.applyModelAccessToAgents('claude-code', 'up-ant', [
      'claude-code',
      'windsurf',
    ]);
    expect(result).toEqual({
      applied: ['windsurf'],
      failed: [{ agent_name: 'claude-code', reason: 'Source agent skipped' }],
    });
    const target = await api.getAgentModelAccess('windsurf');
    expect(target[0]!.enabled_count).toBe(1);
    // Applying from an agent without a record copies the "all models" default.
    await api.applyModelAccessToAgents('daily-report', 'up-oai', ['zeta']);
    expect((await api.getAgentModelAccess('zeta'))[1]!.all_models).toBe(true);
  });

  it('tolerates failing provider, model and tier lookups', async () => {
    mockGetProviders.mockRejectedValue(new Error('x'));
    mockModels.mockRejectedValue(new Error('x'));
    mockTiers.mockRejectedValue(new Error('x'));
    expect(await api.getAgentModelAccess('claude-code')).toEqual([]);
  });
});

describe('grouped overview usage', () => {
  it('groups by owner, project and agent, applies filters, and keeps unknown agents unfiltered', async () => {
    const byOwner = await api.getOverviewGroupedUsage('7d', 'owner');
    expect(byOwner.tokenUsage.agents).toEqual(['Maya Okonkwo', 'No owner', 'Tom Reyes']);
    expect(byOwner.tokenUsage.timeseries[0]).toEqual({
      date: '2026-08-27',
      'Maya Okonkwo': 10,
      'Tom Reyes': 5,
      'No owner': 3,
    });
    expect(byOwner.messageUsage.timeseries[0]).toEqual({ hour: '10', 'Maya Okonkwo': 4 });

    const byProject = await api.getOverviewGroupedUsage('7d', 'project');
    expect(byProject.tokenUsage.agents).toEqual(['Atlas', 'HSBC', 'No project']);
    // windsurf carries Atlas and HSBC: counted in each.
    expect(byProject.tokenUsage.timeseries[0]).toMatchObject({
      Atlas: 15,
      HSBC: 7,
      'No project': 1,
    });

    const filtered = await api.getOverviewGroupedUsage('7d', 'agent', { owners: ['u-maya'] });
    expect(filtered.tokenUsage.agents).toEqual(['claude-code']);
    const noOwner = await api.getOverviewGroupedUsage('7d', 'agent', { owners: [NO_OWNER] });
    expect(noOwner.tokenUsage.agents).toEqual(['daily-report']);
    const project = await api.getOverviewGroupedUsage('7d', 'owner', { projects: ['p-hsbc'] });
    expect(project.tokenUsage.agents).toEqual(['No owner', 'Tom Reyes']);
    const both = await api.getOverviewGroupedUsage('7d', 'agent', {
      owners: ['u-tom'],
      projects: ['p-atlas'],
    });
    expect(both.costUsage.agents).toEqual([]);
  });
});

/** Drop the module's in-memory state but keep localStorage, to exercise reload. */
function resetMockTeamsKeepStorage() {
  const saved = localStorage.getItem('manifest-teams-mock');
  resetMockTeams();
  if (saved) localStorage.setItem('manifest-teams-mock', saved);
}
