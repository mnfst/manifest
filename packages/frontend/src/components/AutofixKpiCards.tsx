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

function errorTrendLabel(current: number, previous: number): string {
  if (previous === 0 && current === 0) return 'No errors';
  if (previous === 0) return 'New errors';
  const pct = ((current - previous) / previous) * 100;
  const clamped = Math.max(-999, Math.min(999, Math.round(pct)));
  const sign = clamped > 0 ? '+' : '';
  return `${sign}${clamped}% vs previous period`;
}

export interface AutofixKpiCardsProps {
  stats: AutofixStats | undefined;
  /** Error classes breakdown (by_class from /errors/breakdown) */
  errorClasses?: Record<string, number>;
  /** Sparkline data points (daily/hourly error counts) for the error trend card */
  errorSparkline?: number[];
}

const AutofixKpiCards: Component<AutofixKpiCardsProps> = (props) => {
  const autofixPct = () => {
    const s = props.stats;
    if (!s) return 0;
    const total = s.autofix_saves.value + s.errors_remaining.value;
    return total > 0 ? s.autofix_saves.value / total : 0;
  };

  const topError = () => {
    const classes = props.errorClasses;
    if (!classes) return null;
    const entries = Object.entries(classes).filter(([, c]) => c > 0);
    if (entries.length === 0) return null;
    entries.sort(([, a], [, b]) => b - a);
    return { name: entries[0]![0], count: entries[0]![1] };
  };

  const errorLabel = (key: string): string =>
    key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

  return (
    <Show when={props.stats}>
      {(s) => (
        <div class="overview-stats" style="grid-template-columns: repeat(4, 1fr);">
          {/* Card 1: Success rate */}
          <div class="overview-stat-card">
            <span class="overview-stat-card__label">Success rate</span>
            <div class="overview-stat-card__value-row">
              <span class="overview-stat-card__value">{fmtPct(s().success_rate.value)}</span>
              {trendBadge(s().success_rate.value, s().success_rate.previous)}
            </div>
          </div>

          {/* Card 2: Auto-fixed */}
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

          {/* Card 3: Error trend */}
          <div class="overview-stat-card">
            <span class="overview-stat-card__label">Error trend</span>
            <Show when={props.errorSparkline && props.errorSparkline.length > 1}>
              <div style="display: flex; align-items: end; gap: 1px; height: 32px; margin: 4px 0;">
                {props.errorSparkline!.map((v) => {
                  const max = Math.max(...props.errorSparkline!, 1);
                  return (
                    <div
                      style={{
                        flex: '1',
                        background: 'hsl(var(--foreground) / 0.15)',
                        'border-radius': '2px 2px 0 0',
                        'min-height': '2px',
                        height: `${(v / max) * 100}%`,
                      }}
                    />
                  );
                })}
              </div>
            </Show>
            <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
              {errorTrendLabel(s().errors_remaining.value, s().errors_remaining.previous)}
            </span>
          </div>

          {/* Card 4: Top error */}
          <div class="overview-stat-card">
            <span class="overview-stat-card__label">Top error</span>
            <Show
              when={topError()}
              fallback={
                <span style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); font-style: italic;">
                  No errors
                </span>
              }
            >
              {(top) => (
                <>
                  <span class="overview-stat-card__value">{formatNumber(top().count)}</span>
                  <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                    {errorLabel(top().name)}
                  </span>
                </>
              )}
            </Show>
          </div>
        </div>
      )}
    </Show>
  );
};

export default AutofixKpiCards;
