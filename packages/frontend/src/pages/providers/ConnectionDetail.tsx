import { Title } from '@solidjs/meta';
import { A, useNavigate, useParams } from '@solidjs/router';
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
  onCleanup,
  type Component,
} from 'solid-js';
import {
  getConnectionDetail,
  getProviderAnalytics,
  getProviderAnalyticsAgents,
  getPerAgentTimeseries,
  getPerAgentMessageTimeseries,
  getPerAgentCostTimeseries,
} from '../../services/api/analytics.js';
import { disconnectProvider } from '../../services/api.js';
import { fetchMutate, routingPath } from '../../services/api/core.js';
import { platformIcon } from 'manifest-shared';
import { PROVIDERS } from '../../services/providers.js';
import { providerIcon } from '../../components/ProviderIcon.jsx';
import { formatNumber, formatCost, formatTimeAgo } from '../../services/formatters.js';
import { getAgents } from '../../services/api.js';
import { getProviders as getAgentProviders } from '../../services/api/routing.js';
import ProviderChartCard from '../../components/ProviderChartCard.jsx';
import { AGENT_COLORS } from '../../components/MultiAgentTokenChart.jsx';
import ActionMenu from '../../components/ActionMenu.jsx';
import Select from '../../components/Select.jsx';
import { toast } from '../../services/toast-store.js';
import { setConnectionBreadcrumb } from '../../services/connection-breadcrumb-store.js';
import '../../styles/charts.css';

const AUTH_TYPE_LABELS: Record<string, string> = {
  subscription: 'Subscriptions',
  api_key: 'Bring your own key',
  local: 'Local Providers',
};

const BACK_LINKS: Record<string, string> = {
  subscription: '/providers/subscriptions',
  api_key: '/providers/byok',
  local: '/providers/local',
};

interface AgentRow {
  agent_name: string;
  agent_platform: string | null;
  tokens_30d: number;
  cost_30d: number;
  messages_30d: number;
  pct_of_total: number;
  last_used: string | null;
}

interface ModelRow {
  model: string;
  tokens: number;
  cost: number;
  messages: number;
  pct_of_total: number;
}

interface ConnectionInfo {
  id: string;
  provider: string;
  auth_type: string;
  label: string;
  cached_model_count: number;
  key_prefix: string | null;
  connected_at: string;
  is_active: boolean;
  last_used_at: string | null;
}

interface DetailResponse {
  connection: ConnectionInfo | null;
  agents: AgentRow[];
  model_usage: ModelRow[];
  recent_messages: any[];
}

interface AnalyticsResponse {
  summary: {
    messages: { value: number; trend_pct: number };
    tokens: { value: number; trend_pct: number };
  };
  token_usage: Array<{ hour?: string; date?: string; input_tokens: number; output_tokens: number }>;
  message_usage: Array<{ hour?: string; date?: string; count: number }>;
}

const ConnectionDetail: Component = () => {
  const params = useParams<{ connectionId: string }>();

  const [detail] = createResource(
    () => params.connectionId,
    (id) => getConnectionDetail(id) as Promise<DetailResponse>,
  );

  const conn = () => detail()?.connection ?? null;
  const provDef = () => PROVIDERS.find((p) => p.id === conn()?.provider);
  const backLink = () =>
    BACK_LINKS[conn()?.auth_type ?? 'subscription'] ?? '/providers/subscriptions';
  const backLabel = () => AUTH_TYPE_LABELS[conn()?.auth_type ?? 'subscription'] ?? 'Providers';

  // Set breadcrumb for Header
  createEffect(() => {
    const c = conn();
    const prov = provDef();
    if (c) {
      setConnectionBreadcrumb(prov?.name ?? c.provider, backLink());
    }
  });

  // Chart state (persisted in sessionStorage)
  const rangeKey = () => `chart-range:${params.connectionId}`;
  const viewKey = () => `chart-view:${params.connectionId}`;
  const savedRange = () => {
    try {
      const v = sessionStorage.getItem(rangeKey());
      if (v === '7d' || v === '30d') return v;
    } catch {
      /* ignore */
    }
    return '7d';
  };
  const savedView = () => {
    try {
      const v = sessionStorage.getItem(viewKey());
      if (v === 'messages' || v === 'cost') return v;
    } catch {
      /* ignore */
    }
    return 'tokens' as const;
  };
  const [chartRange, setChartRangeRaw] = createSignal(savedRange());
  const setChartRange = (v: string) => {
    setChartRangeRaw(v);
    try {
      sessionStorage.setItem(rangeKey(), v);
    } catch {
      /* ignore */
    }
  };
  const [chartView, setChartViewRaw] = createSignal<'messages' | 'tokens' | 'cost'>(savedView());
  const setChartView = (v: 'messages' | 'tokens' | 'cost') => {
    setChartViewRaw(v);
    try {
      sessionStorage.setItem(viewKey(), v);
    } catch {
      /* ignore */
    }
  };
  const [chartAgent, setChartAgent] = createSignal('');

  const [chartAgents] = createResource(
    () => conn()?.auth_type,
    (authType) => getProviderAnalyticsAgents(authType).catch(() => ({ agents: [] as string[] })),
  );

  const [analytics] = createResource(
    () => {
      const c = conn();
      if (!c) return null;
      return {
        range: chartRange(),
        agent: chartAgent(),
        authType: c.auth_type,
        provider: c.provider,
      };
    },
    (p) => {
      if (!p) return null;
      return getProviderAnalytics(
        p.authType,
        p.range,
        p.agent || undefined,
        p.provider,
      ) as Promise<AnalyticsResponse>;
    },
  );

  const messageChartData = createMemo(() => {
    const src = analytics()?.message_usage;
    return src?.map((d) => ({ time: d.hour ?? d.date ?? '', value: d.count })) ?? [];
  });

  const [agentTimeseries] = createResource(
    () => {
      const c = conn();
      if (!c) return null;
      return { range: chartRange(), authType: c.auth_type, provider: c.provider };
    },
    (p) => {
      if (!p) return null;
      return getPerAgentTimeseries(p.authType, p.provider, p.range);
    },
  );

  const [agentMessageTimeseries] = createResource(
    () => {
      const c = conn();
      if (!c) return null;
      return { range: chartRange(), authType: c.auth_type, provider: c.provider };
    },
    (p) => {
      if (!p) return null;
      return getPerAgentMessageTimeseries(p.authType, p.provider, p.range);
    },
  );

  const isByok = () => conn()?.auth_type === 'api_key';

  const [agentCostTimeseries] = createResource(
    () => {
      const c = conn();
      if (!c || c.auth_type !== 'api_key') return null;
      return { range: chartRange(), authType: c.auth_type, provider: c.provider };
    },
    (p) => {
      if (!p) return null;
      return getPerAgentCostTimeseries(p.authType, p.provider, p.range);
    },
  );

  // Agent tag selection for chart filtering (persisted in sessionStorage)
  const storageKey = () => `agent-filter:${params.connectionId}`;
  const loadSavedAgents = (): Set<string> => {
    try {
      const saved = sessionStorage.getItem(storageKey());
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch {
      /* ignore */
    }
    return new Set();
  };
  const [selectedAgents, setSelectedAgents] = createSignal<Set<string>>(loadSavedAgents());
  const [agentFilterOpen, setAgentFilterOpen] = createSignal(false);
  let agentFilterRef: HTMLDivElement | undefined;

  // Close agent filter dropdown on outside click / Escape
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

  // Merge agent lists from both token and message timeseries
  const allAgents = createMemo(() => {
    const tokenAgents = agentTimeseries()?.agents ?? [];
    const msgAgents = agentMessageTimeseries()?.agents ?? [];
    const costAgents = agentCostTimeseries()?.agents ?? [];
    const set = new Set([...tokenAgents, ...msgAgents, ...costAgents]);
    return [...set].sort();
  });

  const agentColorMap = createMemo(() => {
    const map: Record<string, string> = {};
    const agents = allAgents();
    for (let i = 0; i < agents.length; i++) {
      map[agents[i]!] = AGENT_COLORS[i % AGENT_COLORS.length]!;
    }
    return map;
  });

  const selectedAgentCount = () => {
    const sel = effectiveSelected();
    return sel.size;
  };
  const effectiveSelected = () => {
    const sel = selectedAgents();
    // If nothing selected yet (initial load), select all
    if (sel.size === 0 && allAgents().length > 0) return new Set(allAgents());
    return sel;
  };

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
      sessionStorage.setItem(storageKey(), JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  };

  const filteredAgentTimeseries = createMemo(() => {
    const raw = agentTimeseries();
    if (!raw) return undefined;
    const sel = effectiveSelected();
    if (sel.size === 0) return raw;
    const agents = raw.agents.filter((a) => sel.has(a));
    const timeseries = raw.timeseries.map((row) => {
      const filtered: Record<string, number | string> = {};
      for (const [k, v] of Object.entries(row)) {
        if (k === 'hour' || k === 'date' || sel.has(k)) filtered[k] = v;
      }
      return filtered;
    });
    return { agents, timeseries };
  });

  const filteredAgentMessageTimeseries = createMemo(() => {
    const raw = agentMessageTimeseries();
    if (!raw) return undefined;
    const sel = effectiveSelected();
    if (sel.size === 0) return raw;
    const agents = raw.agents.filter((a) => sel.has(a));
    const timeseries = raw.timeseries.map((row) => {
      const filtered: Record<string, number | string> = {};
      for (const [k, v] of Object.entries(row)) {
        if (k === 'hour' || k === 'date' || sel.has(k)) filtered[k] = v;
      }
      return filtered;
    });
    return { agents, timeseries };
  });

  const filteredAgentCostTimeseries = createMemo(() => {
    const raw = agentCostTimeseries();
    if (!raw) return undefined;
    const sel = effectiveSelected();
    if (sel.size === 0) return raw;
    const agents = raw.agents.filter((a) => sel.has(a));
    const timeseries = raw.timeseries.map((row) => {
      const filtered: Record<string, number | string> = {};
      for (const [k, v] of Object.entries(row)) {
        if (k === 'hour' || k === 'date' || sel.has(k)) filtered[k] = v;
      }
      return filtered;
    });
    return { agents, timeseries };
  });

  // Manage modal
  const navigate = useNavigate();
  const [showDisconnectModal, setShowDisconnectModal] = createSignal(false);
  const [disconnecting, setDisconnecting] = createSignal(false);
  const [showManageModal, setShowManageModal] = createSignal(false);
  const [labelInput, setLabelInput] = createSignal('');
  const [savingLabel, setSavingLabel] = createSignal(false);
  const [agents] = createResource(async () => {
    try {
      const res = await getAgents();
      return (res as any)?.agents ?? res ?? [];
    } catch {
      return [];
    }
  });
  const firstAgentName = () => (agents() ?? [])[0]?.agent_name ?? '';
  const [modalProviders, { refetch: refetchModalProviders }] = createResource(
    () => firstAgentName(),
    async (name) => {
      if (!name) return [];
      try {
        return await getAgentProviders(name);
      } catch {
        return [];
      }
    },
  );

  const agentOptions = () => {
    const list = chartAgents()?.agents ?? [];
    return [{ label: 'All agents', value: '' }, ...list.map((a) => ({ label: a, value: a }))];
  };

  return (
    <div class="container--lg">
      <Show
        when={detail() && conn()}
        fallback={
          <div style="padding: 48px 0; text-align: center; color: hsl(var(--muted-foreground));">
            Loading...
          </div>
        }
      >
        {(() => {
          const c = conn()!;
          const prov = provDef();
          return (
            <>
              <Title>
                {prov?.name ?? c.provider} — {c.label} | Manifest
              </Title>

              {/* Back link */}
              <div style="margin-bottom: 24px;">
                <A
                  href={backLink()}
                  style="color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm); text-decoration: none;"
                >
                  ← {backLabel()}
                </A>
              </div>

              {/* Header */}
              <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px;">
                <div>
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <span style="display: flex; align-items: center; width: 32px; height: 32px;">
                      {providerIcon(c.provider, 32)}
                    </span>
                    <h1 class="page-header__title" style="margin: 0;">
                      {prov?.name ?? c.provider}
                    </h1>
                    <Show
                      when={c.is_active}
                      fallback={
                        <span style="display: inline-flex; align-items: center; padding: 4px 12px; border-radius: var(--radius-sm); background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm); font-weight: 500;">
                          Inactive
                        </span>
                      }
                    >
                      <span style="display: inline-flex; align-items: center; padding: 4px 12px; border-radius: var(--radius-sm); background: hsl(var(--success)); color: white; font-size: var(--font-size-sm); font-weight: 600;">
                        Active
                      </span>
                    </Show>
                  </div>
                  <div style="display: flex; gap: 24px; font-size: var(--font-size-sm);">
                    <span>
                      <span style="font-weight: 600; color: hsl(var(--foreground));">
                        Connection name:
                      </span>{' '}
                      <span style="color: hsl(var(--muted-foreground));">{c.label}</span>
                    </span>
                    <span>
                      <span style="font-weight: 600; color: hsl(var(--foreground));">Models:</span>{' '}
                      <span style="color: hsl(var(--muted-foreground));">
                        {c.cached_model_count}
                      </span>
                    </span>
                    <span>
                      <span style="font-weight: 600; color: hsl(var(--foreground));">
                        First connection:
                      </span>{' '}
                      <span style="color: hsl(var(--muted-foreground));">
                        {c.connected_at ? formatTimeAgo(c.connected_at) : '—'}
                      </span>
                    </span>
                    <span>
                      <span style="font-weight: 600; color: hsl(var(--foreground));">
                        Last used:
                      </span>{' '}
                      <span style="color: hsl(var(--muted-foreground));">
                        {c.last_used_at ? formatTimeAgo(c.last_used_at) : '—'}
                      </span>
                    </span>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
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
                        {selectedAgentCount() === allAgents().length
                          ? `All agents (${allAgents().length})`
                          : `${selectedAgentCount()} of ${allAgents().length} agents`}
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
                                  sessionStorage.setItem(storageKey(), JSON.stringify(allAgents()));
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
                                  sessionStorage.setItem(storageKey(), JSON.stringify([]));
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
                  <Select
                    value={chartRange()}
                    onChange={setChartRange}
                    options={[
                      { label: 'Last 24 hours', value: '24h' },
                      { label: 'Last 7 days', value: '7d' },
                      { label: 'Last 30 days', value: '30d' },
                    ]}
                  />
                  <button class="btn btn--outline btn--sm" onClick={() => setShowManageModal(true)}>
                    Manage
                  </button>
                </div>
              </div>

              {/* Chart */}
              <Show when={analytics()}>
                {(() => {
                  const totalCost = createMemo(() => {
                    const ts = agentCostTimeseries();
                    if (!ts) return undefined;
                    let sum = 0;
                    for (const row of ts.timeseries) {
                      for (const a of ts.agents) sum += Number(row[a] ?? 0);
                    }
                    return sum;
                  });
                  return (
                    <ProviderChartCard
                      activeView={chartView()}
                      onViewChange={setChartView}
                      messagesValue={analytics()!.summary.messages.value}
                      messagesTrendPct={analytics()!.summary.messages.trend_pct}
                      tokensValue={analytics()!.summary.tokens.value}
                      tokensTrendPct={analytics()!.summary.tokens.trend_pct}
                      costValue={isByok() ? (totalCost() ?? 0) : undefined}
                      tokenUsage={analytics()!.token_usage}
                      messageChartData={messageChartData()}
                      range={chartRange()}
                      agentTimeseries={filteredAgentTimeseries() ?? undefined}
                      agentMessageTimeseries={filteredAgentMessageTimeseries() ?? undefined}
                      agentCostTimeseries={
                        isByok() ? (filteredAgentCostTimeseries() ?? undefined) : undefined
                      }
                      colorMap={agentColorMap()}
                    />
                  );
                })()}
              </Show>

              {/* Recent Messages (full width) */}
              <div class="panel scroll-panel" style="margin-bottom: 24px;">
                <div
                  class="panel__title"
                  style="display: flex; justify-content: space-between; align-items: center;"
                >
                  Recent Messages
                  <A href={`/messages`} class="view-more-link">
                    View more
                  </A>
                </div>
                <Show
                  when={detail()!.recent_messages.length > 0}
                  fallback={
                    <div style="padding: 24px 16px; color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm); text-align: center;">
                      No messages yet.
                    </div>
                  }
                >
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
                          <th>Message</th>
                          <th>Model</th>
                          <th>Tokens</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={detail()!.recent_messages}>
                          {(msg: any) => (
                            <tr>
                              <td style="white-space: nowrap;">
                                {msg.timestamp ? formatTimeAgo(msg.timestamp) : '—'}
                              </td>
                              <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                {msg.description || msg.first_message || '—'}
                              </td>
                              <td style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                {msg.model || '—'}
                              </td>
                              <td>
                                {formatNumber((msg.input_tokens ?? 0) + (msg.output_tokens ?? 0))}
                              </td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </Show>
              </div>

              {/* Models (full width) */}
              <div class="panel scroll-panel" style="margin-bottom: 24px;">
                <div class="panel__title">Models</div>
                <Show
                  when={detail()!.model_usage.length > 0}
                  fallback={
                    <div style="padding: 24px 16px; color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm); text-align: center;">
                      No model usage data yet.
                    </div>
                  }
                >
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
                          <th>Tokens</th>
                          <th>% of total</th>
                          <Show when={isByok()}>
                            <th>Cost</th>
                          </Show>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={detail()!.model_usage}>
                          {(m) => (
                            <tr>
                              <td style="font-weight: 500; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                {m.model}
                              </td>
                              <td>{formatNumber(m.tokens)}</td>
                              <td>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                  <div style="width: 60px; height: 6px; background: hsl(var(--muted)); border-radius: 3px; overflow: hidden;">
                                    <div
                                      style={{
                                        width: `${m.pct_of_total}%`,
                                        height: '100%',
                                        background: 'hsl(var(--success))',
                                        'border-radius': '3px',
                                      }}
                                    />
                                  </div>
                                  <span style="color: hsl(var(--muted-foreground)); font-size: var(--font-size-xs);">
                                    {m.pct_of_total}%
                                  </span>
                                </div>
                              </td>
                              <Show when={isByok()}>
                                <td style="font-weight: 600; color: hsl(var(--foreground));">
                                  {formatCost(m.cost) ?? '$0.00'}
                                </td>
                              </Show>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </Show>
              </div>

              {/* Agents (full width) */}
              <div class="panel scroll-panel" style="margin-bottom: 0;">
                <div class="panel__title">Agents</div>
                <Show
                  when={detail()!.agents.length > 0}
                  fallback={
                    <div style="padding: 24px 16px; color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm); text-align: center;">
                      No agents have used this provider yet.
                    </div>
                  }
                >
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
                          <th>Tokens (30d)</th>
                          <th>% of total</th>
                          <Show when={isByok()}>
                            <th>Cost (30d)</th>
                          </Show>
                          <th>Last used</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={detail()!.agents}>
                          {(agent) => (
                            <tr>
                              <td>
                                <A
                                  href={`/agents/${agent.agent_name}`}
                                  style="text-decoration: none; color: hsl(var(--foreground)); font-weight: 500; display: flex; align-items: center; gap: 8px;"
                                >
                                  <Show when={platformIcon(agent.agent_platform, null)}>
                                    <img
                                      src={platformIcon(agent.agent_platform, null)!}
                                      alt=""
                                      width="16"
                                      height="16"
                                      style="border-radius: 3px;"
                                    />
                                  </Show>
                                  {agent.agent_name}
                                </A>
                              </td>
                              <td>{formatNumber(agent.tokens_30d)}</td>
                              <td>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                  <div style="width: 60px; height: 6px; background: hsl(var(--muted)); border-radius: 3px; overflow: hidden;">
                                    <div
                                      style={{
                                        width: `${agent.pct_of_total}%`,
                                        height: '100%',
                                        background: 'hsl(var(--success))',
                                        'border-radius': '3px',
                                      }}
                                    />
                                  </div>
                                  <span style="color: hsl(var(--muted-foreground)); font-size: var(--font-size-xs);">
                                    {agent.pct_of_total}%
                                  </span>
                                </div>
                              </td>
                              <Show when={isByok()}>
                                <td>{formatCost(agent.cost_30d) ?? '$0.00'}</td>
                              </Show>
                              <td style="color: hsl(var(--muted-foreground));">
                                {agent.last_used ? formatTimeAgo(agent.last_used) : '—'}
                              </td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </Show>
              </div>
              {/* Manage modal */}
              <Show when={showManageModal()}>
                <div
                  class="modal-overlay"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setShowManageModal(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setShowManageModal(false);
                  }}
                >
                  <div
                    class="modal-card"
                    style="max-width: 440px;"
                    role="dialog"
                    aria-modal="true"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h2 class="modal-card__title">Manage connection</h2>

                    <div style="margin-top: 16px;">
                      <label class="modal-card__field-label" style="margin-top: 0;">
                        Connection name
                      </label>
                      <input
                        type="text"
                        class="input"
                        value={labelInput() || c.label}
                        onInput={(e) => setLabelInput(e.currentTarget.value)}
                        style="width: 100%; height: 36px; padding: 0 12px; border: 1px solid hsl(var(--border)); border-radius: var(--radius); font-size: var(--font-size-sm); background: hsl(var(--background)); color: hsl(var(--foreground));"
                      />
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 20px; padding-top: 16px; border-top: 1px solid hsl(var(--border));">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: var(--font-size-sm); font-weight: 500; color: hsl(var(--muted-foreground));">
                          Status:
                        </span>
                        <Show
                          when={c.is_active}
                          fallback={
                            <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: var(--radius-sm); background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); font-size: var(--font-size-xs); font-weight: 500;">
                              Inactive
                            </span>
                          }
                        >
                          <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: var(--radius-sm); background: hsl(var(--success)); color: white; font-size: var(--font-size-xs); font-weight: 600;">
                            Active
                          </span>
                        </Show>
                      </div>
                      <Show when={c.is_active}>
                        <button
                          class="btn btn--danger btn--sm"
                          onClick={() => {
                            setShowManageModal(false);
                            setShowDisconnectModal(true);
                          }}
                        >
                          Disconnect
                        </button>
                      </Show>
                    </div>
                    <Show when={!c.is_active}>
                      <p style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground)); margin-top: 8px;">
                        To reactivate, go to{' '}
                        <A
                          href={backLink()}
                          style="color: hsl(var(--foreground)); font-weight: 500; text-decoration: underline;"
                        >
                          {backLabel()}
                        </A>{' '}
                        and reconnect your account. A new connection will be created if the
                        credentials differ.
                      </p>
                    </Show>

                    <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;">
                      <button
                        class="btn btn--ghost btn--sm"
                        onClick={() => setShowManageModal(false)}
                      >
                        Cancel
                      </button>
                      <button
                        class="btn btn--primary btn--sm"
                        disabled={savingLabel() || !labelInput() || labelInput() === c.label}
                        onClick={async () => {
                          if (!labelInput() || labelInput() === c.label) return;
                          setSavingLabel(true);
                          try {
                            const url = routingPath(
                              firstAgentName(),
                              `/providers/${encodeURIComponent(c.provider)}/keys/${encodeURIComponent(c.label)}`,
                            );
                            await fetchMutate(url, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                newLabel: labelInput(),
                                authType: c.auth_type,
                              }),
                            });
                            toast.success('Connection renamed');
                            setShowManageModal(false);
                            // Refresh detail data
                            window.location.reload();
                          } catch {
                            // toast from fetchMutate
                          } finally {
                            setSavingLabel(false);
                          }
                        }}
                      >
                        {savingLabel() ? <span class="spinner" /> : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              </Show>

              {/* Disconnect modal */}
              <Show when={showDisconnectModal()}>
                <div
                  class="modal-overlay"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setShowDisconnectModal(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setShowDisconnectModal(false);
                  }}
                >
                  <div
                    class="modal-card"
                    style="max-width: 420px;"
                    role="dialog"
                    aria-modal="true"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h2 class="modal-card__title">Disconnect {prov?.name ?? c.provider}</h2>
                    <p class="modal-card__desc">
                      Disconnecting this provider will remove it from your active connections. Your
                      routing configuration may be affected if models from this provider are
                      currently assigned.
                    </p>
                    <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;">
                      <button
                        class="btn btn--ghost btn--sm"
                        onClick={() => setShowDisconnectModal(false)}
                      >
                        Cancel
                      </button>
                      <button
                        class="btn btn--primary btn--sm"
                        disabled={disconnecting()}
                        onClick={async () => {
                          setDisconnecting(true);
                          try {
                            await disconnectProvider(
                              firstAgentName(),
                              c.provider,
                              c.auth_type as any,
                              c.label,
                            );
                            toast.success(`${prov?.name ?? c.provider} disconnected`);
                            navigate(backLink());
                          } catch {
                            // toast from fetchMutate
                          } finally {
                            setDisconnecting(false);
                            setShowDisconnectModal(false);
                          }
                        }}
                      >
                        {disconnecting() ? <span class="spinner" /> : 'Disconnect'}
                      </button>
                    </div>
                  </div>
                </div>
              </Show>
            </>
          );
        })()}
      </Show>
    </div>
  );
};

export default ConnectionDetail;
