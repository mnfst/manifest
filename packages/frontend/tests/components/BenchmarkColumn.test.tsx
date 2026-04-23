import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

vi.mock('../../src/services/formatters.js', () => ({
  formatCost: (v: number) => (v < 0 ? null : `$${v.toFixed(2)}`),
  formatNumber: (v: number) => String(v),
  formatDuration: (ms: number) => `${ms}ms`,
}));

vi.mock('../../src/components/ProviderIcon.jsx', () => ({
  providerIcon: (id: string) => <span data-testid={`icon-${id}`} />,
}));

vi.mock('../../src/services/routing-utils.js', () => ({
  resolveProviderId: (p: string) => p.toLowerCase(),
  inferProviderFromModel: (m: string) => (m.startsWith('openai/') ? 'openai' : null),
}));

vi.mock('../../src/components/benchmark/MarkdownContent.jsx', () => ({
  default: (props: { text: string; class?: string }) => (
    <div data-testid="md" class={props.class}>
      {props.text}
    </div>
  ),
}));

import BenchmarkColumn from '../../src/components/benchmark/BenchmarkColumn';
import type { BenchmarkColumn as ColumnData } from '../../src/services/benchmark-store';

function makeColumn(overrides: Partial<ColumnData> = {}): ColumnData {
  return {
    id: 'col-1',
    model: 'openai/gpt-4o',
    provider: 'openai',
    authType: 'api_key',
    displayName: 'GPT-4o',
    status: 'idle',
    ...overrides,
  };
}

describe('BenchmarkColumn', () => {
  it('renders an idle placeholder when the column has no data yet', () => {
    const { container } = render(() => (
      <BenchmarkColumn
        column={makeColumn()}
        isCheapest={false}
        isFastest={false}
        onRemove={() => {}}
        onChangeModel={() => {}}
        onRetry={() => {}}
      />
    ));
    expect(container.textContent).toContain('Type a prompt below');
  });

  it('renders the skeleton while loading', () => {
    const { container } = render(() => (
      <BenchmarkColumn
        column={makeColumn({ status: 'loading' })}
        isCheapest={false}
        isFastest={false}
        onRemove={() => {}}
        onChangeModel={() => {}}
        onRetry={() => {}}
      />
    ));
    expect(container.querySelector('.benchmark-column__skeleton')).toBeDefined();
  });

  it('renders the response via MarkdownContent and success metrics', () => {
    const col = makeColumn({
      status: 'success',
      response: '## title',
      metrics: { cost: 0.001, inputTokens: 5, outputTokens: 3, durationMs: 120 },
    });
    const { container, getByTestId } = render(() => (
      <BenchmarkColumn
        column={col}
        isCheapest={true}
        isFastest={false}
        onRemove={() => {}}
        onChangeModel={() => {}}
        onRetry={() => {}}
      />
    ));
    expect(getByTestId('md').textContent).toBe('## title');
    expect(container.textContent).toContain('Cheapest');
    expect(container.textContent).toContain('120ms');
    expect(container.textContent).toContain('3');
  });

  it('renders the Fastest chip when isFastest is true', () => {
    const col = makeColumn({
      status: 'success',
      response: 'hi',
      metrics: { cost: 0.001, inputTokens: 5, outputTokens: 3, durationMs: 120 },
    });
    const { container } = render(() => (
      <BenchmarkColumn
        column={col}
        isCheapest={false}
        isFastest={true}
        onRemove={() => {}}
        onChangeModel={() => {}}
        onRetry={() => {}}
      />
    ));
    expect(container.textContent).toContain('Fastest');
  });

  it('renders error state with retry and invokes the callback', () => {
    const onRetry = vi.fn();
    const col = makeColumn({ status: 'error', error: 'boom' });
    const { container } = render(() => (
      <BenchmarkColumn
        column={col}
        isCheapest={false}
        isFastest={false}
        onRemove={() => {}}
        onChangeModel={() => {}}
        onRetry={onRetry}
      />
    ));
    expect(container.textContent).toContain('boom');
    fireEvent.click(container.querySelector('.benchmark-column__error button')!);
    expect(onRetry).toHaveBeenCalledWith('col-1');
  });

  it('fires onChangeModel when the header title is clicked', () => {
    const onChange = vi.fn();
    const { container } = render(() => (
      <BenchmarkColumn
        column={makeColumn()}
        isCheapest={false}
        isFastest={false}
        onRemove={() => {}}
        onChangeModel={onChange}
        onRetry={() => {}}
      />
    ));
    fireEvent.click(container.querySelector('.benchmark-column__title')!);
    expect(onChange).toHaveBeenCalledWith('col-1');
  });

  it('fires onRemove when the × button is clicked', () => {
    const onRemove = vi.fn();
    const { container } = render(() => (
      <BenchmarkColumn
        column={makeColumn()}
        isCheapest={false}
        isFastest={false}
        onRemove={onRemove}
        onChangeModel={() => {}}
        onRetry={() => {}}
      />
    ));
    fireEvent.click(container.querySelector('.benchmark-column__remove')!);
    expect(onRemove).toHaveBeenCalledWith('col-1');
  });

  it('renders the Response headers details when headers are provided', () => {
    const col = makeColumn({
      status: 'success',
      response: 'hi',
      metrics: { cost: 0.001, inputTokens: 1, outputTokens: 1, durationMs: 10 },
      headers: { 'x-request-id': 'abc' },
    });
    const { container } = render(() => (
      <BenchmarkColumn
        column={col}
        isCheapest={false}
        isFastest={false}
        onRemove={() => {}}
        onChangeModel={() => {}}
        onRetry={() => {}}
      />
    ));
    expect(container.querySelector('details.benchmark-column__headers')).toBeDefined();
    expect(container.textContent).toContain('x-request-id');
  });
});
