import { createSignal, Show, Suspense, lazy, type Component, type JSX } from 'solid-js';
import InfoTooltip from './InfoTooltip.jsx';
import { formatNumber, formatCost } from '../services/formatters.js';
import type { AutofixStats, AutofixTimeseries } from '../services/api/analytics.js';

const MultiAgentTokenChart = lazy(() => import('./MultiAgentTokenChart.jsx'));
const ReliabilityChart = lazy(() => import('./ReliabilityChart.jsx'));

export type ChartTab = 'requests' | 'failed' | 'cost' | 'tokens';
type FailedFilter = 'disposition' | 'http_status' | 'error_kind' | 'autofix';

interface AgentTimeseries {
  agents: string[];
  timeseries: Array<Record<string, number | string>>;
}

export interface UnifiedChartCardProps {
  activeTab: ChartTab;
  onTabChange: (tab: ChartTab) => void;
  // Requests tab
  requestsValue: number;
  requestsTrendPct: number;
  agentRequestTimeseries?: AgentTimeseries;
  // Failed requests tab
  failedValue: number;
  failedTrendPct: number;
  failedTimeseries?: AutofixTimeseries;
  failedFilter: string;
  onFailedFilterChange: (f: string) => void;
  // Cost tab
  costValue?: number;
  costTrendPct?: number;
  costInfoTooltip?: string;
  agentCostTimeseries?: AgentTimeseries;
  // Token usage tab
  tokensValue: number;
  tokensTrendPct: number;
  agentTimeseries?: AgentTimeseries;
  // Shared
  range: string;
  colorMap?: Record<string, string>;
  /** Filter controls rendered in the subtitle bar for Requests/Cost/Token tabs */
  seriesFilters?: JSX.Element;
}

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

const EMPTY = (msg: string) => (
  <div style="height: 260px; color: hsl(var(--muted-foreground)); display: flex; align-items: center; justify-content: center;">
    {msg}
  </div>
);

const FAILED_FILTERS: Array<{ value: FailedFilter; label: string }> = [
  { value: 'disposition', label: 'By error class' },
  { value: 'http_status', label: 'By HTTP status' },
  { value: 'autofix', label: 'By auto-fixed' },
];

const UnifiedChartCard: Component<UnifiedChartCardProps> = (props) => {
  const showCost = () => props.costValue != null;

  const tabTitle = (): string => {
    switch (props.activeTab) {
      case 'requests':
        return 'Requests';
      case 'failed':
        return 'Failed requests';
      case 'cost':
        return 'Cost';
      case 'tokens':
        return 'Token usage';
    }
  };

  return (
    <div class="chart-card">
      {/* ── Stat header tabs ── */}
      <div class="chart-card__header">
        <button
          type="button"
          class="chart-card__stat chart-card__stat--clickable"
          classList={{ 'chart-card__stat--active': props.activeTab === 'requests' }}
          onClick={() => props.onTabChange('requests')}
        >
          <span class="chart-card__label">Requests</span>
          <div class="chart-card__value-row">
            <span class="chart-card__value">{formatNumber(props.requestsValue)}</span>
            {trendBadge(props.requestsTrendPct, props.requestsValue)}
          </div>
        </button>
        <button
          type="button"
          class="chart-card__stat chart-card__stat--clickable"
          classList={{ 'chart-card__stat--active': props.activeTab === 'failed' }}
          onClick={() => props.onTabChange('failed')}
        >
          <span class="chart-card__label">Failed requests</span>
          <div class="chart-card__value-row">
            <span class="chart-card__value">{formatNumber(props.failedValue)}</span>
            {trendBadge(props.failedTrendPct, props.failedValue)}
          </div>
        </button>
        <Show when={showCost()}>
          <button
            type="button"
            class="chart-card__stat chart-card__stat--clickable"
            classList={{ 'chart-card__stat--active': props.activeTab === 'cost' }}
            onClick={() => props.onTabChange('cost')}
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
          classList={{ 'chart-card__stat--active': props.activeTab === 'tokens' }}
          onClick={() => props.onTabChange('tokens')}
        >
          <span class="chart-card__label">Token usage</span>
          <div class="chart-card__value-row">
            <span class="chart-card__value">{formatNumber(props.tokensValue)}</span>
            {trendBadge(props.tokensTrendPct, props.tokensValue)}
          </div>
        </button>
      </div>

      {/* ── Subtitle bar: title + contextual filters ── */}
      <div class="chart-card__subtitle">
        <span class="chart-card__subtitle-title">{tabTitle()}</span>
        <Show when={props.activeTab === 'failed'}>
          <div class="chart-card__filters">
            {FAILED_FILTERS.map((f) => (
              <button
                class="chart-card__filter-btn"
                classList={{ 'chart-card__filter-btn--active': props.failedFilter === f.value }}
                onClick={() => props.onFailedFilterChange(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </Show>
        <Show when={props.activeTab !== 'failed' && props.seriesFilters}>
          <div class="chart-card__filters">{props.seriesFilters}</div>
        </Show>
      </div>

      {/* ── Chart body ── */}
      <div class="chart-card__body">
        <Suspense fallback={EMPTY('Loading chart…')}>
          <Show when={props.activeTab === 'requests'}>
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
          <Show when={props.activeTab === 'failed'}>
            <Show
              when={props.failedTimeseries && props.failedTimeseries.buckets.length > 0}
              fallback={EMPTY('No failed requests in this time range')}
            >
              <ReliabilityChart
                timeseries={props.failedTimeseries!}
                range={props.range}
                seriesMode={props.failedFilter}
              />
            </Show>
          </Show>
          <Show when={props.activeTab === 'cost'}>
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
          <Show when={props.activeTab === 'tokens'}>
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
        </Suspense>
      </div>
    </div>
  );
};

export default UnifiedChartCard;
