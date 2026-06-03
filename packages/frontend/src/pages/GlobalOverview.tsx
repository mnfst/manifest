import { Title } from '@solidjs/meta';
import { A, useNavigate } from '@solidjs/router';
import {
  createResource,
  createSignal,
  createMemo,
  For,
  Show,
  onCleanup,
  type Component,
} from 'solid-js';
import { fetchJson } from '../services/api/core.js';
import { getAgents, getCustomProviders } from '../services/api.js';
import { customProviderColor } from '../services/formatters.js';
import { customProviderLogo } from '../components/ProviderIcon.jsx';
import {
  getOverview,
  getGlobalPerAgentTimeseries,
  getGlobalPerAgentMessageTimeseries,
  getGlobalPerProviderTimeseries,
  getGlobalPerProviderMessageTimeseries,
  getGlobalPerModelTimeseries,
  getGlobalPerModelMessageTimeseries,
  getGlobalPerAgentCostTimeseries,
  getGlobalPerProviderCostTimeseries,
  getGlobalPerModelCostTimeseries,
} from '../services/api/analytics.js';
import { formatNumber, formatCost, formatTimeAgo } from '../services/formatters.js';
import { providerIcon } from '../components/ProviderIcon.jsx';
import { PROVIDERS } from '../services/providers.js';
import { AGENT_COLORS } from '../components/MultiAgentTokenChart.jsx';
import ProviderChartCard from '../components/ProviderChartCard.jsx';
import Sparkline from '../components/Sparkline.jsx';
import Select from '../components/Select.jsx';
import { authLabel, authBadgeFor } from '../components/AuthBadge.jsx';
import { platformIcon, PLATFORM_LABELS } from 'manifest-shared';
import GlobalOverviewSkeleton from '../components/GlobalOverviewSkeleton.jsx';
import { agentPing, messagePing } from '../services/sse.js';
import '../styles/overview.css';
import '../styles/charts.css';

interface ProviderGroup {
  provider: string;
  auth_type: string;
  connection_count: number;
  connections: Array<{ id: string; label: string; is_active: boolean }>;
  total_models: number;
  consumption_tokens: number;
  consumption_messages: number;
  consumption_cost: number;
  last_used_at: string | null;
  sparkline_7d: number[];
}

interface CostByModelRow {
  model: string;
  display_name: string;
  tokens: number;
  share_pct: number;
  estimated_cost: number;
  auth_type: string | null;
  provider: string | null;
}

interface RecentActivityRow {
  timestamp: string;
  agent_name: string;
  model: string;
  total_tokens: number;
  status?: string;
  provider?: string;
  auth_type?: string;
  description?: string;
  first_message?: string;
  cost_usd?: number;
}

interface OverviewResponse {
  summary: {
    tokens_today: { value: number; trend_pct: number };
    cost_today: { value: number; trend_pct: number };
    messages: { value: number; trend_pct: number };
  };
  token_usage: Array<{ hour?: string; date?: string; input_tokens: number; output_tokens: number }>;
  message_usage: Array<{ hour?: string; date?: string; count: number }>;
  cost_by_model: CostByModelRow[];
  recent_activity: RecentActivityRow[];
  has_data: boolean;
  has_providers: boolean;
}

interface AgentRow {
  agent_name: string;
  display_name: string;
  agent_category: string | null;
  agent_platform: string | null;
  message_count: number;
  total_tokens: number;
  sparkline: number[];
}

const RANGE_OPTIONS = [
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
];

const GROUP_OPTIONS = [
  { label: 'By provider', value: 'provider' },
  { label: 'By agent', value: 'agent' },
];

const RANGE_STORAGE_KEY = 'manifest_global_range';
const GROUP_STORAGE_KEY = 'manifest_global_group';

function loadRange(): string {
  try {
    const v = localStorage.getItem(RANGE_STORAGE_KEY);
    if (v === '24h' || v === '7d' || v === '30d') return v;
  } catch {
    /* ignore */
  }
  return '7d';
}

const trendBadge = (pct: number) => {
  const clamped = Math.max(-999, Math.min(999, Math.round(pct)));
  if (clamped === 0) return null;
  const sign = clamped > 0 ? '+' : '';
  return (
    <span class="trend trend--neutral">
      {sign}
      {clamped}%
    </span>
  );
};

const GlobalOverview: Component = () => {
  const navigate = useNavigate();

  // ── Range state (persisted in localStorage) ──────────────────────────
  const [chartRange, setChartRangeRaw] = createSignal(loadRange());
  const setChartRange = (v: string) => {
    setChartRangeRaw(v);
    try {
      localStorage.setItem(RANGE_STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
  };

  // ── Group by state (persisted in localStorage) ───────────────────────
  const loadGroup = (): string => {
    try {
      const v = localStorage.getItem(GROUP_STORAGE_KEY);
      if (v === 'provider' || v === 'agent') return v;
    } catch {
      /* ignore */
    }
    return 'provider';
  };
  const [groupBy, setGroupByRaw] = createSignal(loadGroup());
  const setGroupBy = (v: string) => {
    setGroupByRaw(v);
    try {
      localStorage.setItem(GROUP_STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
  };

  // ── Chart view state ─────────────────────────────────────────────────
  const [chartView, setChartView] = createSignal<'messages' | 'tokens' | 'cost'>('tokens');

  // ── Data resources (5 parallel) ──────────────────────────────────────
  const [overview] = createResource(
    () => chartRange(),
    (range) => getOverview(range) as Promise<OverviewResponse>,
  );

  const [agents] = createResource(
    () => agentPing(),
    async () => {
      try {
        const data = await getAgents();
        return ((data as any)?.agents ?? data ?? []) as AgentRow[];
      } catch {
        return [] as AgentRow[];
      }
    },
  );

  const [providers] = createResource(
    () => messagePing(),
    async () => {
      try {
        const res = (await fetchJson('/providers')) as { providers: ProviderGroup[] };
        return res?.providers ?? [];
      } catch {
        return [] as ProviderGroup[];
      }
    },
  );

  // Custom providers for name resolution
  const firstAgent = () => agentList()[0]?.agent_name ?? '';
  const [customProviderData] = createResource(
    () => firstAgent(),
    (name) => (name ? getCustomProviders(name).catch(() => []) : Promise.resolve([])),
  );
  const resolveCustomName = (providerId: string) => {
    if (!providerId.startsWith('custom:')) return null;
    const uuid = providerId.replace('custom:', '');
    const cp = (customProviderData() ?? []).find((c: any) => c.id === uuid);
    return cp ? (cp as any).name : null;
  };

  type TSResult = { agents: string[]; timeseries: Array<Record<string, number | string>> };
  const tokenFetcher = (range: string, group: string): Promise<TSResult> => {
    if (group === 'provider') return getGlobalPerProviderTimeseries(range) as Promise<TSResult>;
    if (group === 'model') return getGlobalPerModelTimeseries(range) as Promise<TSResult>;
    return getGlobalPerAgentTimeseries(range) as Promise<TSResult>;
  };
  const msgFetcher = (range: string, group: string): Promise<TSResult> => {
    if (group === 'provider')
      return getGlobalPerProviderMessageTimeseries(range) as Promise<TSResult>;
    if (group === 'model') return getGlobalPerModelMessageTimeseries(range) as Promise<TSResult>;
    return getGlobalPerAgentMessageTimeseries(range) as Promise<TSResult>;
  };

  const [agentTimeseries] = createResource(
    () => ({ range: chartRange(), group: groupBy() }),
    (p) => tokenFetcher(p.range, p.group),
  );

  const [agentMessageTimeseries] = createResource(
    () => ({ range: chartRange(), group: groupBy() }),
    (p) => msgFetcher(p.range, p.group),
  );

  const costFetcher = (range: string, group: string): Promise<TSResult> => {
    if (group === 'provider') return getGlobalPerProviderCostTimeseries(range) as Promise<TSResult>;
    if (group === 'model') return getGlobalPerModelCostTimeseries(range) as Promise<TSResult>;
    return getGlobalPerAgentCostTimeseries(range) as Promise<TSResult>;
  };

  const [agentCostTimeseries] = createResource(
    () => ({ range: chartRange(), group: groupBy() }),
    (p) => costFetcher(p.range, p.group),
  );

  // ── Agent filter state (sessionStorage) ──────────────────────────────
  const storageKey = 'global-agent-filter';
  const loadSavedAgents = (): Set<string> => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch {
      /* ignore */
    }
    return new Set();
  };
  const [selectedAgents, setSelectedAgents] = createSignal<Set<string>>(loadSavedAgents());
  const [agentFilterOpen, setAgentFilterOpen] = createSignal(false);
  let agentFilterRef: HTMLDivElement | undefined;

  if (typeof document !== 'undefined') {
    const handleClickOutside = (e: MouseEvent) => {
      if (agentFilterRef && !agentFilterRef.contains(e.target as Node)) {
        setAgentFilterOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAgentFilterOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    });
  }

  const allAgents = createMemo(() => {
    const tokenAgents = agentTimeseries()?.agents ?? [];
    const msgAgents = agentMessageTimeseries()?.agents ?? [];
    const set = new Set([...tokenAgents, ...msgAgents]);
    return [...set].sort();
  });

  const agentColorMap = createMemo(() => {
    const map: Record<string, string> = {};
    const list = allAgents();
    for (let i = 0; i < list.length; i++) {
      map[list[i]!] = AGENT_COLORS[i % AGENT_COLORS.length]!;
    }
    return map;
  });

  const effectiveSelected = () => {
    const sel = selectedAgents();
    if (sel.size === 0 && allAgents().length > 0) return new Set(allAgents());
    return sel;
  };

  const selectedAgentCount = () => effectiveSelected().size;

  const toggleAgent = (agent: string) => {
    const current = effectiveSelected();
    const next = new Set(current);
    if (next.has(agent)) {
      next.delete(agent);
    } else {
      next.add(agent);
    }
    setSelectedAgents(next);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  };

  const filteredAgentTimeseries = createMemo(() => {
    const raw = agentTimeseries();
    if (!raw) return undefined;
    const sel = effectiveSelected();
    if (sel.size === 0) return raw;
    const filtered_agents = raw.agents.filter((a) => sel.has(a));
    const timeseries = raw.timeseries.map((row) => {
      const filtered: Record<string, number | string> = {};
      for (const [k, v] of Object.entries(row)) {
        if (k === 'hour' || k === 'date' || sel.has(k)) filtered[k] = v;
      }
      return filtered;
    });
    return { agents: filtered_agents, timeseries };
  });

  const filteredAgentMessageTimeseries = createMemo(() => {
    const raw = agentMessageTimeseries();
    if (!raw) return undefined;
    const sel = effectiveSelected();
    if (sel.size === 0) return raw;
    const filtered_agents = raw.agents.filter((a) => sel.has(a));
    const timeseries = raw.timeseries.map((row) => {
      const filtered: Record<string, number | string> = {};
      for (const [k, v] of Object.entries(row)) {
        if (k === 'hour' || k === 'date' || sel.has(k)) filtered[k] = v;
      }
      return filtered;
    });
    return { agents: filtered_agents, timeseries };
  });

  const filteredAgentCostTimeseries = createMemo(() => {
    const raw = agentCostTimeseries();
    if (!raw) return undefined;
    const sel = effectiveSelected();
    if (sel.size === 0) return raw;
    const filtered_agents = raw.agents.filter((a: string) => sel.has(a));
    const timeseries = raw.timeseries.map((row: Record<string, number | string>) => {
      const filtered: Record<string, number | string> = {};
      for (const [k, v] of Object.entries(row)) {
        if (k === 'hour' || k === 'date' || sel.has(k)) filtered[k] = v;
      }
      return filtered;
    });
    return { agents: filtered_agents, timeseries };
  });

  // ── Derived data ─────────────────────────────────────────────────────
  const agentList = () => (agents() ?? []) as AgentRow[];
  const providerList = () => (providers() ?? []) as ProviderGroup[];

  const messageChartData = createMemo(() => {
    const src = overview()?.message_usage;
    return src?.map((d) => ({ time: d.hour ?? d.date ?? '', value: d.count })) ?? [];
  });

  const uniqueProviders = createMemo(() => {
    const list = providerList();
    const seen = new Set<string>();
    const result: string[] = [];
    for (const p of list) {
      if (!seen.has(p.provider)) {
        seen.add(p.provider);
        result.push(p.provider);
      }
    }
    return result.slice(0, 5);
  });

  const uniquePlatforms = createMemo(() => {
    const list = agentList();
    const seen = new Set<string>();
    const result: Array<{ platform: string; category: string | null }> = [];
    for (const a of list) {
      const p = a.agent_platform;
      if (p && !seen.has(p)) {
        seen.add(p);
        result.push({ platform: p, category: a.agent_category });
      }
    }
    return result.slice(0, 5);
  });

  const platformGroups = createMemo(() => {
    const counts = new Map<string, { name: string; icon: string | undefined; count: number }>();
    for (const a of agentList()) {
      const p = a.agent_platform || 'other';
      const existing = counts.get(p);
      if (existing) {
        existing.count++;
      } else {
        const label = (PLATFORM_LABELS as Record<string, string>)[p] ?? p;
        counts.set(p, { name: label, icon: platformIcon(p, a.agent_category), count: 1 });
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  });

  const sortedAgents = createMemo(() => {
    return [...agentList()].sort((a, b) => (b.total_tokens ?? 0) - (a.total_tokens ?? 0));
  });

  // Onboarding: detect empty states
  const hasNoAgents = () => agents() !== undefined && agentList().length === 0;
  const hasNoProviders = () => providers() !== undefined && providerList().length === 0;

  return (
    <div class="container--lg">
      <Title>Overview | Manifest</Title>

      {/* Onboarding banners */}
      <Show when={hasNoAgents() && hasNoProviders()}>
        <div class="waiting-banner" style="margin-bottom: 24px;">
          <i class="bxd bx-rocket" />
          <p>Welcome to Manifest. Start by connecting your first agent.</p>
          <a
            href="/agents?add=true"
            class="btn btn--primary btn--sm"
            style="text-decoration: none; margin-left: auto; flex-shrink: 0;"
          >
            Create agent
          </a>
        </div>
      </Show>
      <Show when={!hasNoAgents() && hasNoProviders()}>
        <div class="waiting-banner" style="margin-bottom: 24px;">
          <i class="bxd bx-plug" />
          <p>Connect a provider to start routing your agents' LLM calls.</p>
          <a
            href="/providers/subscriptions?add=true"
            class="btn btn--primary btn--sm"
            style="text-decoration: none; margin-left: auto; flex-shrink: 0;"
          >
            Add subscription
          </a>
        </div>
      </Show>
      <Show when={hasNoAgents() && !hasNoProviders()}>
        <div class="waiting-banner" style="margin-bottom: 24px;">
          <i class="bxd bx-bot" />
          <p>You have providers connected. Create an agent to start routing.</p>
          <a
            href="/agents?add=true"
            class="btn btn--primary btn--sm"
            style="text-decoration: none; margin-left: auto; flex-shrink: 0;"
          >
            Create agent
          </a>
        </div>
      </Show>

      {/* ── 1. Page Header ──────────────────────────────────────────── */}
      <div class="page-header" style="border-bottom: none; padding-bottom: 0;">
        <div>
          <h1 class="page-header__title">Overview</h1>
          <p class="page-header__subtitle">All your agents and providers</p>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <Select value={groupBy()} onChange={setGroupBy} options={GROUP_OPTIONS} />
          <Show when={allAgents().length > 1}>
            <div class="agent-filter-select" ref={agentFilterRef}>
              <button
                class="agent-filter-select__trigger"
                onClick={() => setAgentFilterOpen(!agentFilterOpen())}
                type="button"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                {(() => {
                  const label =
                    groupBy() === 'provider'
                      ? 'providers'
                      : groupBy() === 'model'
                        ? 'models'
                        : 'agents';
                  return selectedAgentCount() === allAgents().length
                    ? `All ${label} (${allAgents().length})`
                    : `${selectedAgentCount()} of ${allAgents().length} ${label}`;
                })()}
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <Show when={agentFilterOpen()}>
                <div class="agent-filter-select__dropdown">
                  <div class="agent-filter-select__actions">
                    <button
                      class="agent-filter-select__action-btn"
                      type="button"
                      disabled={selectedAgentCount() === allAgents().length}
                      onClick={() => {
                        setSelectedAgents(new Set(allAgents()));
                        try {
                          sessionStorage.setItem(storageKey, JSON.stringify([...allAgents()]));
                        } catch {
                          /* ignore */
                        }
                      }}
                    >
                      Select all
                    </button>
                    <button
                      class="agent-filter-select__action-btn"
                      type="button"
                      disabled={selectedAgentCount() === 0}
                      onClick={() => {
                        setSelectedAgents(new Set<string>());
                        try {
                          sessionStorage.setItem(storageKey, JSON.stringify([]));
                        } catch {
                          /* ignore */
                        }
                      }}
                    >
                      Unselect all
                    </button>
                  </div>
                  <For each={allAgents()}>
                    {(agent) => {
                      const isOn = () => effectiveSelected().has(agent);
                      return (
                        <button
                          class="agent-filter-select__item"
                          onClick={() => toggleAgent(agent)}
                          type="button"
                        >
                          <span
                            class="agent-filter-select__swatch"
                            style={{ background: agentColorMap()[agent] }}
                          />
                          <span class="agent-filter-select__name">{agent}</span>
                          <span
                            class="agent-filter-select__toggle"
                            classList={{ 'agent-filter-select__toggle--on': isOn() }}
                          >
                            <span class="agent-filter-select__toggle-thumb" />
                          </span>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </div>
          </Show>
          <Select value={chartRange()} onChange={setChartRange} options={RANGE_OPTIONS} />
        </div>
      </div>

      <Show
        when={overview() !== undefined && agents() !== undefined && providers() !== undefined}
        fallback={<GlobalOverviewSkeleton />}
      >
        {/* ── 2. Chart Card ───────────────────────────────────────────── */}
        <div style="margin-bottom: 24px;">
          <ProviderChartCard
            activeView={chartView()}
            onViewChange={setChartView}
            messagesValue={overview()?.summary.messages.value ?? 0}
            messagesTrendPct={overview()?.summary.messages.trend_pct ?? 0}
            tokensValue={overview()?.summary.tokens_today.value ?? 0}
            tokensTrendPct={overview()?.summary.tokens_today.trend_pct ?? 0}
            costValue={overview()?.summary.cost_today.value ?? 0}
            costTrendPct={overview()?.summary.cost_today.trend_pct ?? 0}
            costInfoTooltip="Actual API key costs only. Subscription usage is not included."
            tokenUsage={overview()?.token_usage ?? []}
            messageChartData={messageChartData()}
            range={chartRange()}
            agentTimeseries={filteredAgentTimeseries() ?? undefined}
            agentMessageTimeseries={filteredAgentMessageTimeseries() ?? undefined}
            agentCostTimeseries={filteredAgentCostTimeseries() ?? undefined}
            colorMap={agentColorMap()}
          />
        </div>

        {/* ── 3. Summary Stat Cards (4 columns) ────────────────────── */}
        {(() => {
          const subs = () => providerList().filter((g) => g.auth_type === 'subscription');
          const byok = () => providerList().filter((g) => g.auth_type === 'api_key');
          const local = () => providerList().filter((g) => g.auth_type === 'local');
          const totalConns = (list: ProviderGroup[]) =>
            list.reduce((s, g) => s + g.connections.length, 0);
          const providerTag = (g: ProviderGroup) => {
            const count = g.connections.length;
            const prov = PROVIDERS.find((p) => p.id === g.provider);
            const displayName = prov?.name ?? g.provider;
            return (
              <span
                title={`${displayName}: ${count} connection${count !== 1 ? 's' : ''}`}
                style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: var(--radius-sm); border: 1px solid hsl(var(--border)); background: hsl(var(--card)); font-size: var(--font-size-xs); white-space: nowrap; height: 24px;"
              >
                <span style="flex-shrink: 0; display: flex; align-items: center;">
                  {providerIcon(g.provider, 14)}
                </span>
                <span style="font-weight: 600; color: hsl(var(--foreground));">{count}</span>
              </span>
            );
          };
          const connList = (groups: ProviderGroup[], linkBase: string) => {
            const items: Array<{ id: string; icon: string; name: string; label: string }> = [];
            for (const g of groups) {
              for (const c of g.connections.slice(0, 5 - items.length)) {
                const prov = PROVIDERS.find((p) => p.id === g.provider);
                const customName = resolveCustomName(g.provider);
                items.push({
                  id: c.id,
                  icon: g.provider,
                  name: prov?.name ?? customName ?? g.provider,
                  label: c.label,
                });
                if (items.length >= 5) break;
              }
              if (items.length >= 5) break;
            }
            return items;
          };
          const cardStyle = 'display: flex; flex-direction: column; padding: 20px;';
          return (
            <div
              class="overview-stats"
              style="grid-template-columns: repeat(4, 1fr); align-items: stretch;"
            >
              <div class="overview-stat-card" style={cardStyle}>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <span class="overview-stat-card__label">Subscriptions</span>
                  <A
                    href="/providers/subscriptions?add=true"
                    class="btn btn--outline btn--sm"
                    style="font-size: var(--font-size-xs); padding: 2px 10px; height: 24px; text-decoration: none;"
                  >
                    + Add
                  </A>
                </div>
                <span class="overview-stat-card__value" style="margin-bottom: 12px;">
                  {totalConns(subs())}
                </span>
                <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                  <For each={connList(subs(), '/providers/connections/')}>
                    {(item) => (
                      <A
                        href={`/providers/connections/${item.id}`}
                        style="display: flex; align-items: center; gap: 8px; text-decoration: none; font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));"
                      >
                        <span style="flex-shrink: 0;">
                          {providerIcon(item.icon, 14) ?? customProviderLogo(item.name, 14) ?? (
                            <span
                              style={{
                                display: 'inline-flex',
                                'align-items': 'center',
                                'justify-content': 'center',
                                width: '14px',
                                height: '14px',
                                'border-radius': '3px',
                                'font-size': '9px',
                                'font-weight': '600',
                                color: 'white',
                                background: customProviderColor(item.name),
                              }}
                            >
                              {item.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <span style="font-weight: 500; color: hsl(var(--foreground));">
                          {item.name}
                        </span>
                        <Show when={item.label !== 'Default'}>
                          <span>{item.label}</span>
                        </Show>
                      </A>
                    )}
                  </For>
                </div>
                <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
                  <A href="/providers/subscriptions" class="view-more-link">
                    View more
                  </A>
                </div>
              </div>
              <div class="overview-stat-card" style={cardStyle}>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <span class="overview-stat-card__label">BYOK</span>
                  <A
                    href="/providers/byok?add=true"
                    class="btn btn--outline btn--sm"
                    style="font-size: var(--font-size-xs); padding: 2px 10px; height: 24px; text-decoration: none;"
                  >
                    + Add
                  </A>
                </div>
                <span class="overview-stat-card__value" style="margin-bottom: 12px;">
                  {totalConns(byok())}
                </span>
                <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                  <For each={connList(byok(), '/providers/connections/')}>
                    {(item) => (
                      <A
                        href={`/providers/connections/${item.id}`}
                        style="display: flex; align-items: center; gap: 8px; text-decoration: none; font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));"
                      >
                        <span style="flex-shrink: 0;">
                          {providerIcon(item.icon, 14) ?? customProviderLogo(item.name, 14) ?? (
                            <span
                              style={{
                                display: 'inline-flex',
                                'align-items': 'center',
                                'justify-content': 'center',
                                width: '14px',
                                height: '14px',
                                'border-radius': '3px',
                                'font-size': '9px',
                                'font-weight': '600',
                                color: 'white',
                                background: customProviderColor(item.name),
                              }}
                            >
                              {item.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <span style="font-weight: 500; color: hsl(var(--foreground));">
                          {item.name}
                        </span>
                        <Show when={item.label !== 'Default'}>
                          <span>{item.label}</span>
                        </Show>
                      </A>
                    )}
                  </For>
                </div>
                <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
                  <A href="/providers/byok" class="view-more-link">
                    View more
                  </A>
                </div>
              </div>
              <div class="overview-stat-card" style={cardStyle}>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <span class="overview-stat-card__label">Local</span>
                  <A
                    href="/providers/local?add=true"
                    class="btn btn--outline btn--sm"
                    style="font-size: var(--font-size-xs); padding: 2px 10px; height: 24px; text-decoration: none;"
                  >
                    + Add
                  </A>
                </div>
                <span class="overview-stat-card__value" style="margin-bottom: 12px;">
                  {totalConns(local())}
                </span>
                <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                  <For each={connList(local(), '/providers/connections/')}>
                    {(item) => (
                      <A
                        href={`/providers/connections/${item.id}`}
                        style="display: flex; align-items: center; gap: 8px; text-decoration: none; font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));"
                      >
                        <span style="flex-shrink: 0;">
                          {providerIcon(item.icon, 14) ?? customProviderLogo(item.name, 14) ?? (
                            <span
                              style={{
                                display: 'inline-flex',
                                'align-items': 'center',
                                'justify-content': 'center',
                                width: '14px',
                                height: '14px',
                                'border-radius': '3px',
                                'font-size': '9px',
                                'font-weight': '600',
                                color: 'white',
                                background: customProviderColor(item.name),
                              }}
                            >
                              {item.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <span style="font-weight: 500; color: hsl(var(--foreground));">
                          {item.name}
                        </span>
                        <Show when={item.label !== 'Default'}>
                          <span>{item.label}</span>
                        </Show>
                      </A>
                    )}
                  </For>
                </div>
                <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
                  <A href="/providers/local" class="view-more-link">
                    View more
                  </A>
                </div>
              </div>
              <div class="overview-stat-card" style={cardStyle}>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <span class="overview-stat-card__label">Agents</span>
                  <A
                    href="/agents?add=true"
                    class="btn btn--outline btn--sm"
                    style="font-size: var(--font-size-xs); padding: 2px 10px; height: 24px; text-decoration: none;"
                  >
                    + Add
                  </A>
                </div>
                <span class="overview-stat-card__value" style="margin-bottom: 12px;">
                  {agentList().length}
                </span>
                <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                  <For each={sortedAgents().slice(0, 5)}>
                    {(agent) => {
                      const icon = platformIcon(agent.agent_platform, agent.agent_category);
                      return (
                        <A
                          href={`/agents/${agent.agent_name}`}
                          style="display: flex; align-items: center; gap: 8px; text-decoration: none; font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));"
                        >
                          <Show when={icon}>
                            <img
                              src={icon!}
                              alt=""
                              width="14"
                              height="14"
                              style="flex-shrink: 0;"
                            />
                          </Show>
                          <span style="font-weight: 500; color: hsl(var(--foreground));">
                            {agent.display_name || agent.agent_name}
                          </span>
                        </A>
                      );
                    }}
                  </For>
                </div>
                <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
                  <A href="/agents" class="view-more-link">
                    View more
                  </A>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── 4. Recent Messages (full width) ──────────────────────────── */}
        <div class="panel scroll-panel" style="margin-bottom: 24px;">
          <div
            class="panel__title"
            style="display: flex; justify-content: space-between; align-items: center;"
          >
            Recent Messages
            <A href="/messages" class="view-more-link">
              View more
            </A>
          </div>
          <div
            class="scroll-panel__body"
            onScroll={(e) => {
              const el = e.currentTarget;
              const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
              el.parentElement?.classList.toggle('scroll-panel--at-bottom', atBottom);
            }}
          >
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Agent</th>
                  <th>Model</th>
                  <th>Message</th>
                  <th style="text-align: right;">Cost</th>
                  <th style="text-align: right;">Tokens</th>
                </tr>
              </thead>
              <tbody>
                <For each={overview()?.recent_activity ?? []}>
                  {(row) => (
                    <tr>
                      <td style="white-space: nowrap; color: hsl(var(--muted-foreground)); font-size: var(--font-size-xs);">
                        {formatTimeAgo(row.timestamp) ?? '—'}
                      </td>
                      <td>
                        {(() => {
                          const s = (row.status ?? 'ok').toLowerCase();
                          if (s === 'ok' || s === 'success')
                            return (
                              <span style="display: inline-flex; padding: 2px 8px; border-radius: var(--radius-sm); background: hsl(var(--success) / 0.1); color: hsl(var(--success)); font-size: var(--font-size-xs); font-weight: 500;">
                                Success
                              </span>
                            );
                          if (s === 'retry')
                            return (
                              <span style="display: inline-flex; padding: 2px 8px; border-radius: var(--radius-sm); background: hsl(38 92% 50% / 0.15); color: hsl(38 92% 40%); font-size: var(--font-size-xs); font-weight: 500;">
                                Retried
                              </span>
                            );
                          return (
                            <span style="display: inline-flex; padding: 2px 8px; border-radius: var(--radius-sm); background: hsl(var(--destructive) / 0.1); color: hsl(var(--destructive)); font-size: var(--font-size-xs); font-weight: 500;">
                              Failed
                            </span>
                          );
                        })()}
                      </td>
                      <td>
                        <span style="font-weight: 500; color: hsl(var(--foreground));">
                          {row.agent_name}
                        </span>
                      </td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <Show when={row.provider}>
                            <span style="position: relative; flex-shrink: 0; display: flex; align-items: center;">
                              {providerIcon(row.provider!, 16)}
                              {authBadgeFor(row.auth_type ?? null, 12)}
                            </span>
                          </Show>
                          <span style="color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm);">
                            {row.model || '—'}
                          </span>
                        </div>
                      </td>
                      <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm);">
                        {row.description || row.first_message || '—'}
                      </td>
                      <td style="text-align: right; font-variant-numeric: tabular-nums; color: hsl(var(--muted-foreground));">
                        {formatCost(Number(row.cost_usd ?? 0)) ?? '—'}
                      </td>
                      <td style="text-align: right; font-variant-numeric: tabular-nums;">
                        {formatNumber(Number(row.total_tokens ?? 0))}
                      </td>
                    </tr>
                  )}
                </For>
                <Show when={(overview()?.recent_activity ?? []).length === 0}>
                  <tr>
                    <td
                      colspan="7"
                      style="text-align: center; color: hsl(var(--muted-foreground)); padding: 24px 0;"
                    >
                      No messages yet
                    </td>
                  </tr>
                </Show>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 5. Model usage (full width) ────────────────────────────── */}
        <div class="panel scroll-panel" style="margin-bottom: 24px;">
          <div class="panel__title">Model usage</div>
          <div
            class="scroll-panel__body"
            onScroll={(e) => {
              const el = e.currentTarget;
              const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
              el.parentElement?.classList.toggle('scroll-panel--at-bottom', atBottom);
            }}
          >
            <table class="data-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th style="text-align: right;">Tokens</th>
                  <th style="text-align: right;">Share</th>
                  <th style="text-align: right;">Est. cost</th>
                </tr>
              </thead>
              <tbody>
                <For each={(overview()?.cost_by_model ?? []).slice(0, 10)}>
                  {(row) => (
                    <tr>
                      <td>
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <Show when={row.provider}>
                            <span style="position: relative; flex-shrink: 0; display: flex; align-items: center;">
                              {providerIcon(row.provider!, 16)}
                              {authBadgeFor(row.auth_type, 12)}
                            </span>
                          </Show>
                          <span style="font-weight: 500; color: hsl(var(--foreground));">
                            {row.display_name || row.model}
                          </span>
                        </div>
                      </td>
                      <td style="text-align: right; font-variant-numeric: tabular-nums;">
                        {formatNumber(row.tokens)}
                      </td>
                      <td style="text-align: right;">
                        <div style="display: flex; align-items: center; gap: 8px; justify-content: flex-end;">
                          <div style="width: 60px; height: 6px; background: hsl(var(--muted)); border-radius: 3px; overflow: hidden;">
                            <div
                              style={{
                                width: `${row.share_pct}%`,
                                height: '100%',
                                background: 'hsl(var(--success))',
                                'border-radius': '3px',
                              }}
                            />
                          </div>
                          <span style="color: hsl(var(--muted-foreground)); font-size: var(--font-size-xs);">
                            {row.share_pct}%
                          </span>
                        </div>
                      </td>
                      <td style="text-align: right; font-weight: 600; font-variant-numeric: tabular-nums;">
                        {formatCost(row.estimated_cost) ?? '$0.00'}
                      </td>
                    </tr>
                  )}
                </For>
                <Show when={(overview()?.cost_by_model ?? []).length === 0}>
                  <tr>
                    <td
                      colspan="3"
                      style="text-align: center; color: hsl(var(--muted-foreground)); padding: 24px 0;"
                    >
                      No model data yet
                    </td>
                  </tr>
                </Show>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 6. Provider connections (full width) ────────────────────── */}
        <div class="panel scroll-panel" style="margin-bottom: 24px;">
          <div class="panel__title">Provider connections</div>
          <div
            class="scroll-panel__body"
            onScroll={(e) => {
              const el = e.currentTarget;
              const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
              el.parentElement?.classList.toggle('scroll-panel--at-bottom', atBottom);
            }}
          >
            <table class="data-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Type</th>
                  <th>Usage (30d)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <For each={providerList()}>
                  {(group) => {
                    const firstId = () => group.connections[0]?.id;
                    const isActive = () => group.connections.some((c) => c.is_active);
                    return (
                      <tr
                        style="cursor: pointer;"
                        onClick={() => {
                          const id = firstId();
                          if (id) navigate(`/providers/connections/${id}`);
                        }}
                      >
                        <td>
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="flex-shrink: 0;">{providerIcon(group.provider, 20)}</span>
                            <span style="font-weight: 500; color: hsl(var(--foreground));">
                              {group.provider}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              'font-size': 'var(--font-size-xs)',
                              'font-weight': '500',
                              color:
                                group.auth_type === 'subscription'
                                  ? '#1cc4bf'
                                  : group.auth_type === 'local'
                                    ? '#f72585'
                                    : '#c8920a',
                            }}
                          >
                            {authLabel(group.auth_type)}
                          </span>
                        </td>
                        <td>
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <Show when={group.sparkline_7d.length > 0}>
                              <span style="flex-shrink: 0;">
                                <Sparkline data={group.sparkline_7d} width={60} height={24} />
                              </span>
                            </Show>
                            <span style="font-variant-numeric: tabular-nums;">
                              {formatNumber(group.consumption_tokens)} tokens
                            </span>
                          </div>
                        </td>
                        <td>
                          <Show
                            when={isActive()}
                            fallback={
                              <span style="display: inline-flex; padding: 2px 8px; border-radius: var(--radius-sm); background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); font-size: var(--font-size-xs); font-weight: 500;">
                                Inactive
                              </span>
                            }
                          >
                            <span style="display: inline-flex; padding: 2px 8px; border-radius: var(--radius-sm); background: hsl(var(--success)); color: white; font-size: var(--font-size-xs); font-weight: 600;">
                              Active
                            </span>
                          </Show>
                        </td>
                      </tr>
                    );
                  }}
                </For>
                <Show when={providerList().length === 0}>
                  <tr>
                    <td
                      colspan="5"
                      style="text-align: center; color: hsl(var(--muted-foreground)); padding: 24px 0;"
                    >
                      No connections yet
                    </td>
                  </tr>
                </Show>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 7. Agents (full width) ─────────────────────────────────── */}
        <div class="panel scroll-panel" style="margin-bottom: 24px;">
          <div class="panel__title">Agents</div>
          <div
            class="scroll-panel__body"
            onScroll={(e) => {
              const el = e.currentTarget;
              const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
              el.parentElement?.classList.toggle('scroll-panel--at-bottom', atBottom);
            }}
          >
            <table class="data-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Usage (30d)</th>
                  <th style="text-align: right;">Messages</th>
                </tr>
              </thead>
              <tbody>
                <For each={sortedAgents()}>
                  {(agent) => {
                    const icon = platformIcon(agent.agent_platform, agent.agent_category);
                    return (
                      <tr
                        style="cursor: pointer;"
                        onClick={() => navigate(`/agents/${agent.agent_name}`)}
                      >
                        <td>
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <Show when={icon}>
                              <img
                                src={icon!}
                                alt=""
                                width="20"
                                height="20"
                                style="flex-shrink: 0;"
                              />
                            </Show>
                            <span style="font-weight: 500; color: hsl(var(--foreground));">
                              {agent.display_name || agent.agent_name}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <Show when={(agent.sparkline ?? []).length > 0}>
                              <span style="flex-shrink: 0;">
                                <Sparkline data={agent.sparkline} width={60} height={24} />
                              </span>
                            </Show>
                            <span style="font-variant-numeric: tabular-nums;">
                              {formatNumber(agent.total_tokens ?? 0)} tokens
                            </span>
                          </div>
                        </td>
                        <td style="text-align: right; font-variant-numeric: tabular-nums;">
                          {formatNumber(agent.message_count ?? 0)}
                        </td>
                      </tr>
                    );
                  }}
                </For>
                <Show when={agentList().length === 0}>
                  <tr>
                    <td
                      colspan="4"
                      style="text-align: center; color: hsl(var(--muted-foreground)); padding: 24px 0;"
                    >
                      No agents yet
                    </td>
                  </tr>
                </Show>
              </tbody>
            </table>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default GlobalOverview;
