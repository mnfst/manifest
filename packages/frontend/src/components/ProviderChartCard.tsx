import { Show, Suspense, lazy, type Component } from 'solid-js';
import InfoTooltip from './InfoTooltip.jsx';
import { formatNumber, formatCost } from '../services/formatters.js';

const MultiAgentTokenChart = lazy(() => import('./MultiAgentTokenChart.jsx'));

type ProviderView = 'requests' | 'cost' | 'tokens';

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
  requestsValue: number;
  requestsTrendPct: number;
  tokensValue: number;
  tokensTrendPct: number;
  costValue?: number;
  costTrendPct?: number;
  costInfoTooltip?: string;
  range: string;
  agentTimeseries?: AgentTimeseries;
  agentRequestTimeseries?: AgentTimeseries;
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
        <button
          type="button"
          class="chart-card__stat chart-card__stat--clickable"
          classList={{ 'chart-card__stat--active': props.activeView === 'requests' }}
          onClick={() => props.onViewChange('requests')}
        >
          <span class="chart-card__label">Requests</span>
          <div class="chart-card__value-row">
            <span class="chart-card__value">{formatNumber(props.requestsValue)}</span>
            {trendBadge(props.requestsTrendPct, props.requestsValue)}
          </div>
        </button>
        <Show when={showCost()}>
          <button
            type="button"
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
          </button>
        </Show>
        <button
          type="button"
          class="chart-card__stat chart-card__stat--clickable"
          classList={{ 'chart-card__stat--active': props.activeView === 'tokens' }}
          onClick={() => props.onViewChange('tokens')}
        >
          <span class="chart-card__label">Token usage</span>
          <div class="chart-card__value-row">
            <span class="chart-card__value">{formatNumber(props.tokensValue)}</span>
            {trendBadge(props.tokensTrendPct, props.tokensValue)}
          </div>
        </button>
      </div>
      <div class="chart-card__body">
        <Suspense fallback={EMPTY('Loading chart…')}>
          <Show when={props.activeView === 'requests'}>
            <Show
              when={props.agentRequestTimeseries?.agents.length}
              fallback={EMPTY('No request data for this time range')}
            >
              <MultiAgentTokenChart
                agents={props.agentRequestTimeseries!.agents}
                timeseries={props.agentRequestTimeseries!.timeseries}
                range={props.range}
                colorMap={props.colorMap}
                label="Requests"
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
        </Suspense>
      </div>
    </div>
  );
};

export default ProviderChartCard;
