/**
 * Production transport used while the teams backend is NOT deployed.
 *
 * `teamsApi()` probes `GET /users` once per page load; a 404 means the
 * endpoints do not exist yet and this transport takes over. It gives the new
 * screens the spec's day-one state from the endpoints that do exist: every
 * agent has no owner, there are no users and no projects, every provider
 * connection allows all of its models, and the Overview groupings fall back to
 * the per-agent usage. Reads work; writes fail with a clear error.
 *
 * Nothing here is seeded or invented: it is the real agent list, the real
 * model lists and the real tier assignments, without the team layer.
 */
import { getAgents } from './agents.js';
import { getOverviewAgentUsage } from './analytics.js';
import { getProviders } from './providers.js';
import { getAvailableModels, getTierAssignments } from './routing.js';
import {
  agentRow,
  buildModelAccess,
  matchesQuery,
  paginate,
  regroupUsage,
  slugify,
  sortRows,
  unwrapAgents,
} from './teams-derive.js';
import type { AgentRow, GroupedUsageTimeseries, TeamsApi } from './teams.js';

export const TEAMS_BACKEND_MISSING = 'This needs the teams backend, which is not deployed yet.';

const unavailable = async (): Promise<never> => {
  throw new Error(TEAMS_BACKEND_MISSING);
};

async function rows(): Promise<AgentRow[]> {
  const agents = unwrapAgents(await getAgents());
  return agents.map((agent) =>
    agentRow(agent, {
      owner: null,
      projects: [],
      archived_at: null,
      models_enabled: 0,
      models_total: 0,
    }),
  );
}

export const compatTeamsApi: TeamsApi = {
  async getUsers() {
    return { users: [], total: 0, spend_month_usd_total: 0, budget_month_usd_total: 0 };
  },
  async getUser() {
    return null;
  },
  createUser: unavailable,
  updateUser: unavailable,
  archiveUser: unavailable,
  unarchiveUser: unavailable,
  deleteUser: unavailable,
  getUserOverview: unavailable,
  removeAgentFromUser: unavailable,

  async getProjects() {
    return { projects: [], total: 0 };
  },
  async getProject() {
    return null;
  },
  createProject: unavailable,
  updateProject: unavailable,
  archiveProject: unavailable,
  unarchiveProject: unavailable,
  deleteProject: unavailable,
  getProjectOverview: unavailable,

  async listAgents(query = {}) {
    const all = await rows();
    const matching = sortRows(
      all.filter((r) => matchesQuery(r, query)),
      query,
    );
    const { page, page_size, items } = paginate(matching, query);
    return { agents: items, total: matching.length, unowned_total: all.length, page, page_size };
  },
  async getAgentTeam() {
    return { owner: null, projects: [], archived_at: null };
  },
  setAgentProjects: unavailable,
  archiveAgent: unavailable,
  unarchiveAgent: unavailable,
  async checkAgentName(name) {
    // Today's backend enforces tenant-wide uniqueness on create; report the
    // same scope here so the modal does not promise a name the create refuses.
    const all = await rows();
    const slug = slugify(name);
    const taken = all.some((r) => slugify(r.agent_name) === slug);
    return { available: !taken, suggestion: taken ? `${slug}-2` : null };
  },
  async assignNewAgent(_agentName, ownerId, projectIds) {
    // Nothing to attach on day one; refuse only when the caller asked for
    // something this transport cannot store.
    if (ownerId || projectIds.length) await unavailable();
  },

  async countSelection(selection) {
    const all = await rows();
    if (selection.kind === 'names') {
      const wanted = new Set(selection.agent_names);
      return all.filter((r) => wanted.has(r.agent_name)).length;
    }
    return all.filter((r) => matchesQuery(r, selection.query)).length;
  },
  bulkUpdateProjects: unavailable,
  bulkCopySettings: unavailable,
  async getSelectionProjects() {
    return {};
  },

  async getAgentModelAccess(agentName) {
    const [providers, models, tiers] = await Promise.all([
      getProviders().then((r) => r.providers),
      getAvailableModels(agentName),
      getTierAssignments(agentName),
    ]);
    return buildModelAccess(providers, models, tiers, {}).access;
  },
  updateAgentModelAccess: unavailable,
  applyModelAccessToAgents: unavailable,

  async getOverviewGroupedUsage(range, groupBy, filter = {}) {
    const usage = (await getOverviewAgentUsage(range)) as GroupedUsageTimeseries;
    const byName = new Map((await rows()).map((r) => [r.agent_name, r]));
    return regroupUsage(usage, groupBy, filter, (name) => byName.get(name));
  },
};
