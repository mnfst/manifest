import { For, Show, type Component } from 'solid-js';
import type { BenchmarkColumn } from '../../services/benchmark-store.js';
import {
  formatCost,
  formatDuration,
  formatNumber,
  formatTrend,
} from '../../services/formatters.js';
import { getProvider } from '../../services/provider-utils.js';
import { inferProviderFromModel, resolveProviderId } from '../../services/routing-utils.js';
import { providerIcon } from '../ProviderIcon.jsx';

function providerIdFor(col: BenchmarkColumn): string {
  return (
    inferProviderFromModel(col.model) ??
    resolveProviderId(col.provider) ??
    col.provider.toLowerCase()
  );
}

interface Props {
  columns: readonly BenchmarkColumn[];
}

interface MetricCell {
  raw: number | null;
  display: string;
  isWinner: boolean;
  delta: string | null;
  /** true when lower-is-better and delta is negative (i.e., better than baseline). */
  isBetter: boolean | null;
}

function mkCell(
  raw: number | null,
  display: string,
  winner: number | null,
  lowerIsBetter: boolean,
): MetricCell {
  if (raw == null || winner == null) {
    return { raw, display, isWinner: false, delta: null, isBetter: null };
  }
  const isWinner = raw === winner;
  if (isWinner) return { raw, display, isWinner: true, delta: null, isBetter: null };
  if (winner === 0) return { raw, display, isWinner: false, delta: null, isBetter: null };
  const ratio = (raw - winner) / winner;
  const deltaPct = lowerIsBetter ? ratio * 100 : -ratio * 100;
  const isBetter = lowerIsBetter ? raw < winner : raw > winner;
  return { raw, display, isWinner: false, delta: formatTrend(deltaPct), isBetter };
}

const BenchmarkSummaryTable: Component<Props> = (props) => {
  const successColumns = () => props.columns.filter((c) => c.status === 'success' && c.metrics);
  const originalColumn = () => successColumns().find((c) => c.isOriginal) ?? null;
  const freshColumns = () => successColumns().filter((c) => !c.isOriginal);

  /**
   * In recording-replay mode, the Original's metrics are the baseline that
   * all deltas render against. Otherwise, deltas render against the best
   * column for each metric (the existing winner logic).
   */
  const baseline = () => {
    const original = originalColumn();
    if (!original || !original.metrics) return null;
    return {
      cost: original.metrics.cost,
      output: original.metrics.outputTokens,
      duration: original.metrics.durationMs,
    };
  };

  const winners = () => {
    const cols = freshColumns();
    if (cols.length < 2) return null;
    const costs = cols.map((c) => c.metrics?.cost).filter((v): v is number => v != null);
    const outputs = cols.map((c) => c.metrics?.outputTokens ?? 0);
    const durations = cols.map((c) => c.metrics?.durationMs ?? 0);
    return {
      cost: costs.length > 0 ? Math.min(...costs) : null,
      output: outputs.length > 0 ? Math.min(...outputs) : null,
      duration: durations.length > 0 ? Math.min(...durations) : null,
    };
  };

  // Ordered rows: Original first (when present), then fresh columns.
  const orderedRows = () => {
    const o = originalColumn();
    const rest = freshColumns();
    return o ? [o, ...rest] : rest;
  };

  return (
    <Show when={orderedRows().length >= 2}>
      <section class="benchmark-summary" aria-label="Benchmark summary">
        <h2 class="benchmark-summary__title">Comparison</h2>
        <table class="benchmark-summary__table">
          <thead>
            <tr>
              <th scope="col">Provider</th>
              <th scope="col">Model</th>
              <th scope="col">Cost</th>
              <th scope="col">Output tokens</th>
              <th scope="col">Duration</th>
            </tr>
          </thead>
          <tbody>
            <For each={orderedRows()}>
              {(col) => {
                const b = baseline();
                const w = winners();
                // When comparing against an Original baseline, deltas are
                // vs. the baseline (signed). Otherwise, vs. the winner.
                const costBase = b ? b.cost : (w?.cost ?? null);
                const outputBase = b ? b.output : (w?.output ?? null);
                const durationBase = b ? b.duration : (w?.duration ?? null);
                const isOriginalRow = col.isOriginal === true;

                const cost = mkCell(
                  col.metrics?.cost ?? null,
                  col.metrics?.cost != null ? (formatCost(col.metrics.cost) ?? '—') : '—',
                  costBase,
                  true,
                );
                const output = mkCell(
                  col.metrics?.outputTokens ?? null,
                  formatNumber(col.metrics?.outputTokens ?? 0),
                  outputBase,
                  true,
                );
                const duration = mkCell(
                  col.metrics?.durationMs ?? null,
                  formatDuration(col.metrics?.durationMs ?? 0),
                  durationBase,
                  true,
                );
                const provId = providerIdFor(col);
                const providerName = getProvider(provId)?.name ?? col.provider;
                // In baseline mode the "winner" highlight goes on the
                // Original row, and the rows below show signed deltas
                // against it — but we don't want a "winner" tint on the
                // baseline cell itself (it IS the baseline).
                const applyCostWin = b ? false : cost.isWinner;
                const applyOutputWin = b ? false : output.isWinner;
                const applyDurationWin = b ? false : duration.isWinner;
                return (
                  <tr
                    classList={{
                      'benchmark-summary__row--original': isOriginalRow,
                    }}
                  >
                    <td class="benchmark-summary__provider">
                      <span class="benchmark-summary__provider-icon">
                        {providerIcon(provId, 16)}
                      </span>
                      <span class="benchmark-summary__provider-name">{providerName}</span>
                    </td>
                    <th scope="row">
                      {col.displayName}
                      <Show when={isOriginalRow}>
                        <span class="benchmark-summary__chip">Original</span>
                      </Show>
                    </th>
                    <td classList={{ 'benchmark-summary__winner': applyCostWin }}>
                      <span class="benchmark-summary__value">{cost.display}</span>
                      <Show when={!isOriginalRow && cost.delta}>
                        <span
                          class="benchmark-summary__delta"
                          classList={{
                            'benchmark-summary__delta--better': b != null && cost.isBetter === true,
                            'benchmark-summary__delta--worse': b != null && cost.isBetter === false,
                          }}
                        >
                          {cost.delta}
                        </span>
                      </Show>
                    </td>
                    <td classList={{ 'benchmark-summary__winner': applyOutputWin }}>
                      <span class="benchmark-summary__value">{output.display}</span>
                      <Show when={!isOriginalRow && output.delta}>
                        <span class="benchmark-summary__delta">{output.delta}</span>
                      </Show>
                    </td>
                    <td classList={{ 'benchmark-summary__winner': applyDurationWin }}>
                      <span class="benchmark-summary__value">{duration.display}</span>
                      <Show when={!isOriginalRow && duration.delta}>
                        <span
                          class="benchmark-summary__delta"
                          classList={{
                            'benchmark-summary__delta--better':
                              b != null && duration.isBetter === true,
                            'benchmark-summary__delta--worse':
                              b != null && duration.isBetter === false,
                          }}
                        >
                          {duration.delta}
                        </span>
                      </Show>
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

export default BenchmarkSummaryTable;
