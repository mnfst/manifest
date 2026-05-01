import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

vi.mock('../../src/services/formatters.js', () => ({
  formatRelativeTime: (ts: string) => `rel(${ts.slice(0, 10)})`,
  formatTime: (ts: string) => ts,
}));

import BenchmarkHistoryDrawer from '../../src/components/benchmark/BenchmarkHistoryDrawer';
import type { BenchmarkHistoryRunSummary } from '../../src/services/api';

function run(overrides: Partial<BenchmarkHistoryRunSummary>): BenchmarkHistoryRunSummary {
  return {
    id: 'r-1',
    prompt: 'what is the capital of France?',
    createdAt: new Date().toISOString(),
    modelCount: 2,
    models: ['GPT-4o', 'Claude'],
    ...overrides,
  };
}

describe('BenchmarkHistoryDrawer', () => {
  it('shows an empty-state message when there are no past runs', () => {
    const { container } = render(() => (
      <BenchmarkHistoryDrawer
        open={true}
        loading={false}
        runs={[]}
        activeRunId={null}
        onClose={() => {}}
        onSelect={() => {}}
      />
    ));
    expect(container.textContent).toContain('No past runs yet');
  });

  it('groups runs into Today / Yesterday / Earlier', () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = new Date(startOfToday - 3_600_000).toISOString();
    const lastWeek = new Date(startOfToday - 7 * 86_400_000).toISOString();
    const today = new Date().toISOString();

    const { container } = render(() => (
      <BenchmarkHistoryDrawer
        open={true}
        loading={false}
        runs={[
          run({ id: 'r-today', createdAt: today, prompt: 'today-q' }),
          run({ id: 'r-yest', createdAt: yesterday, prompt: 'yest-q' }),
          run({ id: 'r-old', createdAt: lastWeek, prompt: 'old-q' }),
        ]}
        activeRunId={null}
        onClose={() => {}}
        onSelect={() => {}}
      />
    ));
    const text = container.textContent ?? '';
    expect(text).toContain('Today');
    expect(text).toContain('Yesterday');
    expect(text).toContain('Earlier');
    const todayIdx = text.indexOf('Today');
    const yesterdayIdx = text.indexOf('Yesterday');
    const earlierIdx = text.indexOf('Earlier');
    expect(todayIdx).toBeLessThan(yesterdayIdx);
    expect(yesterdayIdx).toBeLessThan(earlierIdx);
  });

  it('fires onSelect with the run id when a history item is clicked', () => {
    const onSelect = vi.fn();
    const { container } = render(() => (
      <BenchmarkHistoryDrawer
        open={true}
        loading={false}
        runs={[run({ id: 'r-42' })]}
        activeRunId={null}
        onClose={() => {}}
        onSelect={onSelect}
      />
    ));
    const button = container.querySelector('.benchmark-history__item');
    expect(button).toBeDefined();
    fireEvent.click(button!);
    expect(onSelect).toHaveBeenCalledWith('r-42');
  });

  it('truncates long prompts with an ellipsis', () => {
    const longPrompt = 'q'.repeat(100);
    const { container } = render(() => (
      <BenchmarkHistoryDrawer
        open={true}
        loading={false}
        runs={[run({ id: 'r-long', prompt: longPrompt })]}
        activeRunId={null}
        onClose={() => {}}
        onSelect={() => {}}
      />
    ));
    expect(container.textContent).toContain('…');
  });

  it('uses the singular "model" label for a single-model run', () => {
    const { container } = render(() => (
      <BenchmarkHistoryDrawer
        open={true}
        loading={false}
        runs={[run({ id: 'r-1', modelCount: 1, models: ['One'] })]}
        activeRunId={null}
        onClose={() => {}}
        onSelect={() => {}}
      />
    ));
    expect(container.textContent).toContain('1 model');
    expect(container.textContent).not.toContain('1 models');
  });

  it('shows the +N suffix when there are more than two models', () => {
    const { container } = render(() => (
      <BenchmarkHistoryDrawer
        open={true}
        loading={false}
        runs={[run({ id: 'r-1', modelCount: 4, models: ['A', 'B', 'C', 'D'] })]}
        activeRunId={null}
        onClose={() => {}}
        onSelect={() => {}}
      />
    ));
    expect(container.textContent).toContain('+2');
  });

  it('shows a "Loading…" indicator while loading is true', () => {
    const { container } = render(() => (
      <BenchmarkHistoryDrawer
        open={true}
        loading={true}
        runs={[]}
        activeRunId={null}
        onClose={() => {}}
        onSelect={() => {}}
      />
    ));
    expect(container.textContent).toContain('Loading');
  });

  it('fires onClose when Escape is pressed at the window', () => {
    const onClose = vi.fn();
    render(() => (
      <BenchmarkHistoryDrawer
        open={true}
        loading={false}
        runs={[]}
        activeRunId={null}
        onClose={onClose}
        onSelect={() => {}}
      />
    ));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('fires onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <BenchmarkHistoryDrawer
        open={true}
        loading={false}
        runs={[]}
        activeRunId={null}
        onClose={onClose}
        onSelect={() => {}}
      />
    ));
    const close = container.querySelector('[aria-label="Close history"]') as HTMLElement;
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalled();
  });

  it('fires onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <BenchmarkHistoryDrawer
        open={true}
        loading={false}
        runs={[]}
        activeRunId={null}
        onClose={onClose}
        onSelect={() => {}}
      />
    ));
    const backdrop = container.querySelector('.benchmark-history__backdrop') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    const { container } = render(() => (
      <BenchmarkHistoryDrawer
        open={false}
        loading={false}
        runs={[]}
        activeRunId={null}
        onClose={() => {}}
        onSelect={() => {}}
      />
    ));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders the dialog with role="dialog" and aria-modal="true" so screen readers announce the trap', () => {
    const { container } = render(() => (
      <BenchmarkHistoryDrawer
        open={true}
        loading={false}
        runs={[]}
        activeRunId={null}
        onClose={() => {}}
        onSelect={() => {}}
      />
    ));
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeDefined();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
  });

  it('highlights the active run id with the --active class', () => {
    const { container } = render(() => (
      <BenchmarkHistoryDrawer
        open={true}
        loading={false}
        runs={[run({ id: 'r-1' }), run({ id: 'r-2', prompt: 'two' })]}
        activeRunId="r-2"
        onClose={() => {}}
        onSelect={() => {}}
      />
    ));
    const active = container.querySelector('.benchmark-history__item--active');
    expect(active).toBeDefined();
    expect(active?.textContent).toContain('two');
  });
});
