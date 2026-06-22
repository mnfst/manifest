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
import ProviderChartCard from '../components/ProviderChartCard.jsx';
import FilterSelect from '../components/FilterSelect.jsx';
import { AGENT_COLORS } from '../components/MultiAgentTokenChart.jsx';
import CostByModelTable from '../components/CostByModelTable.jsx';
import ErrorState from '../components/ErrorState.jsx';
import FeedbackModal from '../components/FeedbackModal.jsx';
import MessageTable from '../components/MessageTable.jsx';
import OverviewSkeleton from '../components/OverviewSkeleton.jsx';
import Select from '../components/Select.jsx';
import SetupModal from '../components/SetupModal.jsx';
import { type MessageRow } from '../components/message-table-types.js';
import { agentDisplayName } from '../services/agent-display-name.js';
import { agentPlatform, agentCategory } from '../services/agent-platform-store.js';
import { PROVIDERS } from '../services/providers.js';
import { getOverview, setMessageFeedback, clearMessageFeedback } from '../services/api.js';
import {
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
import '../styles/overview.css';
import '../styles/charts.css';
import '../styles/routing.css';

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

type ProviderView = 'cost' | 'tokens' | 'messages';
type TimeseriesKey = { range: string; agent: string; _ping: number };

const Overview: Component = () => {
  const params = useParams<{ agentName: string }>();
  const location = useLocation<{ newApiKey?: string }>();
  const navigate = useNavigate();
  preloadModelDisplayNames();
  const { isSelfHosted, columns } = useOverviewColumns();
  // Only treat the stored value as a user selection when it is actually valid.
  // An invalid stored range falls through to the smart-range cascade.
  const [userSelectedRange, setUserSelectedRange] = createSignal(
    VALID_RANGES.has(localStorage.getItem(RANGE_STORAGE_KEY) ?? ''),
  );
  const { range, setRange, handleRangeChange } = useOverviewRange({
    markUserSelected: () => setUserSelectedRange(true),
  });
  const [activeView, setActiveViewRaw] = createSignal<ProviderView>('messages');
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
  const [feedbackModalOpen, setFeedbackModalOpen] = createSignal(false);
  const [feedbackMessageId, setFeedbackMessageId] = createSignal('');
  const [feedbackOverrides, setFeedbackOverrides] = createSignal<Record<string, string | null>>({});

  const applyFeedbackOverrides = (items: MessageRow[]): MessageRow[] => {
    const overrides = feedbackOverrides();
    return items.map((item) =>
      item.id in overrides ? { ...item, feedback_rating: overrides[item.id] ?? undefined } : item,
    );
  };

  const handleFeedbackLike = (id: string) => {
    setFeedbackOverrides((prev) => ({ ...prev, [id]: 'like' }));
    setMessageFeedback(id, { rating: 'like' }).catch(() => {
      setFeedbackOverrides((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    });
  };

  const handleFeedbackDislike = (id: string) => {
    setFeedbackOverrides((prev) => ({ ...prev, [id]: 'dislike' }));
    setFeedbackMessageId(id);
    setFeedbackModalOpen(true);
    setMessageFeedback(id, { rating: 'dislike' }).catch(() => {
      setFeedbackOverrides((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    });
  };

  const handleFeedbackClear = (id: string) => {
    setFeedbackOverrides((prev) => ({ ...prev, [id]: null }));
    clearMessageFeedback(id).catch(() => {
      setFeedbackOverrides((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    });
  };

  const handleFeedbackSubmit = (tags: string[], details: string) => {
    const id = feedbackMessageId();
    if (id) {
      setMessageFeedback(id, { rating: 'dislike', tags, details });
    }
    setFeedbackModalOpen(false);
  };

  const [data, { refetch }] = createResource(
    () => ({ range: range(), agentName: params.agentName, _ping: messagePing() }),
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
    range: range(),
    agent: params.agentName,
    _ping: messagePing(),
  });
  const [providerTokenTs] = createResource(
    () => (tokenChartRequested() ? tsKey() : false),
    (p) => getPerProviderTimeseries(p.agent, p.range) as Promise<PivotedTimeseries>,
  );
  const [providerMessageTs] = createResource(
    tsKey,
    (p) => getPerProviderMessageTimeseries(p.agent, p.range) as Promise<PivotedTimeseries>,
  );
  const [providerCostTs] = createResource(
    () => (costChartRequested() ? tsKey() : false),
    (p) => getPerProviderCostTimeseries(p.agent, p.range) as Promise<PivotedTimeseries>,
  );

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
          <Show when={showDashboard() && allProviders().length > 1}>
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
          <Show when={showDashboard()}>
            <Select
              value={range()}
              onChange={handleRangeChange}
              options={[
                { label: 'Last 24 hours', value: '24h' },
                { label: 'Last 7 days', value: '7d' },
                { label: 'Last 30 days', value: '30d' },
              ]}
            />
          </Show>
          <Show when={showEmptyState() && !setupCompleted()}>
            <button class="btn btn--primary btn--sm" onClick={() => setSetupOpen(true)}>
              Set up harness
            </button>
          </Show>
        </div>
      </div>

      <Show when={data() !== undefined || !data.loading} fallback={<OverviewSkeleton />}>
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
                  <ProviderChartCard
                    activeView={activeView()}
                    onViewChange={setActiveView}
                    costValue={d().summary?.cost_today?.value ?? 0}
                    costTrendPct={d().summary?.cost_today?.trend_pct ?? 0}
                    tokensValue={d().summary?.tokens_today?.value ?? 0}
                    tokensTrendPct={d().summary?.tokens_today?.trend_pct ?? 0}
                    messagesValue={d().summary?.messages?.value ?? 0}
                    messagesTrendPct={d().summary?.messages?.trend_pct ?? 0}
                    costInfoTooltip="Actual API key costs only. Subscription usage is not included."
                    range={range()}
                    agentTimeseries={filteredTokenTs() ?? undefined}
                    agentMessageTimeseries={filteredMessageTs() ?? undefined}
                    agentCostTimeseries={filteredCostTs() ?? undefined}
                    colorMap={providerColorMap()}
                  />

                  {/* Recent Messages */}
                  <div class="panel">
                    <div
                      class="panel__title"
                      style="display: flex; justify-content: space-between; align-items: center;"
                    >
                      Recent Messages
                      <A href={`/harnesses/${params.agentName}/messages`} class="view-more-link">
                        View more
                      </A>
                    </div>
                    <MessageTable
                      items={
                        isSelfHosted()
                          ? (d().recent_activity?.slice(0, 5) ?? [])
                          : applyFeedbackOverrides(d().recent_activity?.slice(0, 5) ?? [])
                      }
                      columns={columns()}
                      agentName={params.agentName}
                      customProviderName={() => undefined}
                      onFeedbackLike={isSelfHosted() ? undefined : handleFeedbackLike}
                      onFeedbackDislike={isSelfHosted() ? undefined : handleFeedbackDislike}
                      onFeedbackClear={isSelfHosted() ? undefined : handleFeedbackClear}
                    />
                  </div>

                  <CostByModelTable rows={d().cost_by_model ?? []} />
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

      <Show when={!isSelfHosted()}>
        <FeedbackModal
          open={feedbackModalOpen()}
          onClose={() => setFeedbackModalOpen(false)}
          onSubmit={handleFeedbackSubmit}
        />
      </Show>
    </div>
  );
};

export default Overview;
