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

/**
 * The reliability story, request-first: Success rate · Self-healed requests %
 * · Self-healed via Auto-fix · Self-healed via Fallback. Self-healed =
 * autofix_saves + fallback_saves over the window total.
 */
const AutofixKpiCards: Component<AutofixKpiCardsProps> = (props) => {
  const selfHealed = () => {
    const s = props.stats;
    if (!s) return 0;
    return s.autofix_saves.value + (s.fallback_saves?.value ?? 0);
  };
  const selfHealedPrev = () => {
    const s = props.stats;
    if (!s) return 0;
    return s.autofix_saves.previous + (s.fallback_saves?.previous ?? 0);
  };
  const selfHealedPct = () => {
    const s = props.stats;
    if (!s || !s.total_requests || s.total_requests.value === 0) return 0;
    return selfHealed() / s.total_requests.value;
  };
  const selfHealedPctPrev = () => {
    const s = props.stats;
    if (!s || !s.total_requests || s.total_requests.previous === 0) return 0;
    return selfHealedPrev() / s.total_requests.previous;
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
            <span class="overview-stat-card__label">Healed requests</span>
            <div class="overview-stat-card__value-row">
              <span class="overview-stat-card__value">{fmtPct(selfHealedPct())}</span>
              {trendBadge(selfHealedPct(), selfHealedPctPrev())}
            </div>
          </div>
          <div class="overview-stat-card">
            <span class="overview-stat-card__label">Healed via Auto-fix</span>
            <div class="overview-stat-card__value-row">
              <span class="overview-stat-card__value">{formatNumber(s().autofix_saves.value)}</span>
              {trendBadge(s().autofix_saves.value, s().autofix_saves.previous)}
            </div>
          </div>
          <div class="overview-stat-card">
            <span class="overview-stat-card__label">Healed via Fallback</span>
            <div class="overview-stat-card__value-row">
              <span class="overview-stat-card__value">
                {formatNumber(s().fallback_saves?.value ?? 0)}
              </span>
              {trendBadge(s().fallback_saves?.value ?? 0, s().fallback_saves?.previous ?? 0)}
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};

export default AutofixKpiCards;
