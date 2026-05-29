import {
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
  onCleanup,
  type Component,
} from 'solid-js';
import { A } from '@solidjs/router';
import { useAgentName } from '../services/routing.js';
import {
  getOverview,
  getPerProviderTimeseries,
  getPerProviderMessageTimeseries,
} from '../services/api/analytics.js';
import { formatNumber, formatTimeAgo } from '../services/formatters.js';
import { PROVIDERS } from '../services/providers.js';
import { providerIcon } from '../components/ProviderIcon.jsx';
import { AGENT_COLORS } from '../components/MultiAgentTokenChart.jsx';
import ProviderChartCard from '../components/ProviderChartCard.jsx';
import Select from '../components/Select.jsx';
import { messagePing } from '../services/sse.js';
import '../styles/charts.css';

interface OverviewResponse {
  summary: {
    tokens_today: { value: number; trend_pct: number };
    cost_today: { value: number; trend_pct: number };
    messages: { value: number; trend_pct: number };
  };
  token_usage: Array<{ hour?: string; date?: string; input_tokens: number; output_tokens: number }>;
  message_usage: Array<{ hour?: string; date?: string; count: number }>;
  cost_by_model: Array<{
    model: string;
    display_name?: string;
    tokens: number;
    share_pct: number;
    estimated_cost: number;
    auth_type: string | null;
    provider: string | null;
  }>;
  recent_activity: any[];
  has_data: boolean;
}

type PivotedTimeseries = {
  agents: string[];
  timeseries: Array<Record<string, number | string>>;
};

const RANGE_OPTIONS = [
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
];

const VALID_RANGES = new Set(['24h', '7d', '30d']);

const AgentOverview: Component = () => {
  const getAgentName = useAgentName();
  const agentName = () => getAgentName();

  // ── Range state (sessionStorage per agent) ──────────────────────────
  const rangeKey = () => `agent-overview-range:${agentName()}`;
  const viewKey = () => `agent-overview-view:${agentName()}`;
  const storageKey = () => `agent-overview-filter:${agentName()}`;

  const loadRange = (): string => {
    try {
      const v = sessionStorage.getItem(rangeKey());
      if (v && VALID_RANGES.has(v)) return v;
    } catch {
      /* ignore */
    }
    return '24h';
  };

  const loadView = (): 'messages' | 'tokens' | 'cost' => {
    try {
      const v = sessionStorage.getItem(viewKey());
      if (v === 'messages' || v === 'tokens' || v === 'cost') return v;
    } catch {
      /* ignore */
    }
    return 'tokens';
  };

  const loadSaved = (): Set<string> => {
    try {
      const saved = sessionStorage.getItem(storageKey());
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch {
      /* ignore */
    }
    return new Set();
  };

  const [chartRange, setChartRangeRaw] = createSignal(loadRange());
  const setChartRange = (v: string) => {
    setChartRangeRaw(v);
    try {
      sessionStorage.setItem(rangeKey(), v);
    } catch {
      /* ignore */
    }
  };

  const [chartView, setChartViewRaw] = createSignal<'messages' | 'tokens' | 'cost'>(loadView());
  const setChartView = (v: 'messages' | 'tokens' | 'cost') => {
    setChartViewRaw(v);
    try {
      sessionStorage.setItem(viewKey(), v);
    } catch {
      /* ignore */
    }
  };

  // ── Provider filter state (sessionStorage) ──────────────────────────
  const [selectedProviders, setSelectedProviders] = createSignal<Set<string>>(loadSaved());
  const [filterOpen, setFilterOpen] = createSignal(false);
  let filterRef: HTMLDivElement | undefined;

  if (typeof document !== 'undefined') {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef && !filterRef.contains(e.target as Node)) setFilterOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFilterOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    });
  }

  // ── Data resources ──────────────────────────────────────────────────
  const [overview] = createResource(
    () => ({ range: chartRange(), agent: agentName(), _ping: messagePing() }),
    (p) => (p.agent ? (getOverview(p.range, p.agent) as Promise<OverviewResponse>) : undefined),
  );

  const [providerTimeseries] = createResource(
    () => ({ range: chartRange(), agent: agentName() }),
    (p) =>
      p.agent
        ? (getPerProviderTimeseries(p.agent, p.range) as Promise<PivotedTimeseries>)
        : undefined,
  );

  const [providerMessageTimeseries] = createResource(
    () => ({ range: chartRange(), agent: agentName() }),
    (p) =>
      p.agent
        ? (getPerProviderMessageTimeseries(p.agent, p.range) as Promise<PivotedTimeseries>)
        : undefined,
  );

  // ── Provider list from timeseries ───────────────────────────────────
  const allProviders = createMemo(() => {
    const tokenProviders = providerTimeseries()?.agents ?? [];
    const msgProviders = providerMessageTimeseries()?.agents ?? [];
    const set = new Set([...tokenProviders, ...msgProviders]);
    return [...set].sort();
  });

  const providerColorMap = createMemo(() => {
    const map: Record<string, string> = {};
    const list = allProviders();
    for (let i = 0; i < list.length; i++) {
      map[list[i]!] = AGENT_COLORS[i % AGENT_COLORS.length]!;
    }
    return map;
  });

  const effectiveSelected = () => {
    const sel = selectedProviders();
    if (sel.size === 0 && allProviders().length > 0) return new Set(allProviders());
    return sel;
  };

  const selectedProviderCount = () => effectiveSelected().size;

  const toggleProvider = (provider: string) => {
    const current = effectiveSelected();
    const next = new Set(current);
    if (next.has(provider)) {
      next.delete(provider);
    } else {
      next.add(provider);
    }
    setSelectedProviders(next);
    try {
      sessionStorage.setItem(storageKey(), JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  };

  // ── Filtered timeseries (by selected providers) ─────────────────────
  const filteredProviderTimeseries = createMemo(() => {
    const raw = providerTimeseries();
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

  const filteredProviderMessageTimeseries = createMemo(() => {
    const raw = providerMessageTimeseries();
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

  // ── Derived data ────────────────────────────────────────────────────
  const messageChartData = createMemo(() => {
    const src = overview()?.message_usage;
    return src?.map((d: any) => ({ time: d.hour ?? d.date ?? '', value: d.count })) ?? [];
  });

  const providerTotals = createMemo(() => {
    const ts = providerTimeseries();
    if (!ts) return [];
    const totals: Record<string, number> = {};
    for (const p of ts.agents) totals[p] = 0;
    for (const row of ts.timeseries) {
      for (const p of ts.agents) totals[p]! += Number(row[p] ?? 0);
    }
    const total = Object.values(totals).reduce((s, v) => s + v, 0);
    return ts.agents
      .map((p) => ({
        provider: p,
        tokens: totals[p] ?? 0,
        pct: total > 0 ? Math.round(((totals[p] ?? 0) / total) * 100) : 0,
      }))
      .sort((a, b) => b.tokens - a.tokens);
  });

  const providerDisplayName = (provId: string): string =>
    PROVIDERS.find((p) => p.id === provId)?.name ?? provId;

  return (
    <div class="container--lg">
      <Show
        when={overview()?.has_data !== false}
        fallback={
          <div style="padding: 48px 24px; text-align: center; color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm);">
            No usage data for this agent yet. Send requests through Manifest to see analytics here.
          </div>
        }
      >
        {/* ── 1. Range selector + provider filter ──────────────────────── */}
        <div style="display: flex; justify-content: flex-end; margin-bottom: 24px; gap: 8px; align-items: center;">
          <Show when={allProviders().length > 1}>
            <div class="agent-filter-select" ref={filterRef}>
              <button
                class="agent-filter-select__trigger"
                onClick={() => setFilterOpen(!filterOpen())}
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
                {selectedProviderCount() === allProviders().length
                  ? `All providers (${allProviders().length})`
                  : `${selectedProviderCount()} of ${allProviders().length} providers`}
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
              <Show when={filterOpen()}>
                <div class="agent-filter-select__dropdown">
                  <For each={allProviders()}>
                    {(provider) => {
                      const isOn = () => effectiveSelected().has(provider);
                      return (
                        <button
                          class="agent-filter-select__item"
                          onClick={() => toggleProvider(provider)}
                          type="button"
                        >
                          <span
                            class="agent-filter-select__swatch"
                            style={{ background: providerColorMap()[provider] }}
                          />
                          <span class="agent-filter-select__name">
                            {providerDisplayName(provider)}
                          </span>
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

        {/* ── 2. Chart Card (ProviderChartCard) ────────────────────────── */}
        <ProviderChartCard
          activeView={chartView()}
          onViewChange={setChartView}
          messagesValue={overview()?.summary?.messages?.value ?? 0}
          messagesTrendPct={overview()?.summary?.messages?.trend_pct ?? 0}
          tokensValue={overview()?.summary?.tokens_today?.value ?? 0}
          tokensTrendPct={overview()?.summary?.tokens_today?.trend_pct ?? 0}
          tokenUsage={overview()?.token_usage ?? []}
          messageChartData={messageChartData()}
          range={chartRange()}
          agentTimeseries={filteredProviderTimeseries() ?? undefined}
          agentMessageTimeseries={filteredProviderMessageTimeseries() ?? undefined}
          colorMap={providerColorMap()}
        />

        {/* ── 3. Two columns: Models + Recent Messages ─────────────────── */}
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 24px;">
          {/* Models */}
          <div class="panel scroll-panel" style="margin-bottom: 0;">
            <div class="panel__title">Models</div>
            <div
              class="scroll-panel__body"
              style="max-height: 480px; overflow-y: auto;"
              onScroll={(e) => {
                const el = e.currentTarget;
                const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
                el.parentElement?.classList.toggle('scroll-panel--at-bottom', atBottom);
              }}
            >
              <Show
                when={(overview()?.cost_by_model ?? []).length > 0}
                fallback={
                  <div style="padding: 24px; text-align: center; color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm);">
                    No model data yet.
                  </div>
                }
              >
                <table style="width: 100%; border-collapse: collapse;">
                  <tbody>
                    <For each={overview()?.cost_by_model ?? []}>
                      {(row) => (
                        <tr>
                          <td style="padding: 10px 16px; font-size: 14px;">
                            {row.display_name ?? row.model}
                          </td>
                          <td style="padding: 10px 8px; font-size: 14px; text-align: right; white-space: nowrap;">
                            {formatNumber(row.tokens)}
                          </td>
                          <td style="padding: 10px 16px; width: 80px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                              <div
                                style={{
                                  width: '60px',
                                  height: '6px',
                                  'border-radius': '3px',
                                  background: 'hsl(var(--muted) / 0.3)',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${row.share_pct}%`,
                                    height: '100%',
                                    'border-radius': '3px',
                                    background: '#1cc4bf',
                                  }}
                                />
                              </div>
                              <span style="font-size: 12px; color: hsl(var(--muted-foreground)); min-width: 32px; text-align: right;">
                                {Math.round(row.share_pct)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </Show>
            </div>
          </div>

          {/* Recent Messages */}
          <div class="panel scroll-panel" style="margin-bottom: 0;">
            <div
              class="panel__title"
              style="display: flex; justify-content: space-between; align-items: center;"
            >
              Recent Messages
              <Show when={agentName()}>
                <A
                  href={`/agents/${encodeURIComponent(agentName()!)}/messages`}
                  class="view-more-link"
                >
                  View more
                </A>
              </Show>
            </div>
            <div
              class="scroll-panel__body"
              style="max-height: 480px; overflow-y: auto;"
              onScroll={(e) => {
                const el = e.currentTarget;
                const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
                el.parentElement?.classList.toggle('scroll-panel--at-bottom', atBottom);
              }}
            >
              <Show
                when={(overview()?.recent_activity ?? []).length > 0}
                fallback={
                  <div style="padding: 24px; text-align: center; color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm);">
                    No recent messages yet.
                  </div>
                }
              >
                <table style="width: 100%; border-collapse: collapse;">
                  <tbody>
                    <For each={overview()?.recent_activity ?? []}>
                      {(row: any) => (
                        <tr>
                          <td style="padding: 10px 16px; font-size: 13px; color: hsl(var(--muted-foreground)); white-space: nowrap;">
                            {formatTimeAgo(row.timestamp) ?? ''}
                          </td>
                          <td style="padding: 10px 8px; font-size: 14px;">
                            {row.display_name ?? row.model ?? ''}
                          </td>
                          <td style="padding: 10px 16px; font-size: 14px; text-align: right; white-space: nowrap;">
                            {formatNumber(row.total_tokens ?? 0)}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </Show>
            </div>
          </div>
        </div>

        {/* ── 4. Providers table ───────────────────────────────────────── */}
        <Show when={providerTotals().length > 0}>
          <div class="panel scroll-panel" style="margin-bottom: 0; margin-top: 24px;">
            <div class="panel__title">Providers</div>
            <div
              class="scroll-panel__body"
              style="max-height: 480px; overflow-y: auto;"
              onScroll={(e) => {
                const el = e.currentTarget;
                const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
                el.parentElement?.classList.toggle('scroll-panel--at-bottom', atBottom);
              }}
            >
              <table style="width: 100%; border-collapse: collapse;">
                <tbody>
                  <For each={providerTotals()}>
                    {(row) => (
                      <tr>
                        <td style="padding: 10px 16px; font-size: 14px;">
                          <div style="display: flex; align-items: center; gap: 8px;">
                            {providerIcon(row.provider, 16)}
                            <span>{providerDisplayName(row.provider)}</span>
                          </div>
                        </td>
                        <td style="padding: 10px 8px; font-size: 14px; text-align: right; white-space: nowrap;">
                          {formatNumber(row.tokens)}
                        </td>
                        <td style="padding: 10px 16px; width: 80px;">
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <div
                              style={{
                                width: '60px',
                                height: '6px',
                                'border-radius': '3px',
                                background: 'hsl(var(--muted) / 0.3)',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${row.pct}%`,
                                  height: '100%',
                                  'border-radius': '3px',
                                  background: '#1cc4bf',
                                }}
                              />
                            </div>
                            <span style="font-size: 12px; color: hsl(var(--muted-foreground)); min-width: 32px; text-align: right;">
                              {row.pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default AgentOverview;
