import { Meta, Title } from '@solidjs/meta';
import { A, useLocation, useNavigate, useParams } from '@solidjs/router';
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onMount,
  Show,
  type Component,
} from 'solid-js';
import ChartCard from '../components/ChartCard.jsx';
import CostByModelTable from '../components/CostByModelTable.jsx';
import ErrorState from '../components/ErrorState.jsx';
import FeedbackModal from '../components/FeedbackModal.jsx';
import MessageTable from '../components/MessageTable.jsx';
import OverviewSkeleton from '../components/OverviewSkeleton.jsx';
import Select from '../components/Select.jsx';
import SetupModal from '../components/SetupModal.jsx';
import { COMPACT_COLUMNS, type MessageRow } from '../components/message-table-types.js';
import { agentDisplayName } from '../services/agent-display-name.js';
import {
  agentPlatform,
  agentCategory,
  agentPlatformIcon,
} from '../services/agent-platform-store.js';
import {
  getCustomProviders,
  getOverview,
  setMessageFeedback,
  clearMessageFeedback,
  type CustomProviderData,
} from '../services/api.js';
import { preloadModelDisplayNames } from '../services/model-display.js';
import { isRecentlyCreated } from '../services/recent-agents.js';
import { checkIsSelfHosted } from '../services/setup-status.js';
import { pingCount } from '../services/sse.js';
import '../styles/overview.css';

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

const Overview: Component = () => {
  const params = useParams<{ agentName: string }>();
  const location = useLocation<{ newApiKey?: string }>();
  const navigate = useNavigate();
  preloadModelDisplayNames();
  const [isSelfHosted, setIsSelfHosted] = createSignal(false);
  onMount(() => {
    checkIsSelfHosted().then(setIsSelfHosted);
  });
  const columns = () =>
    isSelfHosted() ? COMPACT_COLUMNS.filter((c) => c !== 'feedback') : COMPACT_COLUMNS;
  const RANGE_STORAGE_KEY = 'manifest_chart_range';
  const VALID_RANGES = new Set(['24h', '7d', '30d']);
  const savedRange = localStorage.getItem(RANGE_STORAGE_KEY);
  const [range, setRange] = createSignal(
    savedRange && VALID_RANGES.has(savedRange) ? savedRange : '30d',
  );
  const [userSelectedRange, setUserSelectedRange] = createSignal(!!savedRange);

  const handleRangeChange = (value: string) => {
    setRange(value);
    setUserSelectedRange(true);
    localStorage.setItem(RANGE_STORAGE_KEY, value);
  };
  const [activeView, setActiveView] = createSignal<'cost' | 'tokens' | 'messages'>('messages');
  const [setupOpen, setSetupOpen] = createSignal(
    isRecentlyCreated(decodeURIComponent(params.agentName)),
  );
  const [setupCompleted, setSetupCompleted] = createSignal(
    !!localStorage.getItem(`setup_completed_${params.agentName}`),
  );
  const [customProviders] = createResource(
    () => params.agentName,
    (name) => getCustomProviders(decodeURIComponent(name)),
  );

  const customProviderName = (model: string): string | undefined => {
    const match = model.match(/^custom:([^/]+)\//);
    if (!match) return undefined;
    const id = match[1];
    return customProviders()?.find((cp: CustomProviderData) => cp.id === id)?.name;
  };

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
    () => ({ range: range(), agentName: params.agentName, _ping: pingCount() }),
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

  createEffect(() => {
    if (userSelectedRange()) return;
    const d = data();
    if (!d || (d.has_data === false && !d.has_providers)) return;
    const hasData =
      (d.token_usage?.length ?? 0) > 0 ||
      (d.cost_usage?.length ?? 0) > 0 ||
      (d.message_usage?.length ?? 0) > 0;
    if (hasData) return;
    const currentIdx = SMART_RANGES.indexOf(range());
    if (currentIdx < 0 || currentIdx >= SMART_RANGES.length - 1) return;
    setRange(SMART_RANGES[currentIdx + 1]!);
  });

  const messageChartData = createMemo(() => {
    const src = data()?.message_usage;
    return src?.map((d) => ({ time: d.hour ?? d.date ?? '', value: d.count })) ?? [];
  });

  return (
    <div class="container--md">
      <Title>
        {agentDisplayName() ?? decodeURIComponent(params.agentName)} Overview - Manifest
      </Title>
      <Meta
        name="description"
        content={`Monitor ${agentDisplayName() ?? decodeURIComponent(params.agentName)} performance — costs, tokens, and activity.`}
      />
      <div class="page-header">
        <div>
          <h1 style="display: flex; align-items: center; gap: 10px;">
            <Show when={agentPlatformIcon()}>
              <img
                src={agentPlatformIcon()}
                alt=""
                width="28"
                height="28"
                class="overview__platform-icon"
                style="border-radius: 4px;"
              />
            </Show>
            {agentDisplayName() ?? decodeURIComponent(params.agentName)} Overview
          </h1>
          <span class="breadcrumb">Real-time summary of spending, tokens, and messages</span>
        </div>
        <div class="header-controls">
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
              Set up agent
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
                  <p>Set up your agent and send a message. Usage data shows up here.</p>
                  <button
                    class="btn btn--primary btn--sm"
                    style="margin-top: var(--gap-md);"
                    onClick={() => setSetupOpen(true)}
                  >
                    Set up agent
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
                    navigate(`/agents/${encodeURIComponent(params.agentName)}/routing`, {
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
                  <ChartCard
                    activeView={activeView()}
                    onViewChange={setActiveView}
                    costValue={d().summary?.cost_today?.value ?? 0}
                    costTrendPct={d().summary?.cost_today?.trend_pct ?? 0}
                    tokensValue={d().summary?.tokens_today?.value ?? 0}
                    tokensTrendPct={d().summary?.tokens_today?.trend_pct ?? 0}
                    messagesValue={d().summary?.messages?.value ?? 0}
                    messagesTrendPct={d().summary?.messages?.trend_pct ?? 0}
                    costUsage={d().cost_usage}
                    tokenUsage={d().token_usage}
                    messageChartData={messageChartData()}
                    range={range()}
                  />

                  {/* Recent Messages */}
                  <div class="panel">
                    <div
                      class="panel__title"
                      style="display: flex; justify-content: space-between; align-items: center;"
                    >
                      Recent Messages
                      <A href={`/agents/${params.agentName}/messages`} class="view-more-link">
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
                      customProviderName={customProviderName}
                      onFeedbackLike={isSelfHosted() ? undefined : handleFeedbackLike}
                      onFeedbackDislike={isSelfHosted() ? undefined : handleFeedbackDislike}
                      onFeedbackClear={isSelfHosted() ? undefined : handleFeedbackClear}
                    />
                  </div>

                  <CostByModelTable
                    rows={d().cost_by_model ?? []}
                    customProviderName={customProviderName}
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
          setSetupOpen(false);
        }}
        onDone={() => {
          localStorage.setItem(`setup_completed_${params.agentName}`, '1');
          setSetupCompleted(true);
        }}
        onGoToRouting={() => {
          navigate(`/agents/${encodeURIComponent(params.agentName)}/routing`, {
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
