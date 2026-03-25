import { Meta, Title } from '@solidjs/meta';
import { A, useLocation, useNavigate, useParams } from '@solidjs/router';
import { isRecentlyCreated } from '../services/recent-agents.js';
import { createEffect, createResource, createSignal, For, Show, type Component } from 'solid-js';
import CostChart from '../components/CostChart.jsx';
import ErrorState from '../components/ErrorState.jsx';
import InfoTooltip from '../components/InfoTooltip.jsx';
import Select from '../components/Select.jsx';
import SetupModal from '../components/SetupModal.jsx';
import SingleTokenChart from '../components/SingleTokenChart.jsx';
import TokenChart from '../components/TokenChart.jsx';
import { getOverview, getCustomProviders, type CustomProviderData } from '../services/api.js';
import {
  formatCost,
  formatErrorMessage,
  customProviderColor,
  formatNumber,
  formatStatus,
  formatTime,
} from '../services/formatters.js';
import {
  inferProviderFromModel,
  inferProviderName,
  stripCustomPrefix,
} from '../services/routing-utils.js';
import { getModelDisplayName, preloadModelDisplayNames } from '../services/model-display.js';
import { providerIcon } from '../components/ProviderIcon.jsx';
import { authBadgeFor, authLabel } from '../components/AuthBadge.js';
import { isLocalMode } from '../services/local-mode.js';
import { pingCount } from '../services/sse.js';
import { agentDisplayName } from '../services/agent-display-name.js';
import MessageTable from '../components/MessageTable.jsx';
import { COMPACT_COLUMNS, type MessageRow } from '../components/message-table-types.js';
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
}

type ActiveView = 'cost' | 'tokens' | 'messages';

const Overview: Component = () => {
  const params = useParams<{ agentName: string }>();
  const location = useLocation<{ newApiKey?: string }>();
  const navigate = useNavigate();
  preloadModelDisplayNames();
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
  const [activeView, setActiveView] = createSignal<ActiveView>('cost');
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

  const [data, { refetch }] = createResource(
    () => ({ range: range(), agentName: params.agentName, _ping: pingCount() }),
    (p) => getOverview(p.range, p.agentName) as Promise<OverviewData>,
  );

  const isNewAgent = () => {
    const d = data();
    return d && d.has_data === false;
  };

  createEffect(() => {
    if (isLocalMode() === true && params.agentName === 'local-agent') {
      localStorage.setItem(`setup_completed_${params.agentName}`, '1');
      setSetupCompleted(true);
      return;
    }
    if (
      isNewAgent() &&
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
    if (!d || d.has_data === false) return;
    const hasData =
      (d.token_usage?.length ?? 0) > 0 ||
      (d.cost_usage?.length ?? 0) > 0 ||
      (d.message_usage?.length ?? 0) > 0;
    if (hasData) return;
    const currentIdx = SMART_RANGES.indexOf(range());
    if (currentIdx < 0 || currentIdx >= SMART_RANGES.length - 1) return;
    setRange(SMART_RANGES[currentIdx + 1]!);
  });

  const trendBadge = (pct: number, value?: number, mode?: 'default' | 'inverted' | 'neutral') => {
    if (pct === 0) return null;
    // Don't show trend when the metric value itself is effectively zero
    if (value !== undefined && Math.abs(value) < 0.005) return null;
    // Clamp absurd percentages (safety net for floating-point edge cases)
    const clamped = Math.max(-999, Math.min(999, Math.round(pct)));
    if (clamped === 0) return null;
    let cls: string;
    if (mode === 'neutral') {
      cls = 'trend trend--neutral';
    } else if (mode === 'inverted') {
      cls = clamped > 0 ? 'trend trend--up-bad' : 'trend trend--down-good';
    } else {
      cls = clamped > 0 ? 'trend trend--up' : 'trend trend--down';
    }
    const sign = clamped > 0 ? '+' : '';
    return (
      <span class={cls}>
        {sign}
        {clamped}%
      </span>
    );
  };

  const getMessageChartData = () => {
    const src = data()?.message_usage;
    return src?.map((d) => ({ time: d.hour ?? d.date ?? '', value: d.count })) ?? [];
  };

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
          <h1>Overview</h1>
          <span class="breadcrumb">Real-time summary of spending, tokens, and messages</span>
        </div>
        <div class="header-controls">
          <Show when={!isNewAgent()}>
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
          <Show
            when={
              isNewAgent() &&
              !(isLocalMode() && params.agentName === 'local-agent') &&
              !setupCompleted()
            }
          >
            <button class="btn btn--primary btn--sm" onClick={() => setSetupOpen(true)}>
              Set up agent
            </button>
          </Show>
        </div>
      </div>

      <Show
        when={data() !== undefined || !data.loading}
        fallback={
          <>
            <div class="chart-card">
              <div class="chart-card__header">
                <div class="chart-card__stat chart-card__stat--active">
                  <span class="chart-card__label">Cost</span>
                  <div class="chart-card__value-row">
                    <div class="skeleton skeleton--text" style="width: 80px; height: 28px;" />
                  </div>
                </div>
                <div class="chart-card__stat">
                  <span class="chart-card__label">Token usage</span>
                  <div class="chart-card__value-row">
                    <div class="skeleton skeleton--text" style="width: 70px; height: 28px;" />
                  </div>
                </div>
                <div class="chart-card__stat">
                  <span class="chart-card__label">Messages</span>
                  <div class="chart-card__value-row">
                    <div class="skeleton skeleton--text" style="width: 50px; height: 28px;" />
                  </div>
                </div>
              </div>
              <div class="chart-card__body">
                <div class="skeleton skeleton--rect" style="width: 100%; height: 260px;" />
              </div>
            </div>
            <div class="panel">
              <div
                class="panel__title"
                style="display: flex; justify-content: space-between; align-items: center;"
              >
                Recent Messages
                <span class="view-more-link" style="pointer-events: none; opacity: 0.4;">
                  View more
                </span>
              </div>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Message</th>
                    <th>Cost</th>
                    <th>Model</th>
                    <th>Tokens</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={[1, 2, 3, 4, 5]}>
                    {() => (
                      <tr>
                        <td>
                          <div class="skeleton skeleton--text" style="width: 70%;" />
                        </td>
                        <td>
                          <div class="skeleton skeleton--text" style="width: 50%;" />
                        </td>
                        <td>
                          <div class="skeleton skeleton--text" style="width: 50%;" />
                        </td>
                        <td>
                          <div class="skeleton skeleton--text" style="width: 70%;" />
                        </td>
                        <td>
                          <div class="skeleton skeleton--text" style="width: 40%;" />
                        </td>
                        <td>
                          <div class="skeleton skeleton--text" style="width: 50%;" />
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
            <div class="panel" style="margin-top: var(--gap-lg);">
              <div class="panel__title">Cost by Model</div>
              <p style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground)); margin: -8px 0 12px;">
                How much each AI model is costing you
              </p>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Tokens</th>
                    <th>% of total</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={[1, 2, 3]}>
                    {() => (
                      <tr>
                        <td>
                          <div class="skeleton skeleton--text" style="width: 60%;" />
                        </td>
                        <td>
                          <div class="skeleton skeleton--text" style="width: 40%;" />
                        </td>
                        <td>
                          <div class="skeleton skeleton--text" style="width: 50%;" />
                        </td>
                        <td>
                          <div class="skeleton skeleton--text" style="width: 40%;" />
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </>
        }
      >
        <Show when={!data.error} fallback={<ErrorState error={data.error} onRetry={refetch} />}>
          <Show when={isNewAgent()}>
            <Show
              when={(isLocalMode() && params.agentName === 'local-agent') || setupCompleted()}
              fallback={
                <div class="empty-state">
                  <div class="empty-state__title">No activity yet</div>
                  <p>Connect your agent and send a message. Usage data shows up here.</p>
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
              <div class="waiting-banner">
                <i class="bxd bx-florist" />
                <p>
                  Waiting for data. Your dashboard will update within seconds of your agent's first
                  LLM call.
                </p>
              </div>
              <div class="demo-dashboard">
                <div class="chart-card">
                  <div class="chart-card__header">
                    <div class="chart-card__stat chart-card__stat--active">
                      <span class="chart-card__label">Cost</span>
                      <div class="chart-card__value-row">
                        <span class="chart-card__value">$0.00</span>
                      </div>
                    </div>
                    <div class="chart-card__stat">
                      <span class="chart-card__label">Token usage</span>
                      <div class="chart-card__value-row">
                        <span class="chart-card__value">0</span>
                      </div>
                    </div>
                    <div class="chart-card__stat">
                      <span class="chart-card__label">Messages</span>
                      <div class="chart-card__value-row">
                        <span class="chart-card__value">0</span>
                      </div>
                    </div>
                  </div>
                  <div class="chart-card__body">
                    <div style="height: 260px; color: hsl(var(--muted-foreground)); display: flex; align-items: center; justify-content: center;">
                      No data yet. Activity will appear once your agent starts sending messages.
                    </div>
                  </div>
                </div>
                <div class="panel">
                  <div
                    class="panel__title"
                    style="display: flex; justify-content: space-between; align-items: center;"
                  >
                    Recent Messages
                    <span class="view-more-link" style="pointer-events: none;">
                      View more
                    </span>
                  </div>
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Message</th>
                        <th>Cost</th>
                        <th>Model</th>
                        <th>Tokens</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td
                          colspan="6"
                          style="text-align: center; color: hsl(var(--muted-foreground)); padding: var(--gap-lg);"
                        >
                          Messages will appear here
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="panel" style="margin-top: var(--gap-lg);">
                  <div class="panel__title">Cost by Model</div>
                  <p style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground)); margin: -8px 0 12px;">
                    How much each AI model is costing you
                  </p>
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th>Tokens</th>
                        <th>% of total</th>
                        <th>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td
                          colspan="4"
                          style="text-align: center; color: hsl(var(--muted-foreground)); padding: var(--gap-lg);"
                        >
                          Model costs will appear here
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </Show>
          </Show>
          <Show when={data()?.summary && !isNewAgent()}>
            {(_summary) => {
              const d = () => data() as OverviewData;
              return (
                <>
                  {/* Chart card with clickable stats */}
                  <div class="chart-card">
                    <div class="chart-card__header">
                      <div
                        class="chart-card__stat chart-card__stat--clickable"
                        classList={{
                          'chart-card__stat--active': activeView() === 'cost',
                        }}
                        onClick={() => setActiveView('cost')}
                      >
                        <span class="chart-card__label">Cost</span>
                        <div class="chart-card__value-row">
                          <span class="chart-card__value">
                            {formatCost(d().summary?.cost_today?.value ?? 0) ?? '$0.00'}
                          </span>
                          {trendBadge(
                            d().summary?.cost_today?.trend_pct ?? 0,
                            d().summary?.cost_today?.value ?? 0,
                            'inverted',
                          )}
                        </div>
                      </div>
                      <div
                        class="chart-card__stat chart-card__stat--clickable"
                        classList={{
                          'chart-card__stat--active': activeView() === 'tokens',
                        }}
                        onClick={() => setActiveView('tokens')}
                      >
                        <span class="chart-card__label">
                          Token usage
                          <InfoTooltip text="Tokens are units of text that AI models process. More tokens = higher cost." />
                        </span>
                        <div class="chart-card__value-row">
                          <span class="chart-card__value">
                            {formatNumber(d().summary?.tokens_today?.value ?? 0)}
                          </span>
                          {trendBadge(
                            d().summary?.tokens_today?.trend_pct ?? 0,
                            d().summary?.tokens_today?.value ?? 0,
                            'inverted',
                          )}
                        </div>
                      </div>
                      <div
                        class="chart-card__stat chart-card__stat--clickable"
                        classList={{
                          'chart-card__stat--active': activeView() === 'messages',
                        }}
                        onClick={() => setActiveView('messages')}
                      >
                        <span class="chart-card__label">Messages</span>
                        <div class="chart-card__value-row">
                          <span class="chart-card__value">{d().summary?.messages?.value ?? 0}</span>
                          {trendBadge(
                            d().summary?.messages?.trend_pct ?? 0,
                            d().summary?.messages?.value ?? 0,
                            'neutral',
                          )}
                        </div>
                      </div>
                    </div>
                    <div class="chart-card__body">
                      <Show when={activeView() === 'cost'}>
                        <Show
                          when={d().cost_usage?.length}
                          fallback={
                            <div style="height: 260px; color: hsl(var(--muted-foreground)); display: flex; align-items: center; justify-content: center;">
                              No cost data for this time range
                            </div>
                          }
                        >
                          <CostChart data={d().cost_usage} range={range()} />
                        </Show>
                      </Show>
                      <Show when={activeView() === 'tokens'}>
                        <Show
                          when={d().token_usage?.length}
                          fallback={
                            <div style="height: 260px; color: hsl(var(--muted-foreground)); display: flex; align-items: center; justify-content: center;">
                              No token data for this time range
                            </div>
                          }
                        >
                          <TokenChart data={d().token_usage} range={range()} />
                        </Show>
                      </Show>
                      <Show when={activeView() === 'messages'}>
                        <Show
                          when={getMessageChartData().length}
                          fallback={
                            <div style="height: 260px; color: hsl(var(--muted-foreground)); display: flex; align-items: center; justify-content: center;">
                              No message data for this time range
                            </div>
                          }
                        >
                          <SingleTokenChart
                            data={getMessageChartData()}
                            label="Messages"
                            colorVar="--chart-1"
                            range={range()}
                          />
                        </Show>
                      </Show>
                    </div>
                  </div>

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
                      items={d().recent_activity?.slice(0, 5) ?? []}
                      columns={COMPACT_COLUMNS}
                      agentName={params.agentName}
                      customProviderName={customProviderName}
                    />
                  </div>

                  {/* Cost by Model */}
                  <div class="panel" style="margin-top: var(--gap-lg);">
                    <div class="panel__title">Cost by Model</div>
                    <p style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground)); margin: -8px 0 12px;">
                      How much each model costs you
                    </p>
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Model</th>
                          <th>Tokens</th>
                          <th>% of total</th>
                          <th>Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For
                          each={[...(d().cost_by_model ?? [])].sort(
                            (a, b) => b.estimated_cost - a.estimated_cost,
                          )}
                        >
                          {(row) => (
                            <tr>
                              <td style="font-family: var(--font-mono); font-size: var(--font-size-sm);">
                                <span style="display: inline-flex; align-items: center; gap: 4px;">
                                  {row.model && inferProviderFromModel(row.model) === 'custom' ? (
                                    (() => {
                                      const provName = customProviderName(row.model);
                                      const letter = (provName ?? stripCustomPrefix(row.model))
                                        .charAt(0)
                                        .toUpperCase();
                                      return (
                                        <span
                                          class="provider-card__logo-letter"
                                          title={provName}
                                          style={{
                                            background: customProviderColor(provName ?? ''),
                                            width: '16px',
                                            height: '16px',
                                            'font-size': '9px',
                                            'flex-shrink': '0',
                                            'border-radius': '50%',
                                          }}
                                        >
                                          {letter}
                                        </span>
                                      );
                                    })()
                                  ) : row.model && inferProviderFromModel(row.model) ? (
                                    <span
                                      title={`${inferProviderName(row.model)} (${authLabel(row.auth_type)})`}
                                      style="display: inline-flex; flex-shrink: 0; position: relative;"
                                    >
                                      {providerIcon(inferProviderFromModel(row.model)!, 14)}
                                      {authBadgeFor(row.auth_type, 8)}
                                    </span>
                                  ) : null}
                                  {row.model
                                    ? row.display_name || getModelDisplayName(row.model)
                                    : row.model}
                                </span>
                              </td>
                              <td>{formatNumber(row.tokens)}</td>
                              <td>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                  <div style="width: 40px; height: 4px; border-radius: 2px; background: hsl(var(--muted)); overflow: hidden;">
                                    <div
                                      style={`width: ${row.share_pct}%; height: 100%; background: hsl(var(--chart-1)); border-radius: 2px;`}
                                    />
                                  </div>
                                  <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                                    {Math.round(row.share_pct)}%
                                  </span>
                                </div>
                              </td>
                              <td
                                style="font-weight: 600;"
                                title={
                                  row.estimated_cost > 0 && row.estimated_cost < 0.01
                                    ? `$${row.estimated_cost.toFixed(6)}`
                                    : undefined
                                }
                              >
                                {formatCost(row.estimated_cost) ?? '\u2014'}
                              </td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
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
    </div>
  );
};

export default Overview;
