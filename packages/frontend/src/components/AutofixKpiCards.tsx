import { Show, type Component } from 'solid-js';
import { formatNumber } from '../services/formatters.js';
import type { AutofixStats } from '../services/api/analytics.js';

function fmtPct(v: number): string {
  const pct = v * 100;
  return pct === 100 || pct === 0 ? `${pct}%` : `${pct.toFixed(1)}%`;
}

function trendBadge(current: number, previous: number) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) {
    return <span class="trend trend--neutral">new</span>;
  }
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
  return (
    <div class="overview-stats" style="grid-template-columns: repeat(3, 1fr);">
      <div class="overview-stat-card">
        <span class="overview-stat-card__label">Success rate</span>
        <div class="overview-stat-card__value-row">
          <span class="overview-stat-card__value">
            <Show when={props.stats} fallback="--">
              {(s) => fmtPct(s().success_rate.value)}
            </Show>
          </span>
          <Show when={props.stats}>
            {(s) => trendBadge(s().success_rate.value, s().success_rate.previous)}
          </Show>
        </div>
      </div>
      <div class="overview-stat-card">
        <span class="overview-stat-card__label">Errors</span>
        <div class="overview-stat-card__value-row">
          <span class="overview-stat-card__value">
            <Show when={props.stats} fallback="--">
              {(s) => formatNumber(s().errors_remaining.value)}
            </Show>
          </span>
          <Show when={props.stats}>
            {(s) => trendBadge(s().errors_remaining.value, s().errors_remaining.previous)}
          </Show>
        </div>
      </div>
      <div class="overview-stat-card">
        <span class="overview-stat-card__label">Auto-fixed</span>
        <div class="overview-stat-card__value-row">
          <span class="overview-stat-card__value">
            <Show when={props.stats} fallback="--">
              {(s) => formatNumber(s().autofix_saves.value)}
            </Show>
          </span>
          <Show when={props.stats}>
            {(s) => trendBadge(s().autofix_saves.value, s().autofix_saves.previous)}
          </Show>
        </div>
      </div>
    </div>
  );
};

export default AutofixKpiCards;
