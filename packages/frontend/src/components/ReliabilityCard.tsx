import { createSignal, createResource, Show, Suspense, lazy, type Component } from 'solid-js';
import { formatNumber } from '../services/formatters.js';
import {
  getWorkspaceAutofixStatus,
  getAutofixStats,
  getAutofixTimeseries,
} from '../services/api/analytics.js';
import { messagePing } from '../services/sse.js';

const ReliabilityChart = lazy(() => import('./ReliabilityChart.jsx'));

type SeriesMode = 'disposition' | 'http_status' | 'error_kind';

const STORAGE_KEY = 'manifest_reliability_series';

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

function fmtPct(v: number): string {
  const pct = v * 100;
  return pct === 100 || pct === 0 ? `${pct}%` : `${pct.toFixed(1)}%`;
}

const EMPTY = (msg: string) => (
  <div style="height: 260px; color: hsl(var(--muted-foreground)); display: flex; align-items: center; justify-content: center;">
    {msg}
  </div>
);

export interface ReliabilityCardProps {
  range: string;
  agentName?: string;
}

const ReliabilityCard: Component<ReliabilityCardProps> = (props) => {
  const [status] = createResource(
    () => ({ _ping: messagePing() }),
    () => getWorkspaceAutofixStatus(),
  );
  const available = () => status()?.available ?? false;

  const [stats] = createResource(
    () =>
      available() ? { range: props.range, agent: props.agentName, _ping: messagePing() } : false,
    (p) => getAutofixStats(p.range, p.agent),
  );

  const loadMode = (): SeriesMode => {
    try {
      const v = sessionStorage.getItem(STORAGE_KEY);
      if (v === 'disposition' || v === 'http_status' || v === 'error_kind') return v;
    } catch {
      /* ignore */
    }
    return 'disposition';
  };
  const [seriesMode, setSeriesMode] = createSignal<SeriesMode>(loadMode());
  const handleMode = (v: SeriesMode) => {
    setSeriesMode(v);
    try {
      sessionStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const [ts] = createResource(
    () =>
      available()
        ? { range: props.range, by: seriesMode(), agent: props.agentName, _ping: messagePing() }
        : false,
    (p) => getAutofixTimeseries(p.range, p.by, p.agent),
  );

  // Derive summary values for each stat header from the timeseries keys
  const totalRequests = () => {
    const s = stats();
    if (!s) return 0;
    return s.recovered_by_manifest.value + s.errors_remaining.value;
  };

  return (
    <Show when={available()}>
      <div class="chart-card" style="margin-bottom: 24px;">
        <div class="chart-card__header">
          {/* Outcome tab — shows total requests */}
          <button
            type="button"
            class="chart-card__stat chart-card__stat--clickable"
            classList={{ 'chart-card__stat--active': seriesMode() === 'disposition' }}
            onClick={() => handleMode('disposition')}
          >
            <span class="chart-card__label">Outcome</span>
            <div class="chart-card__value-row">
              <span class="chart-card__value">
                <Show when={stats()} fallback="--">
                  {formatNumber(totalRequests())}
                </Show>
              </span>
            </div>
          </button>
          {/* HTTP status tab */}
          <button
            type="button"
            class="chart-card__stat chart-card__stat--clickable"
            classList={{ 'chart-card__stat--active': seriesMode() === 'http_status' }}
            onClick={() => handleMode('http_status')}
          >
            <span class="chart-card__label">HTTP status</span>
            <div class="chart-card__value-row">
              <span class="chart-card__value">
                <Show when={stats()} fallback="--">
                  {fmtPct(stats()!.success_rate.value)}
                </Show>
              </span>
              <Show when={stats()}>
                {trendBadge(
                  stats()!.success_rate.value * 100,
                  stats()!.success_rate.previous * 100,
                )}
              </Show>
            </div>
          </button>
          {/* Error class tab */}
          <button
            type="button"
            class="chart-card__stat chart-card__stat--clickable"
            classList={{ 'chart-card__stat--active': seriesMode() === 'error_kind' }}
            onClick={() => handleMode('error_kind')}
          >
            <span class="chart-card__label">Error class</span>
            <div class="chart-card__value-row">
              <span class="chart-card__value">
                <Show when={stats()} fallback="--">
                  {formatNumber(stats()!.errors_remaining.value)}
                </Show>
              </span>
            </div>
          </button>
        </div>
        <div class="chart-card__body">
          <Show
            when={ts() && ts()!.buckets.length > 0}
            fallback={EMPTY(stats() ? '100% success — Auto-fix standing by' : 'Loading...')}
          >
            <Suspense fallback={EMPTY('Loading chart...')}>
              <ReliabilityChart timeseries={ts()!} range={props.range} seriesMode={seriesMode()} />
            </Suspense>
          </Show>
        </div>
      </div>
    </Show>
  );
};

export default ReliabilityCard;
