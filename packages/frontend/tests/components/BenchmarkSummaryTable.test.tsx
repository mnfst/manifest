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

  it('puts the Original row first and shows signed deltas (better=green, worse=red) against it', () => {
    const original = success('orig', 'Original GPT-4o', {
      cost: 0.01,
      inputTokens: 100,
      outputTokens: 50,
      durationMs: 300,
    });
    original.isOriginal = true;

    const { container } = render(() => (
      <BenchmarkSummaryTable
        columns={[
          original,
          success('a', 'Cheaper', {
            cost: 0.005, // 50% cheaper → better
            inputTokens: 100,
            outputTokens: 50,
            durationMs: 150, // 50% faster → better
          }),
          success('b', 'Worse', {
            cost: 0.02, // 100% more expensive → worse
            inputTokens: 100,
            outputTokens: 50,
            durationMs: 600, // 100% slower → worse
          }),
        ]}
      />
    ));

    const rows = container.querySelectorAll('tbody tr');
    // Original is row 0.
    expect(rows.length).toBe(3);
    expect(rows[0]?.classList.contains('benchmark-summary__row--original')).toBe(true);
    expect(rows[0]?.textContent).toContain('Original');

    const betterDeltas = container.querySelectorAll('.benchmark-summary__delta--better');
    const worseDeltas = container.querySelectorAll('.benchmark-summary__delta--worse');
    // Cheaper row: 2 better deltas (cost + duration)
    // Worse row:   2 worse deltas (cost + duration)
    expect(betterDeltas.length).toBe(2);
    expect(worseDeltas.length).toBe(2);
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
