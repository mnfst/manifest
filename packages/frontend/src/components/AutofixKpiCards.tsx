import { Show, type Component } from 'solid-js';
import { formatNumber } from '../services/formatters.js';
import type { AutofixStats } from '../services/api/analytics.js';

function fmtPct(v: number): string {
  const pct = v * 100;
  return pct === 100 || pct === 0 ? `${pct}%` : `${pct.toFixed(1)}%`;
}

function trendBadge(current: number, previous: number) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return <span class="trend trend--neutral">new</span>;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) return null;
  const clamped = Math.max(-999, Math.min(999, Math.round(pct)));
  const sign = clamped > 0 ? '+' : '';
  return (
    <span class="trend trend--neutral">
      {sign}
      {clamped}%
    </span>
  );
}

export interface AutofixKpiCardsProps {
  stats: AutofixStats | undefined;
}

const AutofixKpiCards: Component<AutofixKpiCardsProps> = (props) => {
  const recoveredPct = () => {
    const s = props.stats;
    if (!s || s.total_requests.value === 0) return 0;
    return s.recovered_by_manifest.value / s.total_requests.value;
  };

  const recoveredPctPrev = () => {
    const s = props.stats;
    if (!s || s.total_requests.previous === 0) return 0;
    return s.recovered_by_manifest.previous / s.total_requests.previous;
  };

  return (
    <Show when={props.stats}>
      {(s) => (
        <div class="overview-stats" style="grid-template-columns: repeat(4, 1fr);">
          <div class="overview-stat-card">
            <span class="overview-stat-card__label">Success rate</span>
            <div class="overview-stat-card__value-row">
              <span class="overview-stat-card__value">{fmtPct(s().success_rate.value)}</span>
              {trendBadge(s().success_rate.value, s().success_rate.previous)}
            </div>
          </div>
          <div class="overview-stat-card">
            <span class="overview-stat-card__label">Recovered by Manifest</span>
            <div class="overview-stat-card__value-row">
              <span class="overview-stat-card__value">{fmtPct(recoveredPct())}</span>
              {trendBadge(recoveredPct(), recoveredPctPrev())}
            </div>
          </div>
          <div class="overview-stat-card">
            <span class="overview-stat-card__label">Total recovered</span>
            <div class="overview-stat-card__value-row">
              <span class="overview-stat-card__value">
                {formatNumber(s().recovered_by_manifest.value)}
              </span>
              {trendBadge(s().recovered_by_manifest.value, s().recovered_by_manifest.previous)}
            </div>
          </div>
          <div class="overview-stat-card">
            <span class="overview-stat-card__label">Total errors</span>
            <div class="overview-stat-card__value-row">
              <span class="overview-stat-card__value">
                {formatNumber(s().errors_remaining.value)}
              </span>
              {trendBadge(s().errors_remaining.value, s().errors_remaining.previous)}
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};

export default AutofixKpiCards;
