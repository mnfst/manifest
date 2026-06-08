import { Meta, Title } from '@solidjs/meta';
import { A } from '@solidjs/router';
import { createMemo, createResource, createSignal, onMount, Show, type Component } from 'solid-js';
import ChartCard from '../components/ChartCard.jsx';
import CostByModelTable from '../components/CostByModelTable.jsx';
import ErrorState from '../components/ErrorState.jsx';
import MessageTable from '../components/MessageTable.jsx';
import OverviewSkeleton from '../components/OverviewSkeleton.jsx';
import Select from '../components/Select.jsx';
import { COMPACT_COLUMNS, type MessageRow } from '../components/message-table-types.js';
import { getOverview } from '../services/api.js';
import { preloadModelDisplayNames } from '../services/model-display.js';
import { checkIsSelfHosted } from '../services/setup-status.js';
import { messagePing } from '../services/sse.js';
import '../styles/overview.css';

interface GlobalOverviewData {
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
  has_data?: boolean;
  has_providers?: boolean;
}

const GlobalOverview: Component = () => {
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

  const handleRangeChange = (value: string) => {
    setRange(value);
    localStorage.setItem(RANGE_STORAGE_KEY, value);
  };

  const [activeView, setActiveView] = createSignal<'cost' | 'tokens' | 'messages' | 'savings'>(
    'messages',
  );

  // Global overview: no agentName → tenant-wide aggregation
  const [data, { refetch }] = createResource(
    () => ({ range: range(), _ping: messagePing() }),
    (p) => getOverview(p.range) as Promise<GlobalOverviewData>,
  );

  // Empty state is keyed off has_data, NOT has_providers.
  // has_providers is always false in global mode (overview.controller.ts:63-64).
  const showEmptyState = () => {
    const d = data();
    return !!d && d.has_data === false;
  };

  const showDashboard = () => {
    const d = data();
    return !!d && d.has_data !== false;
  };

  const messageChartData = createMemo(() => {
    const src = data()?.message_usage;
    return src?.map((d) => ({ time: d.hour ?? d.date ?? '', value: d.count })) ?? [];
  });

  return (
    <div class="container--lg">
      <Title>Overview - Manifest</Title>
      <Meta name="description" content="Tenant-wide overview — costs, tokens, and activity." />
      <div class="page-header">
        <div>
          <h1>Overview</h1>
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
        </div>
      </div>

      <Show when={data() !== undefined || !data.loading} fallback={<OverviewSkeleton />}>
        <Show when={!data.error} fallback={<ErrorState error={data.error} onRetry={refetch} />}>
          <Show when={showEmptyState()}>
            <div class="empty-state">
              <div class="empty-state__title">No activity yet</div>
              <p>Create an agent and send a message. Usage data shows up here.</p>
              <A href="/agents" class="btn btn--primary btn--sm" style="margin-top: var(--gap-md);">
                Go to Agents
              </A>
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
          <Show when={showDashboard()}>
            {(_) => {
              const d = () => data() as GlobalOverviewData;
              return (
                <>
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
                      <A href="/messages" class="view-more-link">
                        View more
                      </A>
                    </div>
                    <MessageTable
                      items={d().recent_activity?.slice(0, 5) ?? []}
                      columns={columns()}
                      agentName=""
                      customProviderName={() => undefined}
                    />
                  </div>

                  <CostByModelTable
                    rows={d().cost_by_model ?? []}
                    customProviderName={() => undefined}
                  />
                </>
              );
            }}
          </Show>
        </Show>
      </Show>
    </div>
  );
};

export default GlobalOverview;
