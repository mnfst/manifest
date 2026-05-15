import { For, Show, type Component } from 'solid-js';
import type { BenchmarkColumn } from '../../services/benchmark-store.js';
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
  <span class="benchmark-summary__winner-icon">
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

function providerIdFor(col: BenchmarkColumn): string {
  return resolveProviderId(col.provider) ?? col.provider.toLowerCase();
}

interface Props {
  columns: readonly BenchmarkColumn[];
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

const BenchmarkSummaryTable: Component<Props> = (props) => {
  const successColumns = () => props.columns.filter((c) => c.status === 'success' && c.metrics);

  const winners = () => {
    const cols = successColumns();
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

  return (
    <Show when={successColumns().length >= 2}>
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
            <For each={successColumns()}>
              {(col) => {
                const w = winners();
                const cost = mkCell(
                  col.metrics?.cost ?? null,
                  col.metrics?.cost != null ? (formatCost(col.metrics.cost) ?? '—') : '—',
                  w?.cost ?? null,
                  true,
                );
                const output = mkCell(
                  col.metrics?.outputTokens ?? null,
                  formatNumber(col.metrics?.outputTokens ?? 0),
                  w?.output ?? null,
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
                return (
                  <tr>
                    <td class="benchmark-summary__provider">
                      <span class="benchmark-summary__provider-icon">
                        {providerIcon(provId, 16)}
                      </span>
                      <span class="benchmark-summary__provider-name">{providerName}</span>
                    </td>
                    <th scope="row">{col.displayName}</th>
                    <td>
                      <span class="benchmark-summary__value">{cost.display}</span>
                      <Show when={cost.isWinner}>
                        <WinnerBadge />
                      </Show>
                      <Show when={cost.delta}>
                        <span class="benchmark-summary__delta">{cost.delta}</span>
                      </Show>
                    </td>
                    <td>
                      <span class="benchmark-summary__value">{output.display}</span>
                      <Show when={output.isWinner}>
                        <WinnerBadge />
                      </Show>
                      <Show when={output.delta}>
                        <span class="benchmark-summary__delta">{output.delta}</span>
                      </Show>
                    </td>
                    <td>
                      <span class="benchmark-summary__value">{duration.display}</span>
                      <Show when={duration.isWinner}>
                        <WinnerBadge />
                      </Show>
                      <Show when={duration.delta}>
                        <span class="benchmark-summary__delta">{duration.delta}</span>
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
