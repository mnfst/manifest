import { Meta, Title } from '@solidjs/meta';
import { A, useLocation, useNavigate, useParams } from '@solidjs/router';
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  on,
  Show,
  type Component,
} from 'solid-js';
import UnifiedChartCard from '../components/UnifiedChartCard.jsx';
import AutofixKpiCards from '../components/AutofixKpiCards.jsx';

import FilterSelect from '../components/FilterSelect.jsx';
import { AGENT_COLORS } from '../components/MultiAgentTokenChart.jsx';
import CostByModelTable from '../components/CostByModelTable.jsx';
import ErrorState from '../components/ErrorState.jsx';
import MessageTable from '../components/MessageTable.jsx';
import OverviewSkeleton from '../components/OverviewSkeleton.jsx';
import Select from '../components/Select.jsx';
import SetupModal from '../components/SetupModal.jsx';
import { type MessageRow } from '../components/message-table-types.js';
import { agentDisplayName } from '../services/agent-display-name.js';
import { agentPlatform, agentCategory } from '../services/agent-platform-store.js';
import { PROVIDERS } from '../services/providers.js';
import { getOverview } from '../services/api.js';
import {
  getAutofixTimeseries,
  getPerModelReliability,
  getPerProviderTimeseries,
  getPerProviderMessageTimeseries,
  getPerProviderCostTimeseries,
} from '../services/api/analytics.js';
import { preloadModelDisplayNames } from '../services/model-display.js';
import { isRecentlyCreated, isSetupPending, clearSetupPending } from '../services/recent-agents.js';
import { messagePing } from '../services/sse.js';
import {
  RANGE_STORAGE_KEY,
  VALID_RANGES,
  useOverviewColumns,
  useOverviewRange,
} from '../services/use-overview-range.js';
import { getBillingStatus } from '../services/api/billing.js';
import '../styles/overview.css';
import '../styles/charts.css';
import '../styles/routing.css';
import { getAutofixStats } from '../services/api/analytics.js';
import { getAutofixCohort } from '../services/api/autofix.js';

const PRO_RANGES = new Set(['30d', '90d', '365d']);
const AGENT_RANGE_OPTIONS = [
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Last 365 days', value: '365d' },
];

interface OverviewData {
  summary: {
    tokens_today: {
      value: number;
      trend_pct: number;
      sub_values?: { input: number; output: number };
    };
    cost_today: { value: number; trend_pct: number };
    messages: { value: number; trend_pct: number };
    services_hit: { total: number; healthy: number; issues: number };
  };
  request_reliability: {
    total: number;
    successful: number;
    success_rate: number;
    attempt_success_rate: number;
    manifest_lift_pct: number;
    recovered: number;
  };
  token_usage: Array<{
    hour?: string;
    date?: string;
    input_tokens: number;
    output_tokens: number;
  }>;
  cost_usage: Array<{ hour?: string; date?: string; cost: number }>;
  message_usage: Array<{ hour?: string; date?: string; count: number }>;
  cost_by_model: Array<{
    model: string;
    display_name?: string;
    tokens: number;
    share_pct: number;
    estimated_cost: number;
    auth_type: string | null;
    provider?: string | null;
  }>;
  recent_activity: MessageRow[];
  active_skills: Array<{
    name: string;
    agent_name: string | null;
    run_count: number;
    last_active_at: string;
    status: string;
  }>;
  has_data?: boolean;
  has_providers?: boolean;
}

type PivotedTimeseries = {
  agents: string[];
  timeseries: Array<Record<string, number | string>>;
};

type ProviderView = 'requests' | 'selfheal' | 'cost' | 'tokens';
type TimeseriesKey = { range: string; agent: string; _ping: number };

const Overview: Component = () => {
  const params = useParams<{ agentName: string }>();
  const location = useLocation<{ newApiKey?: string }>();
  const navigate = useNavigate();
  preloadModelDisplayNames();
  const [billing] = createResource(async () => {
    try {
      return await getBillingStatus();
    } catch {
      return null;
    }
  });
  const isFreePlan = () => billing()?.enabled && billing()?.plan === 'free';
  const shouldLockProRanges = () => billing.loading || isFreePlan();
  const isProRangeLocked = (value: string) => shouldLockProRanges() && PRO_RANGES.has(value);
  const proBadge = () => (
    <span class="pro-range-badge" aria-label="Pro plan required">
      PRO
    </span>
  );
  const agentRangeOptions = () =>
    AGENT_RANGE_OPTIONS.map((opt) =>
      isProRangeLocked(opt.value) ? { ...opt, disabled: true, badge: proBadge() } : opt,
    );
  const { columns } = useOverviewColumns();
  // Only treat the stored value as a user selection when it is actually valid.
  // An invalid stored range falls through to the smart-range cascade.
  const [userSelectedRange, setUserSelectedRange] = createSignal(
    VALID_RANGES.has(localStorage.getItem(RANGE_STORAGE_KEY) ?? ''),
  );
  const { range, setRange, handleRangeChange } = useOverviewRange({
    markUserSelected: () => setUserSelectedRange(true),
  });
  const effectiveRange = createMemo(() => (isProRangeLocked(range()) ? '7d' : range()));
  const [activeView, setActiveViewRaw] = createSignal<ProviderView>('requests');
  const [tokenChartRequested, setTokenChartRequested] = createSignal(false);
  const [costChartRequested, setCostChartRequested] = createSignal(false);
  const setActiveView = (view: ProviderView) => {
    if (view === 'tokens') setTokenChartRequested(true);
    if (view === 'cost') setCostChartRequested(true);
    setActiveViewRaw(view);
  };
  // Open gate keys off a persistent "setup pending" flag (localStorage) so the
  // modal reliably reopens after a page refresh until the user dismisses or
  // completes it; `isRecentlyCreated` is an in-session OR that need not survive
  // reloads. The completed/dismissed flags are the backstop against re-opening.
  const [setupOpen, setSetupOpen] = createSignal(
    (isSetupPending(decodeURIComponent(params.agentName)) ||
      isRecentlyCreated(decodeURIComponent(params.agentName))) &&
      !localStorage.getItem(`setup_completed_${params.agentName}`) &&
      !localStorage.getItem(`setup_dismissed_${params.agentName}`),
  );
  const [setupCompleted, setSetupCompleted] = createSignal(
    !!localStorage.getItem(`setup_completed_${params.agentName}`),
  );

  const [data, { refetch }] = createResource(
    () =>
      billing.loading
        ? false
        : { range: effectiveRange(), agentName: params.agentName, _ping: messagePing() },
    (p) => getOverview(p.range, p.agentName) as Promise<OverviewData>,
  );

  const showDashboard = () => {
    const d = data();
    return !!d && (d.has_data !== false || d.has_providers === true);
  };

  const showEmptyState = () => {
    const d = data();
    return !!d && d.has_data === false && !d.has_providers;
  };

  createEffect(() => {
    if (isFreePlan() && PRO_RANGES.has(range())) {
      handleRangeChange('7d');
      return;
    }
    if (
      showEmptyState() &&
      !setupCompleted() &&
      !localStorage.getItem(`setup_dismissed_${params.agentName}`)
    ) {
      setSetupOpen(true);
    }
  });

  const SMART_RANGES: string[] = ['30d', '7d', '24h'];

  // Step the chart range down to the next bucket while it has no data, but only
  // after a fetch resolves — `defer: true` skips the no-op run at mount where
  // `data()` is still undefined. Both `data` and `range` are tracked so the
  // cascade keeps re-firing as it steps 30d → 7d → 24h.
  createEffect(
    on(
      [data, range],
      ([d, currentRange]) => {
        if (userSelectedRange()) return;
        if (!d || (d.has_data === false && !d.has_providers)) return;
        const hasData =
          (d.token_usage?.length ?? 0) > 0 ||
          (d.cost_usage?.length ?? 0) > 0 ||
          (d.message_usage?.length ?? 0) > 0;
        if (hasData) return;
        const currentIdx = SMART_RANGES.indexOf(currentRange);
        if (currentIdx < 0 || currentIdx >= SMART_RANGES.length - 1) return;
        setRange(SMART_RANGES[currentIdx + 1]!);
      },
      { defer: true },
    ),
  );

  // ── Provider breakdown (per-agent, grouped by provider) ─────────────
  const providerFilterKey = () => `agent-overview-providers:${params.agentName}`;
  const loadSavedProviders = (): Set<string> => {
    try {
      const saved = sessionStorage.getItem(providerFilterKey());
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch {
      /* ignore */
    }
    return new Set();
  };
  const [selectedProviders, setSelectedProviders] = createSignal<Set<string>>(loadSavedProviders());

  const tsKey = (): TimeseriesKey => ({
    range: effectiveRange(),
    agent: params.agentName,
    _ping: messagePing(),
  });
  const [providerTokenTs] = createResource(
    () => (tokenChartRequested() && !billing.loading ? tsKey() : false),
    (p) => getPerProviderTimeseries(p.agent, p.range) as Promise<PivotedTimeseries>,
  );
  const [providerMessageTs] = createResource(
    () => (billing.loading ? false : tsKey()),
    (p) => getPerProviderMessageTimeseries(p.agent, p.range) as Promise<PivotedTimeseries>,
  );
  const [providerCostTs] = createResource(
    () => (costChartRequested() && !billing.loading ? tsKey() : false),
    (p) => getPerProviderCostTimeseries(p.agent, p.range) as Promise<PivotedTimeseries>,
  );

  // ── Auto-fix resources (conditional on tenant cohort) ───────────────
  const [autofixCohort] = createResource(
    () => ({ _ping: messagePing() }),
    () => getAutofixCohort(),
  );
  const autofixEligible = () => autofixCohort()?.eligible ?? false;
  const [autofixStats] = createResource(
    () =>
      autofixEligible()
        ? {
            range: effectiveRange(),
            agent: decodeURIComponent(params.agentName),
            _ping: messagePing(),
          }
        : false,
    (p) => getAutofixStats(p.range, p.agent),
  );
  // Disposition timeseries feeds the Self-healed requests tab (healed +
  // fallback series only), agent-scoped and gated like the KPI cards.
  const [statusTimeseries] = createResource(
    () =>
      autofixEligible()
        ? {
            range: effectiveRange(),
            agent: decodeURIComponent(params.agentName),
            _ping: messagePing(),
          }
        : false,
    (p) => getAutofixTimeseries(p.range, 'disposition', p.agent),
  );
  const [modelReliability] = createResource(
    () =>
      autofixEligible()
        ? {
            range: effectiveRange(),
            agent: decodeURIComponent(params.agentName),
            _ping: messagePing(),
          }
        : false,
    (p) => getPerModelReliability(p.range, p.agent),
  );
  const selfHealedTs = () => {
    const ts = statusTimeseries();
    if (!ts) return undefined;
    const picked = ts.keys
      .map((k, i) => ({ k, i }))
      .filter(({ k }) => k === 'healed' || k === 'fallback');
    return {
      ...ts,
      keys: picked.map(({ k }) => k),
      buckets: ts.buckets.map((b) => ({
        bucket: b.bucket,
        counts: picked.map(({ i }) => b.counts[i] ?? 0),
      })),
    };
  };

  const allProviders = createMemo(() => {
    const set = new Set<string>([
      ...(providerTokenTs()?.agents ?? []),
      ...(providerMessageTs()?.agents ?? []),
      ...(providerCostTs()?.agents ?? []),
    ]);
    return [...set].sort();
  });

  const providerColorMap = createMemo(() => {
    const map: Record<string, string> = {};
    const list = allProviders();
    for (let i = 0; i < list.length; i++) map[list[i]!] = AGENT_COLORS[i % AGENT_COLORS.length]!;
    return map;
  });

  const effectiveSelected = () => {
    const sel = selectedProviders();
    if (sel.size === 0 && allProviders().length > 0) return new Set(allProviders());
    return sel;
  };
  const persistProviders = (next: Set<string>) => {
    setSelectedProviders(next);
    try {
      sessionStorage.setItem(providerFilterKey(), JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  };
  const toggleProvider = (provider: string) => {
    const next = new Set(effectiveSelected());
    if (next.has(provider)) next.delete(provider);
    else next.add(provider);
    persistProviders(next);
  };
  const setAllProviders = (on: boolean) =>
    persistProviders(on ? new Set(allProviders()) : new Set<string>());

  const filterTs = (raw: PivotedTimeseries | undefined): PivotedTimeseries | undefined => {
    if (!raw) return undefined;
    const sel = effectiveSelected();
    if (sel.size === 0) return raw;
    return {
      agents: raw.agents.filter((a) => sel.has(a)),
      timeseries: raw.timeseries.map((row) => {
        const out: Record<string, number | string> = {};
        for (const [k, v] of Object.entries(row)) {
          if (k === 'hour' || k === 'date' || sel.has(k)) out[k] = v;
        }
        return out;
      }),
    };
  };
  const filteredTokenTs = createMemo(() => filterTs(providerTokenTs()));
  const filteredMessageTs = createMemo(() => filterTs(providerMessageTs()));
  const filteredCostTs = createMemo(() => filterTs(providerCostTs()));

  const providerDisplayName = (provId: string): string =>
    PROVIDERS.find((p) => p.id === provId)?.name ?? provId;

  return (
    <div class="container--lg">
      <Title>
        {agentDisplayName() ?? decodeURIComponent(params.agentName)} Overview - Manifest
      </Title>
      <Meta
        name="description"
        content={`Monitor ${agentDisplayName() ?? decodeURIComponent(params.agentName)} performance — costs, tokens, and activity.`}
      />
      <div
        class="page-header"
        style="justify-content: flex-end; border-bottom: none; padding-bottom: 0;"
      >
        <div class="header-controls">
          <Show when={showDashboard()}>
            <Select
              value={range()}
              onChange={(v) => {
                if (isProRangeLocked(v)) return;
                handleRangeChange(v);
              }}
              options={agentRangeOptions()}
            />
          </Show>
          <Show when={showEmptyState() && !setupCompleted()}>
            <button class="btn btn--primary btn--sm" onClick={() => setSetupOpen(true)}>
              Set up harness
            </button>
          </Show>
        </div>
      </div>

      <Show
        when={!billing.loading && (data() !== undefined || !data.loading)}
        fallback={<OverviewSkeleton />}
      >
        <Show when={!data.error} fallback={<ErrorState error={data.error} onRetry={refetch} />}>
          <Show when={showEmptyState()}>
            <Show
              when={setupCompleted()}
              fallback={
                <div class="empty-state">
                  <div class="empty-state__title">No activity yet</div>
                  <p>Set up your harness and send a message. Usage data shows up here.</p>
                  <button
                    class="btn btn--primary btn--sm"
                    style="margin-top: var(--gap-md);"
                    onClick={() => setSetupOpen(true)}
                  >
                    Set up harness
                  </button>
                  <div class="empty-state__img-wrapper">
                    <img
                      src="/example-overview.svg"
                      alt="Example dashboard overview showing cost and token charts"
                      class="empty-state__img"
                      loading="lazy"
                    />
                  </div>
                </div>
              }
            >
              <div class="empty-state">
                <div class="empty-state__title">No activity yet</div>
                <p>Connect a provider to start routing LLM calls.</p>
                <button
                  class="btn btn--primary btn--sm"
                  style="margin-top: var(--gap-md);"
                  onClick={() =>
                    navigate(`/harnesses/${encodeURIComponent(params.agentName)}/routing`, {
                      state: { openProviders: true },
                    })
                  }
                >
                  Connect provider
                </button>
                <div class="empty-state__img-wrapper">
                  <img
                    src="/example-overview.svg"
                    alt="Example dashboard overview showing cost and token charts"
                    class="empty-state__img"
                    loading="lazy"
                  />
                </div>
              </div>
            </Show>
          </Show>
          <Show when={showDashboard()}>
            {(_summary) => {
              const d = () => data() as OverviewData;
              return (
                <>
                  <Show when={d().has_data === false}>
                    <div class="waiting-banner">
                      <i class="bxd bx-florist" />
                      <p>
                        No activity yet. Your dashboard updates seconds after the first LLM call.
                      </p>
                    </div>
                  </Show>
                  <Show when={autofixEligible()}>
                    <AutofixKpiCards stats={autofixStats()} />
                  </Show>
                  {(() => {
                    return (
                      <UnifiedChartCard
                        activeTab={activeView()}
                        onTabChange={setActiveView}
                        requestsValue={d().summary?.messages?.value ?? 0}
                        requestsTrendPct={d().summary?.messages?.trend_pct ?? 0}
                        selfHealedValue={
                          (autofixStats()?.autofix_saves.value ?? 0) +
                          (autofixStats()?.fallback_saves?.value ?? 0)
                        }
                        selfHealedTrendPct={(() => {
                          const s = autofixStats();
                          if (!s) return 0;
                          const cur = s.autofix_saves.value + (s.fallback_saves?.value ?? 0);
                          const prev = s.autofix_saves.previous + (s.fallback_saves?.previous ?? 0);
                          if (prev === 0) return 0;
                          return Math.max(
                            -999,
                            Math.min(999, Math.round(((cur - prev) / prev) * 100)),
                          );
                        })()}
                        selfHealedTimeseries={autofixEligible() ? selfHealedTs() : undefined}
                        costValue={d().summary?.cost_today?.value ?? 0}
                        costTrendPct={d().summary?.cost_today?.trend_pct ?? 0}
                        costInfoTooltip="Actual API key costs only. Subscription usage is not included."
                        tokensValue={d().summary?.tokens_today?.value ?? 0}
                        tokensTrendPct={d().summary?.tokens_today?.trend_pct ?? 0}
                        range={effectiveRange()}
                        agentRequestTimeseries={filteredMessageTs() ?? undefined}
                        agentTimeseries={filteredTokenTs() ?? undefined}
                        agentCostTimeseries={filteredCostTs() ?? undefined}
                        colorMap={providerColorMap()}
                        seriesFilters={
                          <Show when={allProviders().length > 1}>
                            <FilterSelect
                              noun="providers"
                              items={allProviders()}
                              selected={effectiveSelected()}
                              colorMap={providerColorMap()}
                              displayName={providerDisplayName}
                              onToggle={toggleProvider}
                              onSelectAll={() => setAllProviders(true)}
                              onUnselectAll={() => setAllProviders(false)}
                            />
                          </Show>
                        }
                      />
                    );
                  })()}

                  {/* "Error classes by frequency" stays unmounted until the
                      backend has real error_class data (preservation spec). */}

                  {/* Recent Requests */}
                  <div class="panel">
                    <div
                      class="panel__title"
                      style="display: flex; justify-content: space-between; align-items: center;"
                    >
                      Recent Requests
                      <A href={`/harnesses/${params.agentName}/messages`} class="view-more-link">
                        View more
                      </A>
                    </div>
                    <MessageTable
                      items={d().recent_activity?.slice(0, 5) ?? []}
                      columns={columns()}
                      agentName={params.agentName}
                      customProviderName={() => undefined}
                      // A row you can see is a row you can open: without this the
                      // panel showed failures whose detail was unreachable.
                      expandable
                    />
                  </div>

                  <CostByModelTable
                    rows={d().cost_by_model ?? []}
                    reliability={autofixEligible() ? modelReliability() : undefined}
                  />
                </>
              );
            }}
          </Show>
        </Show>
      </Show>

      <SetupModal
        open={setupOpen()}
        agentName={decodeURIComponent(params.agentName)}
        apiKey={(location.state as { newApiKey?: string } | undefined)?.newApiKey ?? null}
        agentPlatform={agentPlatform()}
        agentCategory={agentCategory()}
        onClose={() => {
          localStorage.setItem(`setup_dismissed_${params.agentName}`, '1');
          clearSetupPending(decodeURIComponent(params.agentName));
          setSetupOpen(false);
        }}
        onDone={() => {
          localStorage.setItem(`setup_completed_${params.agentName}`, '1');
          clearSetupPending(decodeURIComponent(params.agentName));
          setSetupCompleted(true);
        }}
        onGoToRouting={() => {
          navigate(`/harnesses/${encodeURIComponent(params.agentName)}/routing`, {
            state: { openProviders: true },
          });
        }}
      />
    </div>
  );
};

export default Overview;
