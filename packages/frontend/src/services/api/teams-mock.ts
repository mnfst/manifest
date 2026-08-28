/**
 * Dev-only in-memory transport for the teams data layer (see `teams.ts`).
 *
 * It exists so every teams screen renders and behaves in the browser before
 * the backend endpoints land. Production builds never load this module: the
 * only import is a dynamic import inside an `import.meta.env.DEV` branch.
 *
 * What is real and what is derived:
 * - Agents come from the real `GET /agents` endpoint. Their spend, request
 *   count, last activity and sparkline are the real values.
 * - Users, projects, ownership, project membership, archive state and model
 *   access live in this store, persisted to `localStorage` under
 *   `manifest-teams-mock` so a dev's edits survive a reload.
 * - On first load, seeded users and projects are assigned to the existing
 *   agents round-robin (one slot stays "no owner") so the screens show the
 *   multi-user case. Day-one on a real backend: every agent has no owner and
 *   the Users page is empty.
 * - Model lists come from the real `available-models` endpoint; the
 *   "in routing" lock reads the real tier assignments.
 * - Daily series (user cost vs budget, project cost/tokens, 7-day requests)
 *   are deterministic pseudo-random curves scaled to the real totals.
 */
import { getAgents } from './agents.js';
import { getOverviewAgentUsage } from './analytics.js';
import { getProviders } from './providers.js';
import { getAvailableModels, getTierAssignments } from './routing.js';
import {
  buildModelAccess,
  enabledModelCount,
  matchesQuery,
  paginate,
  regroupUsage,
  sortRows,
  unwrapAgents,
  type RealAgent,
} from './teams-derive.js';
import {
  type AgentRow,
  type BulkResult,
  type BulkSelection,
  type GroupedUsageTimeseries,
  type Project,
  type ProjectRef,
  type ProjectRow,
  type ProviderModelAccess,
  type TeamUser,
  type TeamUserRow,
  type TeamsApi,
  type UserRef,
} from './teams.js';

const STORAGE_KEY = 'manifest-teams-mock';

interface AgentAssignment {
  owner_id: string | null;
  project_ids: string[];
  archived_at: string | null;
}

interface ModelAccessState {
  all_models: boolean;
  enabled: string[];
}

interface MockState {
  users: TeamUser[];
  projects: Project[];
  agents: Record<string, AgentAssignment>;
  modelAccess: Record<string, Record<string, ModelAccessState>>;
  /** Agent names seeded so far; a new real agent arrives with no owner. */
  seededAgents: string[];
  /**
   * Agents "deleted" through the mock (a user deletion with `agents: 'delete'`).
   * The real `GET /agents` still returns them, so the mock hides them
   * everywhere instead; on a real backend the rows, keys and history are gone.
   */
  deletedAgents: string[];
}

/* ── Seed ──────────────────────────────────────────────────────────── */

const SEED_AT = '2026-08-01T09:00:00.000Z';

const SEED_USERS: TeamUser[] = [
  {
    id: 'u-maya',
    name: 'Maya Okonkwo',
    email: 'maya@example.com',
    role: 'Engineering',
    monthly_budget_usd: 200,
    archived_at: null,
    created_at: SEED_AT,
  },
  {
    id: 'u-tom',
    name: 'Tom Reyes',
    email: null,
    role: 'Engineering',
    monthly_budget_usd: 200,
    archived_at: null,
    created_at: SEED_AT,
  },
  {
    id: 'u-sara',
    name: 'Sara Lindqvist',
    email: 'sara@example.com',
    role: 'Support',
    monthly_budget_usd: 50,
    archived_at: null,
    created_at: SEED_AT,
  },
  {
    id: 'u-deniz',
    name: 'Deniz Kaya',
    email: null,
    role: 'Marketing',
    monthly_budget_usd: 50,
    archived_at: null,
    created_at: SEED_AT,
  },
];

const SEED_PROJECTS: Project[] = [
  {
    id: 'p-hsbc',
    name: 'HSBC',
    description: 'Client engagement',
    archived_at: null,
    created_at: SEED_AT,
  },
  {
    id: 'p-atlas',
    name: 'Atlas',
    description: 'Internal platform',
    archived_at: null,
    created_at: SEED_AT,
  },
  {
    id: 'p-northwind',
    name: 'Northwind',
    description: 'Client engagement',
    archived_at: null,
    created_at: SEED_AT,
  },
  {
    id: 'p-support',
    name: 'Support desk',
    description: 'Internal',
    archived_at: null,
    created_at: SEED_AT,
  },
  {
    id: 'p-tools',
    name: 'Internal tools',
    description: null,
    archived_at: null,
    created_at: SEED_AT,
  },
];

/** Round-robin slots: owner + projects for the i-th seeded agent. */
const SEED_SLOTS: Array<{ owner: string | null; projects: string[] }> = [
  { owner: 'u-maya', projects: ['p-atlas'] },
  { owner: 'u-tom', projects: ['p-atlas', 'p-hsbc'] },
  { owner: 'u-sara', projects: ['p-support'] },
  { owner: null, projects: ['p-hsbc'] },
  { owner: 'u-deniz', projects: [] },
  { owner: null, projects: [] },
];

const freshState = (): MockState => ({
  users: SEED_USERS.map((u) => ({ ...u })),
  projects: SEED_PROJECTS.map((p) => ({ ...p })),
  agents: {},
  modelAccess: {},
  seededAgents: [],
  deletedAgents: [],
});

let state: MockState | null = null;

function load(): MockState {
  if (state) return state;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MockState>;
      state = { ...freshState(), ...parsed };
      return state;
    }
  } catch {
    /* ignore a corrupt store; reseed */
  }
  state = freshState();
  return state;
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage may be unavailable */
  }
}

/** Test hook: drop the in-memory and persisted state. */
export function resetMockTeams(): void {
  state = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/* ── Helpers ───────────────────────────────────────────────────────── */

const now = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

/** Deterministic 0..1 from a string + index, for stable mock curves. */
function noise(seed: string, i: number): number {
  let h = 2166136261;
  const s = `${seed}:${i}`;
  for (let k = 0; k < s.length; k++) {
    h ^= s.charCodeAt(k);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function daysThisMonth(): string[] {
  const d = new Date();
  const days: string[] = [];
  for (let day = 1; day <= d.getDate(); day++) {
    days.push(new Date(Date.UTC(d.getFullYear(), d.getMonth(), day)).toISOString().slice(0, 10));
  }
  return days;
}

function dailySeries(seed: string, total: number, days: string[]): number[] {
  const weights = days.map((_, i) => 0.4 + noise(seed, i));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map((w) => Math.round((w / sum) * total * 100) / 100);
}

function userRef(u: TeamUser): UserRef {
  return { id: u.id, name: u.name, archived_at: u.archived_at };
}

function projectRef(p: Project): ProjectRef {
  return { id: p.id, name: p.name, archived_at: p.archived_at };
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

async function realAgents(): Promise<RealAgent[]> {
  return unwrapAgents(await getAgents());
}

/** Ensure every real agent has an assignment; seed the first ones round-robin. */
function assignmentFor(s: MockState, name: string): AgentAssignment {
  const existing = s.agents[name];
  if (existing) return existing;
  const slot = SEED_SLOTS[s.seededAgents.length % SEED_SLOTS.length]!;
  const created: AgentAssignment = {
    owner_id: slot.owner,
    project_ids: [...slot.projects],
    archived_at: null,
  };
  s.agents[name] = created;
  s.seededAgents.push(name);
  save();
  return created;
}

function toRow(
  s: MockState,
  agent: RealAgent,
  models?: { enabled: number; total: number },
): AgentRow {
  const a = assignmentFor(s, agent.agent_name);
  const owner = s.users.find((u) => u.id === a.owner_id) ?? null;
  const projects = a.project_ids
    .map((id) => s.projects.find((p) => p.id === id))
    .filter((p): p is Project => !!p)
    .map(projectRef);
  const total = models?.total ?? modelTotalFor(s, agent.agent_name);
  const enabled = models?.enabled ?? enabledModelCountFor(s, agent.agent_name, total);
  return {
    agent_name: agent.agent_name,
    display_name: agent.display_name || agent.agent_name,
    agent_platform: agent.agent_platform ?? null,
    agent_category: agent.agent_category ?? null,
    owner: owner ? userRef(owner) : null,
    projects,
    models_enabled: enabled,
    models_total: total,
    spend_30d_usd: Number(agent.total_cost ?? 0),
    request_count: Number(agent.message_count ?? 0),
    last_used_at: agent.last_active ?? null,
    archived_at: a.archived_at,
  };
}

// Model counts per connection are only known after a model-access read; keep
// the last seen totals so list rows can show "12 of 40" without a per-row
// round trip. Keyed by agent, then by connection id.
const modelTotals: Record<string, Record<string, number>> = {};

/** 40 is a placeholder total until a model-access read reports the real one. */
function modelTotalFor(_s: MockState, name: string): number {
  const perConnection = modelTotals[name];
  if (!perConnection) return 40;
  return Object.values(perConnection).reduce((sum, n) => sum + n, 0);
}

/**
 * Enabled models across every connection: a connection on "all models" (or
 * one without a record) counts its whole total, a restricted one counts its
 * selection. Without per-connection totals the answer is the total.
 */
function enabledModelCountFor(s: MockState, name: string, total: number): number {
  return enabledModelCount(s.modelAccess[name], modelTotals[name], total);
}

async function allRows(s: MockState): Promise<AgentRow[]> {
  const agents = await realAgents();
  const deleted = new Set(s.deletedAgents);
  return agents.filter((a) => !deleted.has(a.agent_name)).map((a) => toRow(s, a));
}

async function resolveSelection(s: MockState, selection: BulkSelection): Promise<AgentRow[]> {
  const rows = await allRows(s);
  if (selection.kind === 'names') {
    const wanted = new Set(selection.agent_names);
    return rows.filter((r) => wanted.has(r.agent_name));
  }
  const matching = rows.filter((r) => matchesQuery(r, selection.query));
  // "Select all 1,148" was made against a result set; if it moved under the
  // user, refuse rather than act on agents they never saw.
  if (matching.length !== selection.expected_total) {
    throw new Error(
      `The selection changed: ${matching.length} agents match now, ${selection.expected_total} were selected. Select again.`,
    );
  }
  return matching;
}

function monthSpend(rows: AgentRow[]): number {
  return Math.round(rows.reduce((sum, r) => sum + r.spend_30d_usd, 0) * 100) / 100;
}

/* ── The mock API ──────────────────────────────────────────────────── */

export const mockTeamsApi: TeamsApi = {
  async getUsers(query = {}) {
    const s = load();
    const rows = await allRows(s);
    let users: TeamUserRow[] = s.users
      .filter((u) => query.include_archived || !u.archived_at)
      .filter((u) => !query.search || u.name.toLowerCase().includes(query.search.toLowerCase()))
      .map((u) => {
        const owned = rows.filter((r) => r.owner?.id === u.id && !r.archived_at);
        const last = owned
          .map((r) => r.last_used_at)
          .filter((v): v is string => !!v)
          .sort()
          .at(-1);
        return {
          ...u,
          agent_count: owned.length,
          spend_month_usd: monthSpend(owned),
          last_active_at: last ?? null,
        };
      });
    const dir = query.dir === 'desc' ? -1 : 1;
    if (query.sort === 'spend') {
      users = users.sort((a, b) => (a.spend_month_usd - b.spend_month_usd) * dir);
    } else if (query.sort === 'budget_left') {
      const left = (u: TeamUserRow) =>
        u.monthly_budget_usd == null
          ? Number.POSITIVE_INFINITY
          : u.monthly_budget_usd - u.spend_month_usd;
      users = users.sort((a, b) => (left(a) - left(b)) * dir);
    } else {
      users = users.sort((a, b) => a.name.localeCompare(b.name) * dir);
    }
    const active = s.users.filter((u) => !u.archived_at);
    return {
      users,
      total: users.length,
      spend_month_usd_total: monthSpend(rows.filter((r) => r.owner && !r.archived_at)),
      budget_month_usd_total: active.reduce((sum, u) => sum + (u.monthly_budget_usd ?? 0), 0),
    };
  },

  async getUser(id) {
    return load().users.find((u) => u.id === id) ?? null;
  },

  async createUser(params) {
    const s = load();
    const user: TeamUser = {
      id: newId('u'),
      name: params.name.trim(),
      email: params.email?.trim() || null,
      role: params.role?.trim() || null,
      monthly_budget_usd: params.monthly_budget_usd ?? null,
      archived_at: null,
      created_at: now(),
    };
    s.users.push(user);
    save();
    return user;
  },

  async updateUser(id, params) {
    const s = load();
    const user = s.users.find((u) => u.id === id);
    if (!user) throw new Error('User not found');
    if (params.name !== undefined) user.name = params.name.trim();
    if (params.email !== undefined) user.email = params.email?.trim() || null;
    if (params.role !== undefined) user.role = params.role?.trim() || null;
    if (params.monthly_budget_usd !== undefined)
      user.monthly_budget_usd = params.monthly_budget_usd;
    save();
    return user;
  },

  async archiveUser(id) {
    const s = load();
    const user = s.users.find((u) => u.id === id);
    if (!user) throw new Error('User not found');
    user.archived_at = now();
    save();
    return user;
  },

  async unarchiveUser(id) {
    const s = load();
    const user = s.users.find((u) => u.id === id);
    if (!user) throw new Error('User not found');
    user.archived_at = null;
    save();
    return user;
  },

  async deleteUser(id, options) {
    const s = load();
    for (const [name, a] of Object.entries(s.agents)) {
      if (a.owner_id !== id) continue;
      if (options.agents === 'delete') {
        // The real backend deletes the agent rows, keys and history. The mock
        // cannot touch the real GET /agents, so it hides the agent everywhere
        // and drops its assignment and model access.
        if (!s.deletedAgents.includes(name)) s.deletedAgents.push(name);
        delete s.agents[name];
        delete s.modelAccess[name];
        continue;
      }
      a.owner_id = null;
      s.agents[name] = a;
    }
    s.users = s.users.filter((u) => u.id !== id);
    save();
  },

  async getUserOverview(id) {
    const s = load();
    const user = s.users.find((u) => u.id === id);
    if (!user) throw new Error('User not found');
    const rows = await allRows(s);
    const owned = rows.filter((r) => r.owner?.id === id && !r.archived_at);
    const cost = monthSpend(owned);
    const days = daysThisMonth();
    const series = dailySeries(id, cost, days);
    return {
      cost_month_usd: cost,
      cost_trend_pct: Math.round((noise(id, 99) - 0.3) * 60),
      budget_usd: user.monthly_budget_usd,
      requests: owned.reduce((sum, r) => sum + r.request_count, 0),
      tokens: Math.round(owned.reduce((sum, r) => sum + r.request_count, 0) * 1800),
      cost_series: days.map((date, i) => ({ date, cost_usd: series[i]! })),
      agents: owned,
    };
  },

  async removeAgentFromUser(userId, agentName) {
    const s = load();
    const a = assignmentFor(s, agentName);
    if (a.owner_id === userId) a.owner_id = null;
    save();
  },

  async getProjects(query = {}) {
    const s = load();
    const rows = await allRows(s);
    const projects: ProjectRow[] = s.projects
      .filter((p) => query.include_archived || !p.archived_at)
      .filter((p) => !query.search || p.name.toLowerCase().includes(query.search.toLowerCase()))
      .map((p) => projectRow(s, p, rows));
    return { projects, total: projects.length };
  },

  async getProject(id) {
    return load().projects.find((p) => p.id === id) ?? null;
  },

  async createProject(params) {
    const s = load();
    const project: Project = {
      id: newId('p'),
      name: params.name.trim(),
      description: params.description?.trim() || null,
      archived_at: null,
      created_at: now(),
    };
    s.projects.push(project);
    save();
    return project;
  },

  async updateProject(id, params) {
    const s = load();
    const project = s.projects.find((p) => p.id === id);
    if (!project) throw new Error('Project not found');
    if (params.name !== undefined) project.name = params.name.trim();
    if (params.description !== undefined) project.description = params.description?.trim() || null;
    save();
    return project;
  },

  async archiveProject(id) {
    const s = load();
    const project = s.projects.find((p) => p.id === id);
    if (!project) throw new Error('Project not found');
    project.archived_at = now();
    save();
    return project;
  },

  async unarchiveProject(id) {
    const s = load();
    const project = s.projects.find((p) => p.id === id);
    if (!project) throw new Error('Project not found');
    project.archived_at = null;
    save();
    return project;
  },

  async deleteProject(id) {
    const s = load();
    s.projects = s.projects.filter((p) => p.id !== id);
    for (const a of Object.values(s.agents)) {
      a.project_ids = a.project_ids.filter((pid) => pid !== id);
    }
    save();
  },

  async getProjectOverview(id) {
    const s = load();
    const project = s.projects.find((p) => p.id === id);
    if (!project) throw new Error('Project not found');
    const rows = await allRows(s);
    const row = projectRow(s, project, rows);
    const members = rows.filter((r) => !r.archived_at && r.projects.some((p) => p.id === id));
    const days = daysThisMonth();
    const cost = dailySeries(id, row.spend_month_usd, days);
    const requests = members.reduce((sum, r) => sum + r.request_count, 0);
    const tokens = Math.round(requests * 1800);
    const tokenSeries = dailySeries(`${id}:tokens`, tokens, days);
    const byOwner = new Map<string | null, number>();
    for (const r of members) {
      const key = r.owner?.id ?? null;
      byOwner.set(key, (byOwner.get(key) ?? 0) + r.spend_30d_usd);
    }
    const cost_by_owner = [...byOwner.entries()]
      .map(([ownerId, value]) => ({
        owner: ownerId ? userRef(s.users.find((u) => u.id === ownerId)!) : null,
        cost_usd: Math.round(value * 100) / 100,
      }))
      .sort((a, b) => b.cost_usd - a.cost_usd);
    const userIds = new Set(members.map((r) => r.owner?.id).filter((v): v is string => !!v));
    const { users } = await mockTeamsApi.getUsers({ include_archived: true });
    return {
      cost_month_usd: row.spend_month_usd,
      cost_trend_pct: Math.round((noise(id, 7) - 0.3) * 60),
      cost_last_month_usd: row.spend_last_month_usd,
      requests,
      tokens,
      cost_series: days.map((date, i) => ({ date, cost_usd: cost[i]! })),
      tokens_series: days.map((date, i) => ({ date, tokens: Math.round(tokenSeries[i]!) })),
      cost_by_owner,
      agents: members,
      users: users.filter((u) => userIds.has(u.id)),
      spend_shared: row.spend_shared,
    };
  },

  async listAgents(query = {}) {
    const s = load();
    const rows = await allRows(s);
    const filtered = sortRows(
      rows.filter((r) => matchesQuery(r, query)),
      query,
    );
    const { page, page_size, items } = paginate(filtered, query);
    return {
      agents: items,
      total: filtered.length,
      unowned_total: rows.filter((r) => !r.owner && !r.archived_at).length,
      page,
      page_size,
    };
  },

  async getAgentTeam(agentName) {
    const s = load();
    const a = assignmentFor(s, agentName);
    const owner = s.users.find((u) => u.id === a.owner_id);
    return {
      owner: owner ? userRef(owner) : null,
      projects: a.project_ids
        .map((id) => s.projects.find((p) => p.id === id))
        .filter((p): p is Project => !!p)
        .map(projectRef),
      archived_at: a.archived_at,
    };
  },

  async setAgentProjects(agentName, projectIds) {
    const s = load();
    const a = assignmentFor(s, agentName);
    a.project_ids = projectIds.filter((id) => s.projects.some((p) => p.id === id));
    save();
  },

  async archiveAgent(agentName) {
    const s = load();
    assignmentFor(s, agentName).archived_at = now();
    save();
  },

  async unarchiveAgent(agentName) {
    const s = load();
    assignmentFor(s, agentName).archived_at = null;
    save();
  },

  async checkAgentName(name, ownerId) {
    const s = load();
    const rows = await allRows(s);
    const slug = slugify(name);
    const taken = new Set(
      rows.filter((r) => (r.owner?.id ?? null) === ownerId).map((r) => slugify(r.agent_name)),
    );
    if (!taken.has(slug)) return { available: true, suggestion: null };
    let n = 2;
    while (taken.has(`${slug}-${n}`)) n += 1;
    return { available: false, suggestion: `${slug}-${n}` };
  },

  async assignNewAgent(agentName, ownerId, projectIds) {
    const s = load();
    s.agents[agentName] = {
      owner_id: ownerId,
      project_ids: projectIds.filter((id) => s.projects.some((p) => p.id === id)),
      archived_at: null,
    };
    if (!s.seededAgents.includes(agentName)) s.seededAgents.push(agentName);
    save();
  },

  async countSelection(selection) {
    return (await resolveSelection(load(), selection)).length;
  },

  async bulkUpdateProjects(selection, change) {
    const s = load();
    const targets = await resolveSelection(s, selection);
    const result: BulkResult = { applied: [], failed: [] };
    for (const row of targets) {
      if (row.archived_at) {
        result.failed.push({ agent_name: row.agent_name, reason: 'Agent is archived' });
        continue;
      }
      const a = assignmentFor(s, row.agent_name);
      const next = new Set(a.project_ids);
      for (const id of change.add) next.add(id);
      for (const id of change.remove) next.delete(id);
      a.project_ids = [...next];
      result.applied.push(row.agent_name);
    }
    save();
    return result;
  },

  async bulkCopySettings(selection, source_agent, copy) {
    const s = load();
    const targets = await resolveSelection(s, selection);
    const result: BulkResult = { applied: [], failed: [] };
    for (const row of targets) {
      if (row.agent_name === source_agent) {
        result.failed.push({ agent_name: row.agent_name, reason: 'Source agent skipped' });
        continue;
      }
      if (row.archived_at) {
        result.failed.push({ agent_name: row.agent_name, reason: 'Agent is archived' });
        continue;
      }
      if (copy.providers_and_models && s.modelAccess[source_agent]) {
        s.modelAccess[row.agent_name] = JSON.parse(JSON.stringify(s.modelAccess[source_agent]));
      }
      result.applied.push(row.agent_name);
    }
    save();
    return result;
  },

  async getSelectionProjects(selection) {
    const targets = await resolveSelection(load(), selection);
    const counts: Record<string, number> = {};
    for (const row of targets) {
      for (const p of row.projects) counts[p.id] = (counts[p.id] ?? 0) + 1;
    }
    return counts;
  },

  async getAgentModelAccess(agentName) {
    const s = load();
    const [providers, models, tiers] = await Promise.all([
      getProviders()
        .then((r) => r.providers)
        .catch(() => []),
      getAvailableModels(agentName).catch(() => []),
      getTierAssignments(agentName).catch(() => []),
    ]);
    const { access, totals } = buildModelAccess(
      providers,
      models,
      tiers,
      s.modelAccess[agentName] ?? {},
    );
    modelTotals[agentName] = totals;
    return access;
  },

  async updateAgentModelAccess(agentName, userProviderId, change) {
    const s = load();
    s.modelAccess[agentName] = {
      ...(s.modelAccess[agentName] ?? {}),
      [userProviderId]: { all_models: change.all_models, enabled: [...change.enabled_model_ids] },
    };
    save();
    const all = await mockTeamsApi.getAgentModelAccess(agentName);
    const found = all.find((p) => p.user_provider_id === userProviderId);
    if (!found) throw new Error('Provider connection not found');
    return found;
  },

  async applyModelAccessToAgents(agentName, userProviderId, targetAgentNames) {
    const s = load();
    const source = s.modelAccess[agentName]?.[userProviderId] ?? { all_models: true, enabled: [] };
    const result: BulkResult = { applied: [], failed: [] };
    for (const target of targetAgentNames) {
      if (target === agentName) {
        result.failed.push({ agent_name: target, reason: 'Source agent skipped' });
        continue;
      }
      s.modelAccess[target] = {
        ...(s.modelAccess[target] ?? {}),
        [userProviderId]: { all_models: source.all_models, enabled: [...source.enabled] },
      };
      result.applied.push(target);
    }
    save();
    return result;
  },

  async getOverviewGroupedUsage(range, groupBy, filter = {}) {
    const s = load();
    const rows = await allRows(s);
    const usage = (await getOverviewAgentUsage(range)) as GroupedUsageTimeseries;
    const byAgent = new Map(rows.map((r) => [r.agent_name, r]));
    return regroupUsage(usage, groupBy, filter, (name) => byAgent.get(name));
  },
};

function projectRow(s: MockState, p: Project, rows: AgentRow[]): ProjectRow {
  const members = rows.filter((r) => !r.archived_at && r.projects.some((x) => x.id === p.id));
  const byRecency = new Map<string, string>();
  for (const r of members) {
    if (!r.owner) continue;
    const prev = byRecency.get(r.owner.id) ?? '';
    const last = r.last_used_at ?? '';
    if (last > prev) byRecency.set(r.owner.id, last);
  }
  const users = [...byRecency.entries()]
    .sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0))
    .map(([id]) => s.users.find((u) => u.id === id))
    .filter((u): u is TeamUser => !!u)
    .map(userRef);
  const spend = monthSpend(members);
  const requests7d = Array.from({ length: 7 }, (_, i) => {
    const total = members.reduce((sum, r) => sum + r.request_count, 0);
    return Math.round((total / 7) * (0.5 + noise(p.id, i)));
  });
  return {
    ...p,
    agent_count: members.length,
    users,
    requests_7d: requests7d,
    requests_7d_total: requests7d.reduce((a, b) => a + b, 0),
    spend_month_usd: spend,
    spend_last_month_usd: Math.round(spend * (0.7 + noise(p.id, 42) * 0.6) * 100) / 100,
    spend_shared: members.some((r) => r.projects.length > 1),
  };
}
