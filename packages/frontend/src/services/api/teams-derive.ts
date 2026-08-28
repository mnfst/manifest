/**
 * Pure helpers shared by the two transports that derive teams data from the
 * existing endpoints: the dev mock (`teams-mock.ts`) and the production
 * compatibility transport used while the teams backend is not deployed
 * (`teams-compat.ts`). No state, no I/O.
 */
import type { AvailableModel, TierAssignment } from './routing.js';
import type { ProvidersResponse } from './providers.js';
import {
  NO_OWNER,
  type AgentListQuery,
  type AgentRow,
  type GroupedSeries,
  type GroupedUsageTimeseries,
  type OverviewGroupBy,
  type OwnerProjectFilter,
  type ProviderModelAccess,
} from './teams.js';

/** The shape the existing `GET /agents` returns per agent. */
export interface RealAgent {
  agent_name: string;
  display_name?: string;
  agent_category?: string | null;
  agent_platform?: string | null;
  message_count?: number;
  last_active?: string | null;
  total_cost?: number;
  total_tokens?: number;
  sparkline?: number[];
}

/**
 * The slug the create endpoint derives from a display name. Mirrors
 * `packages/backend/src/common/utils/slugify.ts` exactly: trim, lowercase,
 * spaces and underscores to hyphens, drop every other invalid character,
 * collapse runs of hyphens, strip leading and trailing ones. `foo.bar` is
 * `foobar`, not `foo-bar`.
 */
export const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

/** Unwrap `{ agents }` or a bare array, tolerating null. */
export function unwrapAgents(data: unknown): RealAgent[] {
  if (Array.isArray(data)) return data as RealAgent[];
  return ((data as { agents?: RealAgent[] } | null)?.agents ?? []) as RealAgent[];
}

/** Team fields an agent row needs on top of the real agent. */
export type TeamFields = Pick<
  AgentRow,
  'owner' | 'projects' | 'archived_at' | 'models_enabled' | 'models_total' | 'spend_365d_usd'
>;

export function agentRow(agent: RealAgent, team: TeamFields): AgentRow {
  return {
    agent_name: agent.agent_name,
    display_name: agent.display_name || agent.agent_name,
    agent_platform: agent.agent_platform ?? null,
    agent_category: agent.agent_category ?? null,
    owner: team.owner,
    projects: team.projects,
    models_enabled: team.models_enabled,
    models_total: team.models_total,
    spend_30d_usd: Number(agent.total_cost ?? 0),
    spend_365d_usd: team.spend_365d_usd,
    request_count: Number(agent.message_count ?? 0),
    last_used_at: agent.last_active ?? null,
    archived_at: team.archived_at,
  };
}

export function matchesQuery(row: AgentRow, q: AgentListQuery): boolean {
  if (!q.include_archived && row.archived_at) return false;
  if (q.search) {
    const needle = q.search.toLowerCase();
    if (
      !row.agent_name.toLowerCase().includes(needle) &&
      !row.display_name.toLowerCase().includes(needle)
    ) {
      return false;
    }
  }
  if (q.owners && q.owners.length) {
    const ownerId = row.owner?.id ?? NO_OWNER;
    if (!q.owners.includes(ownerId)) return false;
  }
  if (q.projects && q.projects.length) {
    if (!row.projects.some((p) => q.projects!.includes(p.id))) return false;
  }
  if (q.types && q.types.length) {
    if (!q.types.includes(row.agent_platform ?? 'other')) return false;
  }
  return true;
}

export function sortRows(rows: AgentRow[], q: AgentListQuery): AgentRow[] {
  const dir = q.dir === 'desc' ? -1 : 1;
  const key = q.sort ?? 'agent';
  const value = (r: AgentRow): string | number => {
    switch (key) {
      case 'owner':
        return r.owner?.name ?? '';
      case 'projects':
        return r.projects.map((p) => p.name).join(',');
      case 'models':
        return r.models_enabled;
      case 'spend_30d':
        return r.spend_30d_usd;
      case 'spend_365d':
        return r.spend_365d_usd ?? -1;
      case 'last_used':
        return r.last_used_at ?? '';
      default:
        return r.display_name.toLowerCase();
    }
  };
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
}

export function paginate<T>(
  rows: T[],
  query: AgentListQuery,
): { page: number; page_size: number; items: T[] } {
  const page = Math.max(1, query.page ?? 1);
  const page_size = Math.max(1, query.page_size ?? 50);
  const start = (page - 1) * page_size;
  return { page, page_size, items: rows.slice(start, start + page_size) };
}

export interface ModelAccessState {
  all_models: boolean;
  enabled: string[];
}

/**
 * Build per-connection model access from the real provider connections, the
 * real discovered models and the real tier assignments. A model is locked
 * ("in routing") only on the connection that routes it: routes name a
 * provider, an auth type and, for multi-key providers, a key label.
 */
export function buildModelAccess(
  providers: ProvidersResponse['providers'],
  models: AvailableModel[],
  tiers: TierAssignment[],
  access: Record<string, ModelAccessState>,
): { access: ProviderModelAccess[]; totals: Record<string, number> } {
  const routes = tiers.flatMap((tier) =>
    [tier.override_route, tier.auto_assigned_route, ...(tier.fallback_routes ?? [])].filter(
      (route): route is NonNullable<typeof route> => !!route,
    ),
  );
  const same = (a: string | null | undefined, b: string) =>
    (a ?? '').toLowerCase() === b.toLowerCase();
  const routedOn = (group: { provider: string; auth_type: string }, label: string) =>
    new Set(
      routes
        .filter(
          (route) =>
            same(route.provider, group.provider) &&
            same(route.authType, group.auth_type) &&
            (!route.keyLabel || same(route.keyLabel, 'Default') || same(route.keyLabel, label)),
        )
        .map((route) => route.model),
    );
  const out: ProviderModelAccess[] = [];
  const totals: Record<string, number> = {};
  for (const group of providers) {
    for (const connection of group.connections) {
      if (!connection.is_active) continue;
      // A provider can be connected under several auth types; a model discovered
      // for one of them is not available to the other.
      const list = models.filter(
        (m) => m.provider === group.provider && (!m.auth_type || m.auth_type === group.auth_type),
      );
      const st = access[connection.id] ?? { all_models: true, enabled: [] };
      const locked = routedOn(group, connection.label);
      const rows = list.map((m) => ({
        id: m.model_name,
        name: m.display_name || m.model_name,
        enabled: st.all_models || st.enabled.includes(m.model_name),
        in_routing: locked.has(m.model_name),
      }));
      totals[connection.id] = rows.length;
      out.push({
        user_provider_id: connection.id,
        provider: group.provider,
        auth_type: group.auth_type,
        label: connection.label,
        provider_enabled: true,
        all_models: st.all_models,
        models: rows,
        enabled_count: rows.filter((r) => r.enabled).length,
        total_count: rows.length,
      });
    }
  }
  return { access: out, totals };
}

/**
 * Enabled models across every connection: a connection on "all models" (or one
 * without a record) counts its whole total, a restricted one its selection.
 */
export function enabledModelCount(
  access: Record<string, ModelAccessState> | undefined,
  totals: Record<string, number> | undefined,
  total: number,
): number {
  if (!access || !totals) return total;
  let enabled = 0;
  for (const [connectionId, connectionTotal] of Object.entries(totals)) {
    const st = access[connectionId];
    enabled +=
      !st || st.all_models ? connectionTotal : Math.min(connectionTotal, st.enabled.length);
  }
  return Math.min(total, enabled);
}

/**
 * Re-key the per-agent usage series by owner, project or agent, applying the
 * owner/project filter. An agent the lookup does not know keeps its own key
 * and passes only when no filter is active.
 */
export function regroupUsage(
  usage: GroupedUsageTimeseries,
  groupBy: OverviewGroupBy,
  filter: OwnerProjectFilter,
  lookup: (agentName: string) => AgentRow | undefined,
): GroupedUsageTimeseries {
  const keep = (name: string): boolean => {
    const row = lookup(name);
    if (!row) return !filter.owners?.length && !filter.projects?.length;
    if (filter.owners?.length && !filter.owners.includes(row.owner?.id ?? NO_OWNER)) return false;
    if (filter.projects?.length && !row.projects.some((p) => filter.projects!.includes(p.id))) {
      return false;
    }
    return true;
  };
  const groupsOf = (name: string): string[] => {
    const row = lookup(name);
    if (groupBy === 'agent') return [name];
    if (groupBy === 'owner') return [row?.owner?.name ?? 'No user'];
    const projects = row?.projects ?? [];
    return projects.length ? projects.map((p) => p.name) : ['No project'];
  };
  const regroup = (series: GroupedSeries): GroupedSeries => {
    const keys = new Set<string>();
    const timeseries = series.timeseries.map((bucket) => {
      const out: Record<string, number | string> = {};
      for (const [k, v] of Object.entries(bucket)) {
        if (k === 'hour' || k === 'date') {
          out[k] = v;
          continue;
        }
        if (!keep(k)) continue;
        for (const g of groupsOf(k)) {
          keys.add(g);
          out[g] = Number(out[g] ?? 0) + Number(v ?? 0);
        }
      }
      return out;
    });
    return { agents: [...keys].sort(), timeseries };
  };
  return {
    tokenUsage: regroup(usage.tokenUsage),
    messageUsage: regroup(usage.messageUsage),
    costUsage: regroup(usage.costUsage),
  };
}
