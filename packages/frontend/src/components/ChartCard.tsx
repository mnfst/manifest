import { Show, type Component } from 'solid-js';
import CostChart from './CostChart.jsx';
import InfoTooltip from './InfoTooltip.jsx';
import SingleTokenChart from './SingleTokenChart.jsx';
import TokenChart from './TokenChart.jsx';
import { formatCost, formatNumber } from '../services/formatters.js';

type ActiveView = 'cost' | 'tokens' | 'messages';

const trendBadge = (pct: number, value: number, mode: 'inverted' | 'neutral') => {
  if (pct === 0) return null;
  if (Math.abs(value) < 0.005) return null;
  const clamped = Math.max(-999, Math.min(999, Math.round(pct)));
  if (clamped === 0) return null;
  let cls: string;
  if (mode === 'neutral') {
    cls = 'trend trend--neutral';
  } else {
    cls = clamped > 0 ? 'trend trend--up-bad' : 'trend trend--down-good';
  }
  const sign = clamped > 0 ? '+' : '';
  return (
    <span class={cls}>
      {sign}
      {clamped}%
    </span>
  );
};

interface ChartCardProps {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  costValue: number;
  costTrendPct: number;
  tokensValue: number;
  tokensTrendPct: number;
  messagesValue: number;
  messagesTrendPct: number;
  costUsage: Array<{ hour?: string; date?: string; cost: number }>;
  tokenUsage: Array<{
    hour?: string;
    date?: string;
    input_tokens: number;
    output_tokens: number;
  }>;
  messageChartData: Array<{ time: string; value: number }>;
  range: string;
}

const ChartCard: Component<ChartCardProps> = (props) => (
  <div class="chart-card">
    <div class="chart-card__header">
      <div
        class="chart-card__stat chart-card__stat--clickable"
        classList={{ 'chart-card__stat--active': props.activeView === 'messages' }}
        onClick={() => props.onViewChange('messages')}
      >
        <span class="chart-card__label">Messages</span>
        <div class="chart-card__value-row">
          <span class="chart-card__value">{props.messagesValue}</span>
          {trendBadge(props.messagesTrendPct, props.messagesValue, 'neutral')}
        </div>
      </div>
      <div
        class="chart-card__stat chart-card__stat--clickable"
        classList={{ 'chart-card__stat--active': props.activeView === 'cost' }}
        onClick={() => props.onViewChange('cost')}
      >
        <span class="chart-card__label">Cost</span>
        <div class="chart-card__value-row">
          <span class="chart-card__value">{formatCost(props.costValue) ?? '$0.00'}</span>
          {trendBadge(props.costTrendPct, props.costValue, 'inverted')}
        </div>
      </div>
      <div
        class="chart-card__stat chart-card__stat--clickable"
        classList={{ 'chart-card__stat--active': props.activeView === 'tokens' }}
        onClick={() => props.onViewChange('tokens')}
      >
        <span class="chart-card__label">
          Token usage
          <InfoTooltip text="Tokens are units of text that AI models process. More tokens = higher cost." />
        </span>
        <div class="chart-card__value-row">
          <span class="chart-card__value">{formatNumber(props.tokensValue)}</span>
          {trendBadge(props.tokensTrendPct, props.tokensValue, 'inverted')}
        </div>
      </div>
    </div>
    <div class="chart-card__body">
      <Show when={props.activeView === 'cost'}>
        <Show
          when={props.costUsage?.length}
          fallback={
            <div style="height: 260px; color: hsl(var(--muted-foreground)); display: flex; align-items: center; justify-content: center;">
              No cost data for this time range
            </div>
          }
        >
          <CostChart data={props.costUsage} range={props.range} />
        </Show>
      </Show>
      <Show when={props.activeView === 'tokens'}>
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
      </Show>
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
    </div>
  </div>
);

export default ChartCard;
