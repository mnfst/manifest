import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import PlaygroundSummaryTable from '../../src/components/playground/PlaygroundSummaryTable';
import type { PlaygroundColumn } from '../../src/services/playground-store';

function success(
  id: string,
  displayName: string,
  metrics: PlaygroundColumn['metrics'],
  columnDbId?: string | null,
): PlaygroundColumn {
  return {
    id,
    model: `${id}-model`,
    provider: 'openai',
    authType: 'api_key',
    displayName,
    status: 'success',
    metrics,
    columnDbId,
  };
}

const M = (cost: number, durationMs: number, outputTokens = 5): PlaygroundColumn['metrics'] => ({
  cost,
  inputTokens: 10,
  outputTokens,
  durationMs,
});

describe('PlaygroundSummaryTable', () => {
  it('renders nothing when fewer than 2 columns have succeeded', () => {
    const { container } = render(() => (
      <PlaygroundSummaryTable columns={[success('a', 'A', M(0.001, 100))]} />
    ));
    expect(container.textContent).not.toContain('Comparison');
  });

  it('does not render columns without metrics or non-success status', () => {
    const noMetrics: PlaygroundColumn = {
      id: 'x',
      model: 'm',
      provider: 'openai',
      authType: 'api_key',
      displayName: 'X',
      status: 'success',
    };
    const loading: PlaygroundColumn = { ...noMetrics, id: 'y', status: 'loading' };
    const { container } = render(() => (
      <PlaygroundSummaryTable columns={[noMetrics, loading, success('a', 'A', M(0.001, 100))]} />
    ));
    // Only one successful+metrics column → table hidden.
    expect(container.textContent).not.toContain('Comparison');
  });

  it('highlights the cheapest/fastest cells, shows deltas, and renders the Best header', () => {
    const { container } = render(() => (
      <PlaygroundSummaryTable
        columns={[
          success('a', 'Cheap Fast', M(0.001, 100)),
          success('b', 'Expensive Slow', M(0.002, 200)),
        ]}
      />
    ));
    expect(container.textContent).toContain('Comparison');
    const winners = container.querySelectorAll('.playground-summary__winner-icon');
    expect(winners.length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).toContain('+100%');
    // New Best column header + per-row star cell.
    const headers = [...container.querySelectorAll('thead th')].map((h) => h.textContent);
    expect(headers).toContain('Best');
    expect(container.querySelectorAll('.playground-summary__best-cell').length).toBe(2);
  });

  it('shows the raw output token count with NO winner trophy and NO delta', () => {
    const { container } = render(() => (
      <PlaygroundSummaryTable
        columns={[
          success('a', 'A', M(0.001, 100, 12)),
          success('b', 'B', M(0.002, 200, 999)),
        ]}
      />
    ));
    // Output tokens column is the 4th cell of each row.
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    const outputCells = [...rows].map((r) => r.querySelectorAll('td')[2]);
    // Plain number, no trophy/delta markup inside the output cell.
    expect(outputCells[0]!.textContent).toContain('12');
    expect(outputCells[1]!.textContent).toContain('999');
    expect(outputCells[0]!.querySelector('.playground-summary__winner-icon')).toBeNull();
    expect(outputCells[0]!.querySelector('.playground-summary__delta')).toBeNull();
    expect(outputCells[1]!.querySelector('.playground-summary__winner-icon')).toBeNull();
  });

  it('renders cost dashes with no winner/delta when every column cost is null', () => {
    // cost: null on all rows → winners().cost is null → mkCell hits its
    // null-guard early return (no winner, no delta) for the cost cell.
    const nullCost = (id: string, dur: number): PlaygroundColumn =>
      success(id, id.toUpperCase(), {
        cost: null,
        inputTokens: 1,
        outputTokens: 2,
        durationMs: dur,
      });
    const { container } = render(() => (
      <PlaygroundSummaryTable columns={[nullCost('a', 100), nullCost('b', 200)]} />
    ));
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    // Cost cell (1st td) shows the dash, no winner badge, no delta.
    const costCell = rows[0]!.querySelectorAll('td')[1]!;
    expect(costCell.textContent).toContain('—');
    expect(costCell.querySelector('.playground-summary__winner-icon')).toBeNull();
    expect(costCell.querySelector('.playground-summary__delta')).toBeNull();
  });

  it('does not render a delta when the winning value is zero (avoids divide-by-zero)', () => {
    const { container } = render(() => (
      <PlaygroundSummaryTable
        columns={[success('a', 'Free A', M(0, 100)), success('b', 'Free B', M(0, 200))]}
      />
    ));
    expect(container.querySelectorAll('tbody tr').length).toBe(2);
  });

  describe('best-answer interaction', () => {
    it('marks rows clickable only when onMarkBest is set AND the column has a db id', () => {
      const onMarkBest = vi.fn();
      const { container } = render(() => (
        <PlaygroundSummaryTable
          columns={[
            success('a', 'Has Id', M(0.001, 100), 'db-a'),
            success('b', 'No Id', M(0.002, 200), null),
          ]}
          onMarkBest={onMarkBest}
        />
      ));
      const rows = container.querySelectorAll('tbody tr');
      const [withId, withoutId] = rows;
      expect(withId!.classList.contains('playground-summary__row--clickable')).toBe(true);
      expect(withId!.getAttribute('role')).toBe('button');
      expect(withId!.getAttribute('tabindex')).toBe('0');
      expect(withId!.getAttribute('aria-label')).toBe('Mark Has Id as the best answer');
      // Column without a db id is not actionable.
      expect(withoutId!.classList.contains('playground-summary__row--clickable')).toBe(false);
      expect(withoutId!.getAttribute('role')).toBeNull();
      expect(withoutId!.getAttribute('tabindex')).toBeNull();
    });

    it('rows are not clickable when onMarkBest is absent (read-only)', () => {
      const { container } = render(() => (
        <PlaygroundSummaryTable
          columns={[
            success('a', 'A', M(0.001, 100), 'db-a'),
            success('b', 'B', M(0.002, 200), 'db-b'),
          ]}
        />
      ));
      const row = container.querySelector('tbody tr')!;
      expect(row.classList.contains('playground-summary__row--clickable')).toBe(false);
      expect(row.getAttribute('role')).toBeNull();
    });

    it('fires onMarkBest with the column on click', () => {
      const onMarkBest = vi.fn();
      const col = success('a', 'A', M(0.001, 100), 'db-a');
      const { container } = render(() => (
        <PlaygroundSummaryTable
          columns={[col, success('b', 'B', M(0.002, 200), 'db-b')]}
          onMarkBest={onMarkBest}
        />
      ));
      fireEvent.click(container.querySelector('tbody tr')!);
      expect(onMarkBest).toHaveBeenCalledWith(expect.objectContaining({ columnDbId: 'db-a' }));
    });

    it('does not fire onMarkBest on click for a non-clickable row', () => {
      const onMarkBest = vi.fn();
      const { container } = render(() => (
        <PlaygroundSummaryTable
          columns={[
            success('a', 'A', M(0.001, 100), null),
            success('b', 'B', M(0.002, 200), null),
          ]}
          onMarkBest={onMarkBest}
        />
      ));
      fireEvent.click(container.querySelector('tbody tr')!);
      expect(onMarkBest).not.toHaveBeenCalled();
    });

    it('fires onMarkBest on Enter and Space, ignoring other keys', () => {
      const onMarkBest = vi.fn();
      const { container } = render(() => (
        <PlaygroundSummaryTable
          columns={[
            success('a', 'A', M(0.001, 100), 'db-a'),
            success('b', 'B', M(0.002, 200), 'db-b'),
          ]}
          onMarkBest={onMarkBest}
        />
      ));
      const row = container.querySelector('tbody tr')!;
      fireEvent.keyDown(row, { key: 'Enter' });
      fireEvent.keyDown(row, { key: ' ' });
      fireEvent.keyDown(row, { key: 'a' });
      expect(onMarkBest).toHaveBeenCalledTimes(2);
    });

    it('highlights the best row and fills its star when bestColumnId matches', () => {
      const { container } = render(() => (
        <PlaygroundSummaryTable
          columns={[
            success('a', 'A', M(0.001, 100), 'db-a'),
            success('b', 'B', M(0.002, 200), 'db-b'),
          ]}
          bestColumnId="db-b"
          onMarkBest={vi.fn()}
        />
      ));
      const rows = container.querySelectorAll('tbody tr');
      const bestRow = rows[1]!;
      expect(bestRow.classList.contains('playground-summary__row--best')).toBe(true);
      expect(bestRow.getAttribute('aria-pressed')).toBe('true');
      expect(
        bestRow.querySelector('.playground-summary__best-star--on'),
      ).not.toBeNull();
      // The non-best row's star is not "on".
      expect(rows[0]!.querySelector('.playground-summary__best-star--on')).toBeNull();
    });
  });
});
