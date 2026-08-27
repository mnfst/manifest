/**
 * Teams data layer: users, projects, ownership, model access, bulk actions.
 *
 * NONE of these endpoints exist on the backend yet. This module is the contract
 * the UI expects. Each function documents the route, method and payload it
 * sends and the shape it reads back, so the backend can be written against it
 * without reading the pages.
 *
 * Transport selection:
 * - Production builds always use the HTTP transport below.
 * - Dev builds (`import.meta.env.DEV`) use the in-memory mock in
 *   `teams-mock.ts` so every screen renders and behaves in the browser. Set
 *   `VITE_TEAMS_API=http` to hit a real backend from the dev server once the
 *   endpoints land. The mock is loaded through a dynamic import inside the
 *   DEV branch, so Vite drops it from production bundles.
 *
 * Vocabulary (matches the spec):
 * - A "user" is a person in the company with a monthly budget. Not a login.
 *   The login is the "account".
 * - The user attached to an agent is its "owner". An agent has one owner or none.
 * - A "project" is a tag an agent carries. Many-to-many with agents.
 */
import { fetchJson, fetchMutate } from './core.js';

/* ── Shared shapes ─────────────────────────────────────────────────── */

export interface UserRef {
  id: string;
  name: string;
  /** Set when the user was archived. Filters still resolve archived users. */
  archived_at?: string | null;
}

export interface ProjectRef {
  id: string;
  name: string;
  archived_at?: string | null;
}

/** Sentinel value for "agents without an owner" in owner filters. */
export const NO_OWNER = 'none';

export interface TeamUser {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  /** Monthly budget in USD. `null` means no budget. */
  monthly_budget_usd: number | null;
  archived_at: string | null;
  created_at: string;
}

export interface TeamUserRow extends TeamUser {
  agent_count: number;
  /** Spend since the first of the current month, USD. */
  spend_month_usd: number;
  last_active_at: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface ProjectRow extends Project {
  agent_count: number;
  /** Users owning at least one agent on the project, most recent activity first. */
  users: UserRef[];
  /** Requests per day for the last 7 days, oldest first. */
  requests_7d: number[];
  requests_7d_total: number;
  spend_month_usd: number;
  spend_last_month_usd: number;
  /**
   * True when at least one agent on this project also carries another project.
   * Its cost is then counted in each project it carries (no split is invented).
   * See the "counted in each project" marker in the UI.
   */
  spend_shared: boolean;
}

export interface AgentRow {
  agent_name: string;
  display_name: string;
  agent_platform: string | null;
  agent_category: string | null;
  owner: UserRef | null;
  projects: ProjectRef[];
  models_enabled: number;
  models_total: number;
  spend_30d_usd: number;
  request_count: number;
  last_used_at: string | null;
  archived_at: string | null;
}

export type AgentSortKey = 'agent' | 'owner' | 'projects' | 'models' | 'spend_30d' | 'last_used';

export interface AgentListQuery {
  search?: string;
  /** User ids. Include {@link NO_OWNER} to include agents without an owner. */
  owners?: string[];
  projects?: string[];
  /** Agent platform ids (see `AGENT_PLATFORMS` in manifest-shared). */
  types?: string[];
  include_archived?: boolean;
  sort?: AgentSortKey;
  dir?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

export interface AgentListResponse {
  agents: AgentRow[];
  /** Total rows matching the query (all pages). */
  total: number;
  /** Agents without an owner across the tenant, ignoring the query. */
  unowned_total: number;
  page: number;
  page_size: number;
}

/**
 * A bulk selection is either an explicit list of agents ("select all on this
 * page" or hand-picked rows) or the whole result of a query ("select all
 * 1,148"). `expected_total` lets the backend refuse when the result set moved
 * under the user.
 */
export type BulkSelection =
  | { kind: 'names'; agent_names: string[] }
  | { kind: 'query'; query: AgentListQuery; expected_total: number };

export interface BulkFailure {
  agent_name: string;
  reason: string;
}

export interface BulkResult {
  applied: string[];
  failed: BulkFailure[];
}

export interface CopySettingsOptions {
  providers_and_models: boolean;
  routing: boolean;
  limits: boolean;
}

export interface ModelAccessModel {
  id: string;
  name: string;
  enabled: boolean;
  /** Assigned to a routing tier or fallback. Cannot be turned off. */
  in_routing: boolean;
}

export interface ProviderModelAccess {
  /** Tenant provider connection id (same id `enabled-providers` uses). */
  user_provider_id: string;
  provider: string;
  auth_type: string;
  label: string;
  provider_enabled: boolean;
  /**
   * Master switch. When true every model of the provider is allowed, including
   * models published after this was set. When false only `models[].enabled`
   * applies and a newly published model arrives off.
   */
  all_models: boolean;
  models: ModelAccessModel[];
  enabled_count: number;
  total_count: number;
}

export interface UserOverview {
  cost_month_usd: number;
  cost_trend_pct: number;
  budget_usd: number | null;
  requests: number;
  tokens: number;
  /** Daily cost since the first of the month, oldest first. */
  cost_series: Array<{ date: string; cost_usd: number }>;
  agents: AgentRow[];
}

export interface ProjectOverview {
  cost_month_usd: number;
  cost_trend_pct: number;
  cost_last_month_usd: number;
  requests: number;
  tokens: number;
  cost_series: Array<{ date: string; cost_usd: number }>;
  tokens_series: Array<{ date: string; tokens: number }>;
  /** Cost by owner for the month; `owner: null` is the no-owner bucket. */
  cost_by_owner: Array<{ owner: UserRef | null; cost_usd: number }>;
  agents: AgentRow[];
  users: TeamUserRow[];
  /** See {@link ProjectRow.spend_shared}. */
  spend_shared: boolean;
}

export interface UserListQuery {
  search?: string;
  include_archived?: boolean;
  sort?: 'name' | 'spend' | 'budget_left';
  dir?: 'asc' | 'desc';
}

export interface UserListResponse {
  users: TeamUserRow[];
  total: number;
  spend_month_usd_total: number;
  budget_month_usd_total: number;
}

export interface ProjectListQuery {
  search?: string;
  include_archived?: boolean;
}

export interface ProjectListResponse {
  projects: ProjectRow[];
  total: number;
}

export interface CreateUserParams {
  name: string;
  email?: string | null;
  role?: string | null;
  monthly_budget_usd?: number | null;
}

export type UpdateUserParams = Partial<CreateUserParams>;

export interface CreateProjectParams {
  name: string;
  description?: string | null;
}

export type UpdateProjectParams = Partial<CreateProjectParams>;

export interface AgentNameCheck {
  available: boolean;
  /** A free name in the same owner scope, offered when `available` is false. */
  suggestion: string | null;
}

/** Filters shared by the Overview and Requests pages. */
export interface OwnerProjectFilter {
  owners?: string[];
  projects?: string[];
}

export interface GroupedUsageTimeseries {
  tokenUsage: GroupedSeries;
  messageUsage: GroupedSeries;
  costUsage: GroupedSeries;
}

export interface GroupedSeries {
  /** Series keys: owner names / project names ("No owner" for the unowned bucket). */
  agents: string[];
  timeseries: Array<Record<string, number | string>>;
}

/* ── The API surface ───────────────────────────────────────────────── */

export interface TeamsApi {
  // Users
  getUsers(query?: UserListQuery): Promise<UserListResponse>;
  getUser(id: string): Promise<TeamUser | null>;
  createUser(params: CreateUserParams): Promise<TeamUser>;
  updateUser(id: string, params: UpdateUserParams): Promise<TeamUser>;
  archiveUser(id: string): Promise<TeamUser>;
  unarchiveUser(id: string): Promise<TeamUser>;
  /** Refused with an error while the user still owns agents unless `agents` says what to do. */
  deleteUser(id: string, options: { agents: 'unassign' | 'delete' }): Promise<void>;
  getUserOverview(id: string): Promise<UserOverview>;
  removeAgentFromUser(userId: string, agentName: string): Promise<void>;

  // Projects
  getProjects(query?: ProjectListQuery): Promise<ProjectListResponse>;
  getProject(id: string): Promise<Project | null>;
  createProject(params: CreateProjectParams): Promise<Project>;
  updateProject(id: string, params: UpdateProjectParams): Promise<Project>;
  archiveProject(id: string): Promise<Project>;
  unarchiveProject(id: string): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  getProjectOverview(id: string): Promise<ProjectOverview>;

  // Agents
  listAgents(query?: AgentListQuery): Promise<AgentListResponse>;
  getAgentTeam(agentName: string): Promise<Pick<AgentRow, 'owner' | 'projects' | 'archived_at'>>;
  setAgentProjects(agentName: string, projectIds: string[]): Promise<void>;
  archiveAgent(agentName: string): Promise<void>;
  unarchiveAgent(agentName: string): Promise<void>;
  checkAgentName(name: string, ownerId: string | null): Promise<AgentNameCheck>;
  /** Creation attaches owner + projects; the existing POST /agents handles the rest. */
  assignNewAgent(agentName: string, ownerId: string | null, projectIds: string[]): Promise<void>;

  // Bulk
  countSelection(selection: BulkSelection): Promise<number>;
  bulkUpdateProjects(
    selection: BulkSelection,
    change: { add: string[]; remove: string[] },
  ): Promise<BulkResult>;
  bulkCopySettings(
    selection: BulkSelection,
    source_agent: string,
    copy: CopySettingsOptions,
  ): Promise<BulkResult>;
  /** Projects each selected agent carries, for the tri-state editor. */
  getSelectionProjects(selection: BulkSelection): Promise<Record<string, number>>;

  // Model access
  getAgentModelAccess(agentName: string): Promise<ProviderModelAccess[]>;
  updateAgentModelAccess(
    agentName: string,
    userProviderId: string,
    change: { all_models: boolean; enabled_model_ids: string[] },
  ): Promise<ProviderModelAccess>;
  applyModelAccessToAgents(
    agentName: string,
    userProviderId: string,
    targetAgentNames: string[],
  ): Promise<BulkResult>;

  // Overview grouping. `agent` is the existing per-agent usage with the
  // owner/project filters applied; `owner` and `project` aggregate it.
  getOverviewGroupedUsage(
    range: string,
    groupBy: OverviewGroupBy,
    filter?: OwnerProjectFilter,
  ): Promise<GroupedUsageTimeseries>;
}

export type OverviewGroupBy = 'agent' | 'owner' | 'project';

/* ── HTTP transport ────────────────────────────────────────────────── */

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const patch = (body: unknown): RequestInit => ({ ...json(body), method: 'PATCH' });
const put = (body: unknown): RequestInit => ({ ...json(body), method: 'PUT' });

const listParam = (values?: string[]): string | undefined =>
  values && values.length ? values.join(',') : undefined;

export function agentListParams(query: AgentListQuery = {}): Record<string, string | undefined> {
  return {
    search: query.search || undefined,
    owners: listParam(query.owners),
    projects: listParam(query.projects),
    types: listParam(query.types),
    include_archived: query.include_archived ? 'true' : undefined,
    sort: query.sort,
    dir: query.dir,
    page: query.page ? String(query.page) : undefined,
    page_size: query.page_size ? String(query.page_size) : undefined,
  };
}

const userId = (id: string) => `/users/${encodeURIComponent(id)}`;
const projectId = (id: string) => `/projects/${encodeURIComponent(id)}`;
const agentId = (name: string) => `/agents/${encodeURIComponent(name)}`;

/** Mutations must not be served from the SWR GET cache; `fetchMutate` already bypasses it. */
export const httpTeamsApi: TeamsApi = {
  // GET /api/v1/users?search=&include_archived=&sort=&dir=
  getUsers: (query = {}) =>
    fetchJson<UserListResponse>('/users', {
      search: query.search || undefined,
      include_archived: query.include_archived ? 'true' : undefined,
      sort: query.sort,
      dir: query.dir,
    }),
  // GET /api/v1/users/:id → { user: TeamUser | null }
  getUser: (id) => fetchJson<{ user: TeamUser | null }>(userId(id)).then((r) => r?.user ?? null),
  // POST /api/v1/users { name, email?, role?, monthly_budget_usd? }
  createUser: (params) => fetchMutate<TeamUser>('/users', json(params)),
  // PATCH /api/v1/users/:id
  updateUser: (id, params) => fetchMutate<TeamUser>(userId(id), patch(params)),
  // POST /api/v1/users/:id/archive
  archiveUser: (id) => fetchMutate<TeamUser>(`${userId(id)}/archive`, { method: 'POST' }),
  // POST /api/v1/users/:id/unarchive
  unarchiveUser: (id) => fetchMutate<TeamUser>(`${userId(id)}/unarchive`, { method: 'POST' }),
  // DELETE /api/v1/users/:id?agents=unassign|delete
  deleteUser: (id, options) =>
    fetchMutate<void>(`${userId(id)}?agents=${options.agents}`, { method: 'DELETE' }),
  // GET /api/v1/users/:id/overview
  getUserOverview: (id) => fetchJson<UserOverview>(`${userId(id)}/overview`),
  // DELETE /api/v1/users/:id/agents/:agentName  (sets the agent's owner to null)
  removeAgentFromUser: (id, agentName) =>
    fetchMutate<void>(`${userId(id)}/agents/${encodeURIComponent(agentName)}`, {
      method: 'DELETE',
    }),

  // GET /api/v1/projects?search=&include_archived=
  getProjects: (query = {}) =>
    fetchJson<ProjectListResponse>('/projects', {
      search: query.search || undefined,
      include_archived: query.include_archived ? 'true' : undefined,
    }),
  // GET /api/v1/projects/:id → { project: Project | null }
  getProject: (id) =>
    fetchJson<{ project: Project | null }>(projectId(id)).then((r) => r?.project ?? null),
  // POST /api/v1/projects { name, description? }
  createProject: (params) => fetchMutate<Project>('/projects', json(params)),
  // PATCH /api/v1/projects/:id
  updateProject: (id, params) => fetchMutate<Project>(projectId(id), patch(params)),
  // POST /api/v1/projects/:id/archive
  archiveProject: (id) => fetchMutate<Project>(`${projectId(id)}/archive`, { method: 'POST' }),
  // POST /api/v1/projects/:id/unarchive
  unarchiveProject: (id) => fetchMutate<Project>(`${projectId(id)}/unarchive`, { method: 'POST' }),
  // DELETE /api/v1/projects/:id
  deleteProject: (id) => fetchMutate<void>(projectId(id), { method: 'DELETE' }),
  // GET /api/v1/projects/:id/overview
  getProjectOverview: (id) => fetchJson<ProjectOverview>(`${projectId(id)}/overview`),

  // GET /api/v1/agents/list?search=&owners=&projects=&types=&include_archived=&sort=&dir=&page=&page_size=
  // (a sibling of the existing GET /agents, which keeps its sparkline shape)
  listAgents: (query = {}) => fetchJson<AgentListResponse>('/agents/list', agentListParams(query)),
  // GET /api/v1/agents/:name/team → { owner, projects, archived_at }
  getAgentTeam: (name) =>
    fetchJson<Pick<AgentRow, 'owner' | 'projects' | 'archived_at'>>(`${agentId(name)}/team`),
  // PUT /api/v1/agents/:name/projects { project_ids }
  setAgentProjects: (name, projectIds) =>
    fetchMutate<void>(`${agentId(name)}/projects`, put({ project_ids: projectIds })),
  // POST /api/v1/agents/:name/archive
  archiveAgent: (name) => fetchMutate<void>(`${agentId(name)}/archive`, { method: 'POST' }),
  // POST /api/v1/agents/:name/unarchive
  unarchiveAgent: (name) => fetchMutate<void>(`${agentId(name)}/unarchive`, { method: 'POST' }),
  // GET /api/v1/agents/check-name?name=&owner= → { available, suggestion }
  checkAgentName: (name, ownerId) =>
    fetchJson<AgentNameCheck>(
      '/agents/check-name',
      { name, owner: ownerId ?? NO_OWNER },
      { cache: false },
    ),
  // PUT /api/v1/agents/:name/team { owner_id, project_ids } — owner is set once, at creation.
  assignNewAgent: (name, ownerId, projectIds) =>
    fetchMutate<void>(`${agentId(name)}/team`, put({ owner_id: ownerId, project_ids: projectIds })),

  // POST /api/v1/agents/bulk/count { selection } → { count }
  countSelection: (selection) =>
    fetchMutate<{ count: number }>('/agents/bulk/count', json({ selection })).then(
      (r) => r?.count ?? 0,
    ),
  // POST /api/v1/agents/bulk/projects { selection, add, remove } → BulkResult
  bulkUpdateProjects: (selection, change) =>
    fetchMutate<BulkResult>('/agents/bulk/projects', json({ selection, ...change })).then(
      (r) => r ?? { applied: [], failed: [] },
    ),
  // POST /api/v1/agents/bulk/copy-settings { selection, source_agent, copy } → BulkResult
  bulkCopySettings: (selection, source_agent, copy) =>
    fetchMutate<BulkResult>(
      '/agents/bulk/copy-settings',
      json({ selection, source_agent, copy }),
    ).then((r) => r ?? { applied: [], failed: [] }),
  // POST /api/v1/agents/bulk/projects/summary { selection } → { [project_id]: agent_count }
  getSelectionProjects: (selection) =>
    fetchMutate<Record<string, number>>('/agents/bulk/projects/summary', json({ selection })).then(
      (r) => r ?? {},
    ),

  // GET /api/v1/agents/:name/model-access → ProviderModelAccess[]
  getAgentModelAccess: (name) =>
    fetchJson<ProviderModelAccess[]>(`${agentId(name)}/model-access`, undefined, { cache: false }),
  // PUT /api/v1/agents/:name/model-access/:userProviderId { all_models, enabled_model_ids }
  updateAgentModelAccess: (name, userProviderId, change) =>
    fetchMutate<ProviderModelAccess>(
      `${agentId(name)}/model-access/${encodeURIComponent(userProviderId)}`,
      put(change),
    ),
  // POST /api/v1/agents/:name/model-access/:userProviderId/apply { agent_names } → BulkResult
  applyModelAccessToAgents: (name, userProviderId, targetAgentNames) =>
    fetchMutate<BulkResult>(
      `${agentId(name)}/model-access/${encodeURIComponent(userProviderId)}/apply`,
      json({ agent_names: targetAgentNames }),
    ).then((r) => r ?? { applied: [], failed: [] }),

  // GET /api/v1/overview/usage/by-agent?range=&owners=&projects=   (existing agent usage + filters)
  // GET /api/v1/overview/usage/by-owner?range=&owners=&projects=
  // GET /api/v1/overview/usage/by-project?range=&owners=&projects=
  getOverviewGroupedUsage: (range, groupBy, filter = {}) =>
    fetchJson<GroupedUsageTimeseries>(`/overview/usage/by-${groupBy}`, {
      range,
      owners: listParam(filter.owners),
      projects: listParam(filter.projects),
    }),
};

/* ── Transport switch ──────────────────────────────────────────────── */

let transportPromise: Promise<TeamsApi> | null = null;

export function teamsApi(): Promise<TeamsApi> {
  if (!transportPromise) {
    transportPromise =
      import.meta.env.DEV && import.meta.env.VITE_TEAMS_API !== 'http'
        ? import('./teams-mock.js').then((m) => m.mockTeamsApi)
        : Promise.resolve(httpTeamsApi);
  }
  return transportPromise;
}

/** Test hook: forget the resolved transport so env stubs take effect. */
export function resetTeamsTransport(): void {
  transportPromise = null;
}

/** Delegate one method to whichever transport is active. */
function call<K extends keyof TeamsApi>(key: K): TeamsApi[K] {
  const delegate = (...args: unknown[]) =>
    teamsApi().then((api) => (api[key] as unknown as (...a: unknown[]) => unknown)(...args));
  return delegate as unknown as TeamsApi[K];
}

export const getUsers = call('getUsers');
export const getUser = call('getUser');
export const createUser = call('createUser');
export const updateUser = call('updateUser');
export const archiveUser = call('archiveUser');
export const unarchiveUser = call('unarchiveUser');
export const deleteUser = call('deleteUser');
export const getUserOverview = call('getUserOverview');
export const removeAgentFromUser = call('removeAgentFromUser');
export const getProjects = call('getProjects');
export const getProject = call('getProject');
export const createProject = call('createProject');
export const updateProject = call('updateProject');
export const archiveProject = call('archiveProject');
export const unarchiveProject = call('unarchiveProject');
export const deleteProject = call('deleteProject');
export const getProjectOverview = call('getProjectOverview');
export const listAgents = call('listAgents');
export const getAgentTeam = call('getAgentTeam');
export const setAgentProjects = call('setAgentProjects');
export const archiveAgent = call('archiveAgent');
export const unarchiveAgent = call('unarchiveAgent');
export const checkAgentName = call('checkAgentName');
export const assignNewAgent = call('assignNewAgent');
export const countSelection = call('countSelection');
export const bulkUpdateProjects = call('bulkUpdateProjects');
export const bulkCopySettings = call('bulkCopySettings');
export const getSelectionProjects = call('getSelectionProjects');
export const getAgentModelAccess = call('getAgentModelAccess');
export const updateAgentModelAccess = call('updateAgentModelAccess');
export const applyModelAccessToAgents = call('applyModelAccessToAgents');
export const getOverviewGroupedUsage = call('getOverviewGroupedUsage');
