import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetchJson = vi.fn();
const mockFetchMutate = vi.fn();
vi.mock('../../../src/services/api/core.js', () => ({
  fetchJson: (...args: unknown[]) => mockFetchJson(...args),
  fetchMutate: (...args: unknown[]) => mockFetchMutate(...args),
}));

const mockApi = { getUsers: vi.fn(), listAgents: vi.fn() };
vi.mock('../../../src/services/api/teams-mock.js', () => ({ mockTeamsApi: mockApi }));
const compatApi = { getUsers: vi.fn(), listAgents: vi.fn() };
vi.mock('../../../src/services/api/teams-compat.js', () => ({ compatTeamsApi: compatApi }));

import {
  agentListParams,
  httpTeamsApi,
  teamsApi,
  resetTeamsTransport,
  getUsers,
  listAgents,
  NO_OWNER,
  teamFilterParams,
  teamsBackendAvailable,
} from '../../../src/services/api/teams';

const body = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string);
const method = (call: unknown[]) => (call[1] as RequestInit).method;

describe('agentListParams', () => {
  it('drops empty values and joins lists', () => {
    expect(agentListParams()).toEqual({
      search: undefined,
      owners: undefined,
      projects: undefined,
      types: undefined,
      include_archived: undefined,
      sort: undefined,
      dir: undefined,
      page: undefined,
      page_size: undefined,
    });
    expect(
      agentListParams({
        search: 'cla',
        owners: ['u1', NO_OWNER],
        projects: ['p1'],
        types: ['claude-code'],
        include_archived: true,
        sort: 'spend_30d',
        dir: 'desc',
        page: 2,
        page_size: 50,
      }),
    ).toEqual({
      search: 'cla',
      owners: 'u1,none',
      projects: 'p1',
      types: 'claude-code',
      include_archived: 'true',
      sort: 'spend_30d',
      dir: 'desc',
      page: '2',
      page_size: '50',
    });
  });
});

describe('httpTeamsApi routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchJson.mockResolvedValue({});
    mockFetchMutate.mockResolvedValue({});
  });

  it('users', async () => {
    await httpTeamsApi.getUsers({
      search: 'm',
      include_archived: true,
      sort: 'spend',
      dir: 'desc',
    });
    expect(mockFetchJson).toHaveBeenLastCalledWith('/users', {
      search: 'm',
      include_archived: 'true',
      sort: 'spend',
      dir: 'desc',
    });
    await httpTeamsApi.getUsers();
    expect(mockFetchJson).toHaveBeenLastCalledWith('/users', {
      search: undefined,
      include_archived: undefined,
      sort: undefined,
      dir: undefined,
    });

    mockFetchJson.mockResolvedValueOnce({ user: { id: 'u1' } });
    expect(await httpTeamsApi.getUser('u 1')).toEqual({ id: 'u1' });
    expect(mockFetchJson).toHaveBeenLastCalledWith('/users/u%201');
    mockFetchJson.mockResolvedValueOnce(null);
    expect(await httpTeamsApi.getUser('u1')).toBeNull();

    await httpTeamsApi.createUser({ name: 'Maya' });
    expect(mockFetchMutate).toHaveBeenLastCalledWith('/users', expect.anything());
    expect(method(mockFetchMutate.mock.lastCall!)).toBe('POST');
    expect(body(mockFetchMutate.mock.lastCall!)).toEqual({ name: 'Maya' });

    await httpTeamsApi.updateUser('u1', { role: 'Eng' });
    expect(mockFetchMutate).toHaveBeenLastCalledWith('/users/u1', expect.anything());
    expect(method(mockFetchMutate.mock.lastCall!)).toBe('PATCH');

    await httpTeamsApi.archiveUser('u1');
    expect(mockFetchMutate).toHaveBeenLastCalledWith('/users/u1/archive', { method: 'POST' });
    await httpTeamsApi.unarchiveUser('u1');
    expect(mockFetchMutate).toHaveBeenLastCalledWith('/users/u1/unarchive', { method: 'POST' });
    await httpTeamsApi.deleteUser('u1', { agents: 'delete' });
    expect(mockFetchMutate).toHaveBeenLastCalledWith('/users/u1?agents=delete', {
      method: 'DELETE',
    });
    await httpTeamsApi.getUserOverview('u1');
    expect(mockFetchJson).toHaveBeenLastCalledWith('/users/u1/overview');
    await httpTeamsApi.removeAgentFromUser('u1', 'a/b');
    expect(mockFetchMutate).toHaveBeenLastCalledWith('/users/u1/agents/a%2Fb', {
      method: 'DELETE',
    });
  });

  it('projects', async () => {
    await httpTeamsApi.getProjects({ search: 'h', include_archived: true });
    expect(mockFetchJson).toHaveBeenLastCalledWith('/projects', {
      search: 'h',
      include_archived: 'true',
    });
    await httpTeamsApi.getProjects();
    expect(mockFetchJson).toHaveBeenLastCalledWith('/projects', {
      search: undefined,
      include_archived: undefined,
    });
    mockFetchJson.mockResolvedValueOnce({ project: { id: 'p1' } });
    expect(await httpTeamsApi.getProject('p1')).toEqual({ id: 'p1' });
    mockFetchJson.mockResolvedValueOnce(undefined);
    expect(await httpTeamsApi.getProject('p1')).toBeNull();
    await httpTeamsApi.createProject({ name: 'HSBC' });
    expect(mockFetchMutate).toHaveBeenLastCalledWith('/projects', expect.anything());
    await httpTeamsApi.updateProject('p1', { name: 'X' });
    expect(method(mockFetchMutate.mock.lastCall!)).toBe('PATCH');
    await httpTeamsApi.archiveProject('p1');
    expect(mockFetchMutate).toHaveBeenLastCalledWith('/projects/p1/archive', { method: 'POST' });
    await httpTeamsApi.unarchiveProject('p1');
    expect(mockFetchMutate).toHaveBeenLastCalledWith('/projects/p1/unarchive', { method: 'POST' });
    await httpTeamsApi.deleteProject('p1');
    expect(mockFetchMutate).toHaveBeenLastCalledWith('/projects/p1', { method: 'DELETE' });
    await httpTeamsApi.getProjectOverview('p1');
    expect(mockFetchJson).toHaveBeenLastCalledWith('/projects/p1/overview');
  });

  it('agents', async () => {
    await httpTeamsApi.listAgents({ search: 'x' });
    expect(mockFetchJson).toHaveBeenLastCalledWith(
      '/agents/list',
      agentListParams({ search: 'x' }),
    );
    await httpTeamsApi.listAgents();
    expect(mockFetchJson).toHaveBeenLastCalledWith('/agents/list', agentListParams({}));
    await httpTeamsApi.getAgentTeam('a');
    expect(mockFetchJson).toHaveBeenLastCalledWith('/agents/a/team');
    await httpTeamsApi.setAgentProjects('a', ['p1']);
    expect(mockFetchMutate).toHaveBeenLastCalledWith('/agents/a/projects', expect.anything());
    expect(method(mockFetchMutate.mock.lastCall!)).toBe('PUT');
    expect(body(mockFetchMutate.mock.lastCall!)).toEqual({ project_ids: ['p1'] });
    await httpTeamsApi.archiveAgent('a');
    expect(mockFetchMutate).toHaveBeenLastCalledWith('/agents/a/archive', { method: 'POST' });
    await httpTeamsApi.unarchiveAgent('a');
    expect(mockFetchMutate).toHaveBeenLastCalledWith('/agents/a/unarchive', { method: 'POST' });
    await httpTeamsApi.checkAgentName('claude', null);
    expect(mockFetchJson).toHaveBeenLastCalledWith(
      '/agents/check-name',
      { name: 'claude', owner: 'none' },
      { cache: false },
    );
    await httpTeamsApi.checkAgentName('claude', 'u1');
    expect(mockFetchJson.mock.lastCall![1]).toEqual({ name: 'claude', owner: 'u1' });
    await httpTeamsApi.assignNewAgent('a', 'u1', ['p1']);
    expect(mockFetchMutate).toHaveBeenLastCalledWith('/agents/a/team', expect.anything());
    expect(body(mockFetchMutate.mock.lastCall!)).toEqual({ owner_id: 'u1', project_ids: ['p1'] });
  });

  it('bulk', async () => {
    const selection = { kind: 'names' as const, agent_names: ['a'] };
    mockFetchMutate.mockResolvedValueOnce({ count: 3 });
    expect(await httpTeamsApi.countSelection(selection)).toBe(3);
    expect(mockFetchMutate).toHaveBeenLastCalledWith('/agents/bulk/count', expect.anything());
    mockFetchMutate.mockResolvedValueOnce(undefined);
    expect(await httpTeamsApi.countSelection(selection)).toBe(0);

    mockFetchMutate.mockResolvedValueOnce({ applied: ['a'], failed: [] });
    expect(await httpTeamsApi.bulkUpdateProjects(selection, { add: ['p1'], remove: [] })).toEqual({
      applied: ['a'],
      failed: [],
    });
    expect(body(mockFetchMutate.mock.lastCall!)).toEqual({ selection, add: ['p1'], remove: [] });
    mockFetchMutate.mockResolvedValueOnce(undefined);
    expect(await httpTeamsApi.bulkUpdateProjects(selection, { add: [], remove: [] })).toEqual({
      applied: [],
      failed: [],
    });

    const copy = { providers_and_models: true, routing: false, limits: true };
    mockFetchMutate.mockResolvedValueOnce({ applied: [], failed: [] });
    await httpTeamsApi.bulkCopySettings(selection, 'src', copy);
    expect(mockFetchMutate).toHaveBeenLastCalledWith(
      '/agents/bulk/copy-settings',
      expect.anything(),
    );
    expect(body(mockFetchMutate.mock.lastCall!)).toEqual({ selection, source_agent: 'src', copy });
    mockFetchMutate.mockResolvedValueOnce(undefined);
    expect(await httpTeamsApi.bulkCopySettings(selection, 'src', copy)).toEqual({
      applied: [],
      failed: [],
    });

    mockFetchMutate.mockResolvedValueOnce({ p1: 2 });
    expect(await httpTeamsApi.getSelectionProjects(selection)).toEqual({ p1: 2 });
    expect(mockFetchMutate).toHaveBeenLastCalledWith(
      '/agents/bulk/projects/summary',
      expect.anything(),
    );
    mockFetchMutate.mockResolvedValueOnce(undefined);
    expect(await httpTeamsApi.getSelectionProjects(selection)).toEqual({});
  });

  it('model access and grouped usage', async () => {
    await httpTeamsApi.getAgentModelAccess('a');
    expect(mockFetchJson).toHaveBeenLastCalledWith('/agents/a/model-access', undefined, {
      cache: false,
    });
    await httpTeamsApi.updateAgentModelAccess('a', 'up 1', {
      all_models: true,
      enabled_model_ids: [],
    });
    expect(mockFetchMutate).toHaveBeenLastCalledWith(
      '/agents/a/model-access/up%201',
      expect.anything(),
    );
    expect(method(mockFetchMutate.mock.lastCall!)).toBe('PUT');
    mockFetchMutate.mockResolvedValueOnce({ applied: ['b'], failed: [] });
    expect(await httpTeamsApi.applyModelAccessToAgents('a', 'up1', ['b'])).toEqual({
      applied: ['b'],
      failed: [],
    });
    expect(mockFetchMutate).toHaveBeenLastCalledWith(
      '/agents/a/model-access/up1/apply',
      expect.anything(),
    );
    expect(body(mockFetchMutate.mock.lastCall!)).toEqual({ agent_names: ['b'] });
    mockFetchMutate.mockResolvedValueOnce(undefined);
    expect(await httpTeamsApi.applyModelAccessToAgents('a', 'up1', ['b'])).toEqual({
      applied: [],
      failed: [],
    });

    await httpTeamsApi.getOverviewGroupedUsage('7d', 'owner', {
      owners: ['u1', 'none'],
      projects: [],
    });
    expect(mockFetchJson).toHaveBeenLastCalledWith('/overview/usage/by-owner', {
      range: '7d',
      owners: 'u1,none',
      projects: undefined,
    });
    await httpTeamsApi.getOverviewGroupedUsage('24h', 'agent');
    expect(mockFetchJson).toHaveBeenLastCalledWith('/overview/usage/by-agent', {
      range: '24h',
      owners: undefined,
      projects: undefined,
    });
  });
});

describe('transport switch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTeamsTransport();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetTeamsTransport();
  });

  it('uses the in-memory mock in dev and memoizes the choice', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_TEAMS_API', '');
    const api = await teamsApi();
    expect(api).toBe(mockApi);
    expect(await teamsApi()).toBe(api);
    mockApi.getUsers.mockResolvedValue({ users: [] });
    expect(await getUsers({ search: 'x' })).toEqual({ users: [] });
    expect(mockApi.getUsers).toHaveBeenCalledWith({ search: 'x' });
  });

  it('uses HTTP in production builds once the probe answers, and passes the team filters through', async () => {
    vi.stubEnv('DEV', false);
    mockFetchJson.mockResolvedValueOnce({ users: [] });
    expect(await teamsApi()).toBe(httpTeamsApi);
    expect(mockFetchJson).toHaveBeenCalledWith('/users', undefined, { cache: false });
    expect(await teamsBackendAvailable()).toBe(true);
    expect(await teamFilterParams({ owners: ['u1'] })).toEqual({ owners: ['u1'] });
    mockFetchJson.mockResolvedValue({ agents: [], total: 0 });
    await listAgents({ page: 1 });
    expect(mockFetchJson).toHaveBeenCalledWith('/agents/list', agentListParams({ page: 1 }));
  });

  it('lets a dev server target a real backend with VITE_TEAMS_API=http', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_TEAMS_API', 'http');
    expect(await teamsApi()).toBe(httpTeamsApi);
  });
});

describe('transport switch — teams backend absent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTeamsTransport();
    vi.stubEnv('DEV', false);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetTeamsTransport();
  });

  it('falls back to the compatibility transport on a 404 and strips the team filters', async () => {
    mockFetchJson.mockRejectedValueOnce(
      new Error('{"message":"Cannot GET /api/v1/users","error":"Not Found","statusCode":404}'),
    );
    expect(await teamsApi()).toBe(compatApi);
    expect(await teamsBackendAvailable()).toBe(false);
    expect(await teamFilterParams({ owners: ['u1'], projects: ['p1'] })).toEqual({});
  });

  it('keeps the HTTP transport on any other probe failure', async () => {
    mockFetchJson.mockRejectedValueOnce(new Error('API error: 503 Service Unavailable'));
    expect(await teamsApi()).toBe(httpTeamsApi);
    resetTeamsTransport();
    mockFetchJson.mockRejectedValueOnce('boom');
    expect(await teamsApi()).toBe(httpTeamsApi);
  });

  it('strips the team filters in dev, where the mock cannot filter the existing endpoints', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_TEAMS_API', '');
    expect(await teamFilterParams({ owners: ['u1'] })).toEqual({});
  });
});

describe('transport switch — 404 detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTeamsTransport();
    vi.stubEnv('DEV', false);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetTeamsTransport();
  });

  it('treats the bare fetchJson 404 as absent, and a body merely mentioning Not Found as present', async () => {
    mockFetchJson.mockRejectedValueOnce(new Error('API error: 404 Not Found'));
    expect(await teamsApi()).toBe(compatApi);
    resetTeamsTransport();
    mockFetchJson.mockRejectedValueOnce(
      new Error('{"message":"Tenant Not Found","error":"Forbidden","statusCode":403}'),
    );
    expect(await teamsApi()).toBe(httpTeamsApi);
    resetTeamsTransport();
    mockFetchJson.mockRejectedValueOnce(new Error('Cannot GET the upstream'));
    expect(await teamsApi()).toBe(httpTeamsApi);
  });
});
