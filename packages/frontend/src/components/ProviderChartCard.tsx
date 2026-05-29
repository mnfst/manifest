import { Show, type Component } from 'solid-js';
import SingleTokenChart from './SingleTokenChart.jsx';
import TokenChart from './TokenChart.jsx';
import MultiAgentTokenChart from './MultiAgentTokenChart.jsx';
import { formatNumber } from '../services/formatters.js';

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
  colorMap?: Record<string, string>;
}

const ProviderChartCard: Component<ProviderChartCardProps> = (props) => {
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
              colorMap={props.colorMap}
            />
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default ProviderChartCard;
