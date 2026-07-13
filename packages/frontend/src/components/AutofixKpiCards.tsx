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
  const autofixPct = () => {
    const s = props.stats;
    if (!s) return 0;
    const total = s.autofix_saves.value + s.errors_remaining.value;
    return total > 0 ? s.autofix_saves.value / total : 0;
  };

  return (
    <Show when={props.stats}>
      {(s) => (
        <div class="overview-stats" style="grid-template-columns: repeat(2, 1fr);">
          <div class="overview-stat-card">
            <span class="overview-stat-card__label">Success rate</span>
            <div class="overview-stat-card__value-row">
              <span class="overview-stat-card__value">{fmtPct(s().success_rate.value)}</span>
              {trendBadge(s().success_rate.value, s().success_rate.previous)}
            </div>
          </div>
          <div
            class="overview-stat-card"
            style="display: flex; flex-direction: row; align-items: center; gap: 24px;"
          >
            <div style="flex: 1;">
              <span class="overview-stat-card__label">Auto-fixed requests</span>
              <div class="overview-stat-card__value-row">
                <span class="overview-stat-card__value">{fmtPct(autofixPct())}</span>
              </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px; font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: hsl(var(--success)); flex-shrink: 0;" />
                <span>{formatNumber(s().autofix_saves.value)} auto-fixed</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: hsl(var(--destructive)); flex-shrink: 0;" />
                <span>{formatNumber(s().errors_remaining.value)} not fixed</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};

export default AutofixKpiCards;
