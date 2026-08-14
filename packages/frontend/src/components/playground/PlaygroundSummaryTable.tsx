import { For, Show, type Component } from 'solid-js';
import type { PlaygroundColumn } from '../../services/playground-store.js';
import {
  formatCost,
  formatDuration,
  formatNumber,
  formatTrend,
} from '../../services/formatters.js';
import { getProvider } from '../../services/provider-utils.js';
import { resolveProviderId } from '../../services/routing-utils.js';
import { providerIcon } from '../ProviderIcon.jsx';

const WinnerBadge: Component = () => (
  <span class="playground-summary__winner-icon">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M19 9.09V6c0-.55-.45-1-1-1h-3.09L12.7 2.79a.996.996 0 0 0-1.41 0L9.08 5H5.99c-.55 0-1 .45-1 1v3.09L2.78 11.3a.996.996 0 0 0 0 1.41l2.21 2.21v3.09c0 .55.45 1 1 1h3.09l2.21 2.21c.2.2.45.29.71.29s.51-.1.71-.29l2.21-2.21h3.09c.55 0 1-.45 1-1v-3.09l2.21-2.21a.996.996 0 0 0 0-1.41l-2.21-2.21Zm-8 6.33-2.71-2.71L9.7 11.3l1.29 1.29 3.29-3.29 1.41 1.41-4.71 4.71Z" />
    </svg>
  </span>
);

function providerIdFor(col: PlaygroundColumn): string {
  return resolveProviderId(col.provider) ?? col.provider.toLowerCase();
}

const StarIcon: Component<{ filled: boolean }> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    fill={props.filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    stroke-width="2"
    viewBox="0 0 24 24"
  >
    <path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01z" />
  </svg>
);

interface Props {
  columns: readonly PlaygroundColumn[];
  /** playground_columns.id the user marked best, or null. */
  bestColumnId?: string | null;
  /** Toggle a column as best. Absent ⇒ rows are not clickable (read-only). */
  onMarkBest?: (col: PlaygroundColumn) => void;
}

interface MetricCell {
  raw: number | null;
  display: string;
  isWinner: boolean;
  delta: string | null;
}

function mkCell(
  raw: number | null,
  display: string,
  winner: number | null,
  lowerIsBetter: boolean,
): MetricCell {
  if (raw == null || winner == null) {
    return { raw, display, isWinner: false, delta: null };
  }
  const isWinner = raw === winner;
  if (isWinner) return { raw, display, isWinner: true, delta: null };
  if (winner === 0) return { raw, display, isWinner: false, delta: null };
  const ratio = (raw - winner) / winner;
  const deltaPct = lowerIsBetter ? ratio * 100 : -ratio * 100;
  return { raw, display, isWinner: false, delta: formatTrend(deltaPct) };
}

const PlaygroundSummaryTable: Component<Props> = (props) => {
  const successColumns = () => props.columns.filter((c) => c.status === 'success' && c.metrics);

  const winners = () => {
    const cols = successColumns();
    if (cols.length < 2) return null;
    const costs = cols.map((c) => c.metrics?.cost).filter((v): v is number => v != null);
    const durations = cols.map((c) => c.metrics?.durationMs ?? 0);
    // No "winner" for output tokens — fewer tokens is not better, it just
    // means a shorter answer. Only cost and speed have a meaningful minimum.
    return {
      cost: costs.length > 0 ? Math.min(...costs) : null,
      duration: durations.length > 0 ? Math.min(...durations) : null,
    };
  };

  const isBest = (col: PlaygroundColumn): boolean =>
    col.columnDbId != null && col.columnDbId === props.bestColumnId;

  return (
    <Show when={successColumns().length >= 2}>
      <section class="playground-summary" aria-label="Run summary">
        <h2 class="playground-summary__title">Comparison</h2>
        <table class="playground-summary__table">
          <thead>
            <tr>
              <th scope="col">Provider</th>
              <th scope="col">Model</th>
              <th scope="col">Cost</th>
              <th scope="col">Output tokens</th>
              <th scope="col">Duration</th>
              <th scope="col">Best</th>
            </tr>
          </thead>
          <tbody>
            <For each={successColumns()}>
              {(col) => {
                const w = winners();
                const cost = mkCell(
                  col.metrics?.cost ?? null,
                  col.metrics?.cost != null ? (formatCost(col.metrics.cost) ?? '—') : '—',
                  w?.cost ?? null,
                  true,
                );
                const duration = mkCell(
                  col.metrics?.durationMs ?? null,
                  formatDuration(col.metrics?.durationMs ?? 0),
                  w?.duration ?? null,
                  true,
                );
                const provId = providerIdFor(col);
                const providerName = getProvider(provId)?.name ?? col.provider;
                const clickable = (): boolean => !!props.onMarkBest && col.columnDbId != null;
                const pick = (): void => {
                  if (clickable()) props.onMarkBest?.(col);
                };
                return (
                  <tr
                    classList={{
                      'playground-summary__row--best': isBest(col),
                      'playground-summary__row--clickable': clickable(),
                    }}
                    role={clickable() ? 'button' : undefined}
                    tabindex={clickable() ? 0 : undefined}
                    aria-pressed={clickable() ? isBest(col) : undefined}
                    aria-label={
                      clickable() ? `Mark ${col.displayName} as the best answer` : undefined
                    }
                    onClick={pick}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        pick();
                      }
                    }}
                  >
                    <td class="playground-summary__provider">
                      <span class="playground-summary__provider-icon">
                        {providerIcon(provId, 16)}
                      </span>
                      <span class="playground-summary__provider-name">{providerName}</span>
                    </td>
                    <th scope="row">{col.displayName}</th>
                    <td>
                      <span class="playground-summary__value">{cost.display}</span>
                      <Show when={cost.isWinner}>
                        <WinnerBadge />
                      </Show>
                      <Show when={cost.delta}>
                        <span class="playground-summary__delta">{cost.delta}</span>
                      </Show>
                    </td>
                    <td>
                      <span class="playground-summary__value">
                        {formatNumber(col.metrics?.outputTokens ?? 0)}
                      </span>
                    </td>
                    <td>
                      <span class="playground-summary__value">{duration.display}</span>
                      <Show when={duration.isWinner}>
                        <WinnerBadge />
                      </Show>
                      <Show when={duration.delta}>
                        <span class="playground-summary__delta">{duration.delta}</span>
                      </Show>
                    </td>
                    <td class="playground-summary__best-cell">
                      <span
                        class="playground-summary__best-star"
                        classList={{ 'playground-summary__best-star--on': isBest(col) }}
                      >
                        <StarIcon filled={isBest(col)} />
                      </span>
                    </td>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
      </section>
    </Show>
  );
};

export default PlaygroundSummaryTable;
