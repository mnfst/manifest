import { createMemo, createSignal, For, Show, type Component } from 'solid-js';
import SingleTokenChart from './SingleTokenChart.jsx';
import TokenChart from './TokenChart.jsx';
import MultiAgentTokenChart, { AGENT_COLORS } from './MultiAgentTokenChart.jsx';
import { formatNumber } from '../services/formatters.js';

function lightBg(color: string): string {
  if (color.startsWith('#')) return `${color}18`;
  return color.replace(')', ' / 0.1)').replace('hsl(', 'hsla(');
}

type ProviderView = 'messages' | 'tokens';

const trendBadge = (pct: number, value: number) => {
  if (pct === 0 || Math.abs(value) < 0.005) return null;
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

interface ProviderChartCardProps {
  activeView: ProviderView;
  onViewChange: (view: ProviderView) => void;
  messagesValue: number;
  messagesTrendPct: number;
  tokensValue: number;
  tokensTrendPct: number;
  tokenUsage: Array<{ hour?: string; date?: string; input_tokens: number; output_tokens: number }>;
  messageChartData: Array<{ time: string; value: number }>;
  range: string;
  agentTimeseries?: { agents: string[]; timeseries: Array<Record<string, number | string>> };
  fullAgentTimeseries?: { agents: string[]; timeseries: Array<Record<string, number | string>> };
  allAgents?: string[];
  selectedAgents?: Set<string>;
  onToggleAgent?: (agent: string) => void;
}

const ProviderChartCard: Component<ProviderChartCardProps> = (props) => {
  const [hoverValues, setHoverValues] = createSignal<Record<string, number> | null>(null);

  const allAg = () => props.allAgents ?? props.agentTimeseries?.agents ?? [];

  const colorMap = createMemo(() => {
    const map: Record<string, string> = {};
    for (const [i, a] of allAg().entries()) {
      map[a] = AGENT_COLORS[i % AGENT_COLORS.length];
    }
    return map;
  });

  const totals = createMemo(() => {
    const t: Record<string, number> = {};
    for (const a of allAg()) t[a] = 0;
    const ts = props.fullAgentTimeseries?.timeseries ?? props.agentTimeseries?.timeseries ?? [];
    for (const row of ts) {
      for (const a of allAg()) t[a] += Number(row[a] ?? 0);
    }
    return t;
  });

  return (
    <div class="chart-card">
      <div class="chart-card__header">
        <div
          class="chart-card__stat chart-card__stat--clickable"
          classList={{ 'chart-card__stat--active': props.activeView === 'tokens' }}
          onClick={() => props.onViewChange('tokens')}
        >
          <span class="chart-card__label">Token usage</span>
          <div class="chart-card__value-row">
            <span class="chart-card__value">{formatNumber(props.tokensValue)}</span>
            {trendBadge(props.tokensTrendPct, props.tokensValue)}
          </div>
        </div>
        <div
          class="chart-card__stat chart-card__stat--clickable"
          classList={{ 'chart-card__stat--active': props.activeView === 'messages' }}
          onClick={() => props.onViewChange('messages')}
        >
          <span class="chart-card__label">Messages</span>
          <div class="chart-card__value-row">
            <span class="chart-card__value">{props.messagesValue}</span>
            {trendBadge(props.messagesTrendPct, props.messagesValue)}
          </div>
        </div>
      </div>
      <div class="chart-card__body">
        <Show when={props.activeView === 'messages'}>
          <Show
            when={props.messageChartData.length}
            fallback={
              <div style="height: 260px; color: hsl(var(--muted-foreground)); display: flex; align-items: center; justify-content: center;">
                No message data for this time range
              </div>
            }
          >
            <SingleTokenChart
              data={props.messageChartData}
              label="Messages"
              colorVar="--chart-1"
              range={props.range}
            />
          </Show>
        </Show>
        <Show when={props.activeView === 'tokens'}>
          <Show
            when={props.agentTimeseries?.agents.length}
            fallback={
              <Show
                when={props.tokenUsage?.length}
                fallback={
                  <div style="height: 260px; color: hsl(var(--muted-foreground)); display: flex; align-items: center; justify-content: center;">
                    No token data for this time range
                  </div>
                }
              >
                <TokenChart data={props.tokenUsage} range={props.range} />
              </Show>
            }
          >
            <MultiAgentTokenChart
              agents={props.agentTimeseries!.agents}
              timeseries={props.agentTimeseries!.timeseries}
              range={props.range}
              colorMap={colorMap()}
              onHoverValues={setHoverValues}
            />
          </Show>
        </Show>
      </div>

      {/* Agent tags — legend + filter (inside the card) */}
      <Show when={allAg().length > 0}>
        <div style="padding: 12px 16px 16px;">
          <div style="font-size: var(--font-size-xs); font-weight: 600; color: hsl(var(--muted-foreground)); margin-bottom: 8px;">
            Filter by agents
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            <For each={allAg()}>
              {(agent) => {
                const c = () => colorMap()[agent];
                const sel = () => !props.selectedAgents || props.selectedAgents.has(agent);
                const val = () => hoverValues()?.[agent] ?? totals()[agent] ?? 0;
                return (
                  <button
                    style={{
                      display: 'inline-flex',
                      'align-items': 'center',
                      gap: '6px',
                      padding: '3px 10px',
                      'border-radius': 'var(--radius-sm)',
                      border: `1px solid ${sel() ? c() : 'hsl(var(--border))'}`,
                      background: sel() ? lightBg(c()) : 'transparent',
                      color: sel() ? c() : 'hsl(var(--muted-foreground))',
                      'font-size': 'var(--font-size-xs)',
                      'font-weight': '500',
                      cursor: 'pointer',
                      opacity: sel() ? '1' : '0.5',
                      transition: 'all 150ms',
                    }}
                    onClick={() => props.onToggleAgent?.(agent)}
                  >
                    {agent}
                    <span style="font-weight: 600;">{formatNumber(val())}</span>
                  </button>
                );
              }}
            </For>
          </div>
          {/* Footer with total */}
          <div style="display: flex; justify-content: flex-end; margin-top: 10px; padding-top: 8px; border-top: 1px solid hsl(var(--border));">
            <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
              Total{' '}
              <span style="font-weight: 700; color: hsl(var(--foreground)); font-size: var(--font-size-sm);">
                {formatNumber(
                  (() => {
                    const hv = hoverValues();
                    const selected = props.selectedAgents;
                    let sum = 0;
                    for (const a of allAg()) {
                      if (selected && !selected.has(a)) continue;
                      sum += hv ? (hv[a] ?? 0) : (totals()[a] ?? 0);
                    }
                    return sum;
                  })(),
                )}
              </span>
            </span>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default ProviderChartCard;
