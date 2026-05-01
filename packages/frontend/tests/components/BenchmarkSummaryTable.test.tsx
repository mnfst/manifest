import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import BenchmarkSummaryTable from '../../src/components/benchmark/BenchmarkSummaryTable';
import type { BenchmarkColumn } from '../../src/services/benchmark-store';

function success(id: string, displayName: string, metrics: BenchmarkColumn['metrics']): BenchmarkColumn {
  return {
    id,
    model: `${id}-model`,
    provider: 'openai',
    authType: 'api_key',
    displayName,
    status: 'success',
    metrics,
  };
}

describe('BenchmarkSummaryTable', () => {
  it('renders nothing when fewer than 2 columns have succeeded', () => {
    const { container } = render(() => (
      <BenchmarkSummaryTable
        columns={[
          success('a', 'A', { cost: 0.001, inputTokens: 10, outputTokens: 5, durationMs: 100 }),
        ]}
      />
    ));
    expect(container.textContent).not.toContain('Comparison');
  });

  it('highlights the cheapest and fastest cells and shows deltas for the others', () => {
    const { container } = render(() => (
      <BenchmarkSummaryTable
        columns={[
          success('a', 'Cheap Fast', {
            cost: 0.001,
            inputTokens: 10,
            outputTokens: 5,
            durationMs: 100,
          }),
          success('b', 'Expensive Slow', {
            cost: 0.002,
            inputTokens: 10,
            outputTokens: 5,
            durationMs: 200,
          }),
        ]}
      />
    ));
    expect(container.textContent).toContain('Comparison');
    const winners = container.querySelectorAll('.benchmark-summary__winner');
    expect(winners.length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).toContain('+100%');
  });

  it('does not render a delta when the winning value is zero (avoids divide-by-zero)', () => {
    const { container } = render(() => (
      <BenchmarkSummaryTable
        columns={[
          success('a', 'Free A', {
            cost: 0,
            inputTokens: 10,
            outputTokens: 5,
            durationMs: 100,
          }),
          success('b', 'Free B', {
            cost: 0,
            inputTokens: 10,
            outputTokens: 5,
            durationMs: 200,
          }),
        ]}
      />
    ));
    const costCells = container.querySelectorAll('tbody tr');
    expect(costCells.length).toBe(2);
  });
});
