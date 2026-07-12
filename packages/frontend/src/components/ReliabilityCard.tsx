import {
  createSignal,
  createResource,
  createMemo,
  For,
  Show,
  Suspense,
  lazy,
  type Component,
} from 'solid-js';
import { formatNumber } from '../services/formatters.js';
import {
  getWorkspaceAutofixStatus,
  getAutofixStats,
  getAutofixTimeseries,
  type AutofixStats,
  type AutofixTimeseries,
} from '../services/api/analytics.js';
import { messagePing } from '../services/sse.js';
import '../styles/reliability-card.css';

const ReliabilityChart = lazy(() => import('./ReliabilityChart.jsx'));

// ---------------------------------------------------------------------------
// Series toggle modes (card-local, not global)
// ---------------------------------------------------------------------------
const SERIES_MODES = [
  { value: 'disposition', label: 'Outcome' },
  { value: 'http_status', label: 'HTTP status' },
  { value: 'error_kind', label: 'Error class' },
] as const;

// ---------------------------------------------------------------------------
// Stat row helpers
// ---------------------------------------------------------------------------
function fmtPct(v: number): string {
  const pct = v * 100;
  return pct === 100 || pct === 0 ? `${pct}%` : `${pct.toFixed(1)}%`;
}

function trendBadge(
  current: number,
  previous: number,
  format: 'pct' | 'int',
  goodDirection: 'up' | 'down',
) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return <span class="rel-stat__trend rel-stat__trend--neutral">new</span>;

  let delta: number;
  let text: string;
  if (format === 'pct') {
    delta = (current - previous) * 100;
    if (Math.abs(delta) < 0.05) return null;
    const sign = delta > 0 ? '+' : '';
    text = `${sign}${delta.toFixed(1)}pp`;
  } else {
    const pct = ((current - previous) / previous) * 100;
    if (Math.abs(pct) < 0.5) return null;
    const clamped = Math.max(-999, Math.min(999, Math.round(pct)));
    const sign = clamped > 0 ? '+' : '';
    text = `${sign}${clamped}%`;
    delta = clamped;
  }

  const isGood = goodDirection === 'up' ? delta > 0 : delta < 0;
  const cls = isGood ? 'rel-stat__trend--up' : 'rel-stat__trend--down';
  return <span class={`rel-stat__trend ${cls}`}>{text}</span>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export interface ReliabilityCardProps {
  range: string;
  agentName?: string;
}

const STORAGE_KEY = 'manifest_reliability_series';

const ReliabilityCard: Component<ReliabilityCardProps> = (props) => {
  // Gate: only render if tenant has autofix access
  const [status] = createResource(
    () => ({ _ping: messagePing() }),
    () => getWorkspaceAutofixStatus(),
  );
  const available = () => status()?.available ?? false;

  // Stats for the stat row
  const [stats] = createResource(
    () =>
      available() ? { range: props.range, agent: props.agentName, _ping: messagePing() } : false,
    (p) => getAutofixStats(p.range, p.agent),
  );

  // Series toggle (card-local)
  const loadMode = (): string => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) || 'disposition';
    } catch {
      return 'disposition';
    }
  };
  const [seriesMode, setSeriesMode] = createSignal(loadMode());
  const handleMode = (v: string) => {
    setSeriesMode(v);
    try {
      sessionStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
  };

  // Timeseries for the chart
  const [ts] = createResource(
    () =>
      available()
        ? { range: props.range, by: seriesMode(), agent: props.agentName, _ping: messagePing() }
        : false,
    (p) => getAutofixTimeseries(p.range, p.by, p.agent),
  );

  return (
    <Show when={available()}>
      <div class="rel-card" classList={{ 'rel-card--skeleton': !stats() }}>
        {/* ── Stat row ── */}
        <div class="rel-stats">
          <div class="rel-stat">
            <p class="rel-stat__label">Success rate</p>
            <p class="rel-stat__value">
              <Show when={stats()} fallback="--">
                {(s) => (
                  <>
                    {fmtPct(s().success_rate.value)}
                    {trendBadge(s().success_rate.value, s().success_rate.previous, 'pct', 'up')}
                  </>
                )}
              </Show>
            </p>
          </div>
          <div class="rel-stat">
            <p class="rel-stat__label">Errors</p>
            <p class="rel-stat__value">
              <Show when={stats()} fallback="--">
                {(s) => (
                  <>
                    {formatNumber(s().errors_remaining.value)}
                    {trendBadge(
                      s().errors_remaining.value,
                      s().errors_remaining.previous,
                      'int',
                      'down',
                    )}
                  </>
                )}
              </Show>
            </p>
          </div>
          <div class="rel-stat">
            <p class="rel-stat__label">Auto-fixed</p>
            <p class="rel-stat__value">
              <Show when={stats()} fallback="--">
                {(s) => (
                  <>
                    {formatNumber(s().autofix_saves.value)}
                    {trendBadge(s().autofix_saves.value, s().autofix_saves.previous, 'int', 'up')}
                  </>
                )}
              </Show>
            </p>
          </div>
        </div>

        {/* ── Series toggle ── */}
        <div class="rel-toggle" role="radiogroup" aria-label="Series">
          <For each={SERIES_MODES}>
            {(mode) => (
              <button
                class="rel-toggle__btn"
                classList={{ 'rel-toggle__btn--active': seriesMode() === mode.value }}
                role="radio"
                aria-checked={seriesMode() === mode.value}
                onClick={() => handleMode(mode.value)}
              >
                {mode.label}
              </button>
            )}
          </For>
        </div>

        {/* ── Chart ── */}
        <Show
          when={ts() && ts()!.buckets.length > 0}
          fallback={
            <div class="rel-chart__empty">
              {stats() ? '100% success — Auto-fix standing by' : 'Loading...'}
            </div>
          }
        >
          <Suspense fallback={<div class="rel-chart__empty">Loading chart...</div>}>
            <ReliabilityChart timeseries={ts()!} range={props.range} seriesMode={seriesMode()} />
          </Suspense>
        </Show>
      </div>
    </Show>
  );
};

export default ReliabilityCard;
