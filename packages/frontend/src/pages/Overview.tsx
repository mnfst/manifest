import { Meta, Title } from '@solidjs/meta'
import { A, useLocation, useParams } from '@solidjs/router'
import {
  createEffect,
  createResource,
  createSignal,
  For,
  Show,
  type Component,
} from 'solid-js'
import CostChart from '../components/CostChart.jsx'
import ErrorState from '../components/ErrorState.jsx'
import InfoTooltip from '../components/InfoTooltip.jsx'
import Select from '../components/Select.jsx'
import SetupModal from '../components/SetupModal.jsx'
import SingleTokenChart from '../components/SingleTokenChart.jsx'
import TokenChart from '../components/TokenChart.jsx'
import { getOverview } from '../services/api.js'
import {
  formatCost,
  formatNumber,
  formatStatus,
  formatTime,
} from '../services/formatters.js'
import { isLocalMode } from '../services/local-mode.js'
import { pingCount } from '../services/sse.js'
import '../styles/overview.css'

interface RecentMessage {
  id: string
  timestamp: string
  agent_name: string | null
  model: string | null
  routing_tier?: string
  input_tokens: number | null
  output_tokens: number | null
  total_tokens: number | null
  cost: number | null
  status: string
}

interface OverviewData {
  summary: {
    tokens_today: {
      value: number
      trend_pct: number
      sub_values?: { input: number; output: number }
    }
    cost_today: { value: number; trend_pct: number }
    messages: { value: number; trend_pct: number }
    services_hit: { total: number; healthy: number; issues: number }
  }
  token_usage: Array<{
    hour?: string
    date?: string
    input_tokens: number
    output_tokens: number
  }>
  cost_usage: Array<{ hour?: string; date?: string; cost: number }>
  message_usage: Array<{ hour?: string; date?: string; count: number }>
  cost_by_model: Array<{
    model: string
    tokens: number
    share_pct: number
    estimated_cost: number
  }>
  recent_activity: RecentMessage[]
  active_skills: Array<{
    name: string
    agent_name: string | null
    run_count: number
    last_active_at: string
    status: string
  }>
  has_data?: boolean
}

type ActiveView = 'cost' | 'tokens' | 'messages'

const Overview: Component = () => {
  const params = useParams<{ agentName: string }>()
  const location = useLocation<{ newAgent?: boolean; newApiKey?: string }>()
  const [range, setRange] = createSignal('7d')
  const [activeView, setActiveView] = createSignal<ActiveView>('cost')
  const [setupOpen, setSetupOpen] = createSignal(
    !!(location.state as { newAgent?: boolean } | undefined)?.newAgent
  )
  const [setupCompleted, setSetupCompleted] = createSignal(
    !!localStorage.getItem(`setup_completed_${params.agentName}`)
  )
  const [data, { refetch }] = createResource(
    () => ({ range: range(), agentName: params.agentName, _ping: pingCount() }),
    (p) => getOverview(p.range, p.agentName) as Promise<OverviewData>,
  )

  const isNewAgent = () => {
    const d = data()
    return d && d.has_data === false
  }

  createEffect(() => {
    if (isLocalMode() === true && params.agentName === 'local-agent') {
      localStorage.setItem(`setup_completed_${params.agentName}`, '1')
      setSetupCompleted(true)
      return
    }
    if (isNewAgent() && !setupCompleted() && !localStorage.getItem(`setup_dismissed_${params.agentName}`)) {
      setSetupOpen(true)
    }
  })

  const trendBadge = (pct: number, neutral = false) => {
    const cls = neutral
      ? 'trend trend--neutral'
      : pct <= 0 ? 'trend trend--up' : 'trend trend--down'
    const sign = pct >= 0 ? '+' : ''
    return (
      <span class={cls}>
        {sign}
        {pct}%
      </span>
    )
  }

  const getMessageChartData = () => {
    const src = data()?.message_usage
    return (
      src?.map((d) => ({ time: d.hour ?? d.date ?? '', value: d.count })) ?? []
    )
  }

  return (
    <div class="container--md">
      <Title>{params.agentName} - Overview | Manifest</Title>
      <Meta
        name="description"
        content={`Monitor ${params.agentName} performance — costs, tokens, and activity.`}
      />
      <div class="page-header">
        <div>
          <h1>Overview</h1>
          <span class="breadcrumb">Monitor your agent's costs, tokens, and activity</span>
        </div>
        <div class="header-controls">
          <Show when={!isNewAgent()}>
            <Select
              value={range()}
              onChange={setRange}
              options={[
                { label: 'Last hour', value: '1h' },
                { label: 'Last 24 hours', value: '24h' },
                { label: 'Last 7 days', value: '7d' },
                { label: 'Last 30 days', value: '30d' },
              ]}
            />
          </Show>
          <Show when={isNewAgent() && !(isLocalMode() && params.agentName === 'local-agent') && !setupCompleted()}>
            <button class="btn btn--primary" onClick={() => setSetupOpen(true)}>
              Set up agent
            </button>
          </Show>
        </div>
      </div>

      <Show
        when={!data.loading}
        fallback={
          <>
            <div class="chart-card" style="min-height: 360px;">
              <div class="chart-card__header">
                <div class="chart-card__stat" style="flex: 1;">
                  <div
                    class="skeleton skeleton--text"
                    style="width: 60px; height: 14px;"
                  />
                  <div
                    class="skeleton skeleton--text"
                    style="width: 100px; height: 28px; margin-top: 6px;"
                  />
                </div>
                <div class="chart-card__stat" style="flex: 1;">
                  <div
                    class="skeleton skeleton--text"
                    style="width: 80px; height: 14px;"
                  />
                  <div
                    class="skeleton skeleton--text"
                    style="width: 100px; height: 28px; margin-top: 6px;"
                  />
                </div>
                <div
                  class="chart-card__stat"
                  style="flex: 1; border-right: none;"
                >
                  <div
                    class="skeleton skeleton--text"
                    style="width: 60px; height: 14px;"
                  />
                  <div
                    class="skeleton skeleton--text"
                    style="width: 80px; height: 28px; margin-top: 6px;"
                  />
                </div>
              </div>
              <div class="chart-card__body">
                <div
                  class="skeleton skeleton--rect"
                  style="width: 100%; height: 240px;"
                />
              </div>
            </div>
            <div class="panel">
              <div
                class="skeleton skeleton--text"
                style="width: 120px; height: 16px; margin-bottom: 16px;"
              />
              <For each={[1, 2, 3, 4, 5]}>
                {() => (
                  <div style="display: flex; gap: 16px; padding: 12px 0; border-bottom: 1px solid hsl(var(--border));">
                    <div
                      class="skeleton skeleton--text"
                      style="width: 60px; height: 14px;"
                    />
                    <div
                      class="skeleton skeleton--text"
                      style="width: 60px; height: 14px;"
                    />
                    <div
                      class="skeleton skeleton--text"
                      style="width: 50px; height: 14px;"
                    />
                    <div
                      class="skeleton skeleton--text"
                      style="width: 80px; height: 14px;"
                    />
                    <div
                      class="skeleton skeleton--text"
                      style="width: 60px; height: 14px;"
                    />
                    <div
                      class="skeleton skeleton--text"
                      style="width: 40px; height: 14px;"
                    />
                  </div>
                )}
              </For>
            </div>
          </>
        }
      >
        <Show when={!data.error} fallback={
          <ErrorState error={data.error} onRetry={refetch} />
        }>
        <Show when={isNewAgent()}>
          <Show when={(isLocalMode() && params.agentName === 'local-agent') || setupCompleted()} fallback={
            <div class="empty-state">
              <div class="empty-state__title">No activity yet</div>
              <p>Set up your agent and start chatting. Activity will appear here automatically.</p>
              <button class="btn btn--primary" style="margin-top: var(--gap-md);" onClick={() => setSetupOpen(true)}>
                Set up agent
              </button>
              <div class="empty-state__img-wrapper">
                <img src="/example-overview.svg" alt="" class="empty-state__img" />
              </div>
            </div>
          }>
            <div class="waiting-banner">
              <i class="bxd bx-florist" />
              <p>Your dashboard will populate a few seconds after your first exchange with your agent.</p>
            </div>
            <div class="demo-dashboard">
              <div class="chart-card">
                <div class="chart-card__header">
                  <div class="chart-card__stat chart-card__stat--active">
                    <span class="chart-card__label">Cost</span>
                    <div class="chart-card__value-row">
                      <span class="chart-card__value">$0.00</span>
                      <span class="trend trend--up">+0%</span>
                    </div>
                  </div>
                  <div class="chart-card__stat">
                    <span class="chart-card__label">Token usage</span>
                    <div class="chart-card__value-row">
                      <span class="chart-card__value">0</span>
                      <span class="trend trend--up">+0%</span>
                    </div>
                  </div>
                  <div class="chart-card__stat">
                    <span class="chart-card__label">Messages</span>
                    <div class="chart-card__value-row">
                      <span class="chart-card__value">0</span>
                      <span class="trend trend--up">+0%</span>
                    </div>
                  </div>
                </div>
                <div class="chart-card__body">
                  <div style="height: 260px; color: hsl(var(--muted-foreground)); display: flex; align-items: center; justify-content: center;">
                    No data yet
                  </div>
                </div>
              </div>
              <div class="panel">
                <div class="panel__title" style="display: flex; justify-content: space-between; align-items: center;">
                  Recent Messages
                  <span class="view-more-link" style="pointer-events: none;">View more</span>
                </div>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Message</th>
                      <th>Cost</th>
                      <th>Model</th>
                      <th>Tokens</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colspan="6" style="text-align: center; color: hsl(var(--muted-foreground)); padding: var(--gap-lg);">
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
                      <td colspan="4" style="text-align: center; color: hsl(var(--muted-foreground)); padding: var(--gap-lg);">
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
            const d = () => data() as OverviewData
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
                          {formatCost(d().summary?.cost_today?.value ?? 0)}
                        </span>
                        {trendBadge(d().summary?.cost_today?.trend_pct ?? 0)}
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
                        {trendBadge(d().summary?.tokens_today?.trend_pct ?? 0)}
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
                        <span class="chart-card__value">
                          {d().summary?.messages?.value ?? 0}
                        </span>
                        {trendBadge(d().summary?.messages?.trend_pct ?? 0, true)}
                      </div>
                    </div>
                  </div>
                  <div class="chart-card__body">
                    <Show when={activeView() === 'cost'}>
                      <Show
                        when={d().cost_usage?.length}
                        fallback={
                          <div style="height: 260px; color: hsl(var(--muted-foreground)); display: flex; align-items: center; justify-content: center;">
                            No data
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
                            No data
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
                            No data
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
                    <A
                      href={`/agents/${params.agentName}/messages`}
                      class="view-more-link"
                    >
                      View more
                    </A>
                  </div>
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Message</th>
                        <th>Cost</th>
                        <th>Model</th>
                        <th>Tokens</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={d().recent_activity?.slice(0, 5) ?? []}>
                        {(item) => (
                          <tr>
                            <td style="white-space: nowrap; font-family: var(--font-mono); font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                              {formatTime(item.timestamp)}
                            </td>
                            <td style="font-family: var(--font-mono); font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                              {item.id.slice(0, 8)}
                            </td>
                            <td style="font-family: var(--font-mono);">
                              {item.cost != null
                                ? formatCost(item.cost)
                                : '\u2014'}
                            </td>
                            <td style="font-family: var(--font-mono); font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                              {item.model ?? '\u2014'}
                              {item.routing_tier && <span class={`tier-badge tier-badge--${item.routing_tier}`}>{item.routing_tier}</span>}
                            </td>
                            <td style="font-family: var(--font-mono);">
                              {item.total_tokens != null
                                ? formatNumber(item.total_tokens)
                                : '\u2014'}
                            </td>
                            <td>
                              <span
                                class={`status-badge status-badge--${item.status}`}
                              >
                                {formatStatus(item.status)}
                              </span>
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>

                {/* Cost by Model */}
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
                      <For each={d().cost_by_model ?? []}>
                        {(row) => (
                          <tr>
                            <td style="font-family: var(--font-mono); font-size: var(--font-size-sm);">
                              {row.model}
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
                            <td style="font-weight: 600;">
                              {formatCost(row.estimated_cost)}
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </>
            )
          }}
        </Show>
        </Show>
      </Show>

      <SetupModal
        open={setupOpen()}
        agentName={decodeURIComponent(params.agentName)}
        apiKey={(location.state as { newApiKey?: string } | undefined)?.newApiKey ?? null}
        onClose={() => {
          localStorage.setItem(`setup_dismissed_${params.agentName}`, '1')
          setSetupOpen(false)
        }}
        onDone={() => {
          localStorage.setItem(`setup_completed_${params.agentName}`, '1')
          setSetupCompleted(true)
        }}
      />
    </div>
  )
}

export default Overview
