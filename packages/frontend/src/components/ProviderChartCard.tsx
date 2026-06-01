import { Show, type Component } from 'solid-js';
import MultiAgentTokenChart from './MultiAgentTokenChart.jsx';
import InfoTooltip from './InfoTooltip.jsx';
import { formatNumber, formatCost } from '../services/formatters.js';

type ProviderView = 'messages' | 'tokens' | 'cost';

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

interface AgentTimeseries {
  agents: string[];
  timeseries: Array<Record<string, number | string>>;
}

interface ProviderChartCardProps {
  activeView: ProviderView;
  onViewChange: (view: ProviderView) => void;
  messagesValue: number;
  messagesTrendPct: number;
  tokensValue: number;
  tokensTrendPct: number;
  costValue?: number;
  costTrendPct?: number;
  costInfoTooltip?: string;
  tokenUsage: Array<{ hour?: string; date?: string; input_tokens: number; output_tokens: number }>;
  messageChartData: Array<{ time: string; value: number }>;
  range: string;
  agentTimeseries?: AgentTimeseries;
  agentMessageTimeseries?: AgentTimeseries;
  agentCostTimeseries?: AgentTimeseries;
  colorMap?: Record<string, string>;
}

const EMPTY = (msg: string) => (
  <div style="height: 260px; color: hsl(var(--muted-foreground)); display: flex; align-items: center; justify-content: center;">
    {msg}
  </div>
);

const ProviderChartCard: Component<ProviderChartCardProps> = (props) => {
  const showCost = () => props.costValue != null;

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
        <Show when={showCost()}>
          <div
            class="chart-card__stat chart-card__stat--clickable"
            classList={{ 'chart-card__stat--active': props.activeView === 'cost' }}
            onClick={() => props.onViewChange('cost')}
          >
            <span class="chart-card__label">
              Cost
              <Show when={props.costInfoTooltip}>
                <InfoTooltip text={props.costInfoTooltip!} />
              </Show>
            </span>
            <div class="chart-card__value-row">
              <span class="chart-card__value">{formatCost(props.costValue!) ?? '$0.00'}</span>
              {trendBadge(props.costTrendPct ?? 0, props.costValue!)}
            </div>
          </div>
        </Show>
      </div>
      <div class="chart-card__body">
        <Show when={props.activeView === 'messages'}>
          <Show
            when={props.agentMessageTimeseries?.agents.length}
            fallback={EMPTY('No message data for this time range')}
          >
            <MultiAgentTokenChart
              agents={props.agentMessageTimeseries!.agents}
              timeseries={props.agentMessageTimeseries!.timeseries}
              range={props.range}
              colorMap={props.colorMap}
              label="Messages"
            />
          </Show>
        </Show>
        <Show when={props.activeView === 'tokens'}>
          <Show
            when={props.agentTimeseries?.agents.length}
            fallback={EMPTY('No token data for this time range')}
          >
            <MultiAgentTokenChart
              agents={props.agentTimeseries!.agents}
              timeseries={props.agentTimeseries!.timeseries}
              range={props.range}
              colorMap={props.colorMap}
            />
          </Show>
        </Show>
        <Show when={props.activeView === 'cost'}>
          <Show
            when={props.agentCostTimeseries?.agents.length}
            fallback={EMPTY('No cost data for this time range')}
          >
            <MultiAgentTokenChart
              agents={props.agentCostTimeseries!.agents}
              timeseries={props.agentCostTimeseries!.timeseries}
              range={props.range}
              colorMap={props.colorMap}
              label="Cost"
            />
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default ProviderChartCard;
