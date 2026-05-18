import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

vi.mock('../../src/components/ProviderIcon.jsx', () => ({
  providerIcon: (id: string, size: number) => (
    <span data-testid="pic" data-pid={id} data-size={size} />
  ),
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

function col(overrides: Partial<ColumnData> = {}): ColumnData {
  return {
    id: 'c1',
    model: 'claude-3-5-sonnet',
    provider: 'anthropic',
    authType: 'api_key',
    displayName: 'Claude 3.5 Sonnet',
    status: 'idle',
    ...overrides,
  };
}

const noop = () => {};

describe('BenchmarkColumn', () => {
  it('renders a successful response with winner chips, headers, and inferred provider', () => {
    const onRemove = vi.fn();
    const onChangeModel = vi.fn();
    const { container, getByTestId } = render(() => (
      <BenchmarkColumn
        column={col({
          status: 'success',
          response: '# hello',
          metrics: { cost: 0.0012, inputTokens: 10, outputTokens: 42, durationMs: 1234 },
          headers: { 'x-trace': 'abc', 'content-type': 'application/json' },
        })}
        isCheapest={true}
        isFastest={true}
        onRemove={onRemove}
        onChangeModel={onChangeModel}
        onRetry={noop}
      />
    ));

    // Model name inferred the anthropic provider id.
    expect(getByTestId('pic').getAttribute('data-pid')).toBe('anthropic');
    expect(getByTestId('md').textContent).toContain('# hello');
    expect(container.textContent).toContain('Cheapest');
    expect(container.textContent).toContain('Fastest');
    expect(container.textContent).toContain('42');
    // Headers <details> with one <dt>/<dd> pair per header.
    expect(container.querySelectorAll('dt').length).toBe(2);
    expect(container.querySelector('dd')?.textContent).toBe('abc');

    fireEvent.click(container.querySelector('.benchmark-column__title')!);
    expect(onChangeModel).toHaveBeenCalledWith('c1');
    fireEvent.click(container.querySelector('.benchmark-column__remove')!);
    expect(onRemove).toHaveBeenCalledWith('c1');
  });

  it('renders an error state with a working Retry button (provider resolved by id)', () => {
    const onRetry = vi.fn();
    const { container, getByTestId } = render(() => (
      <BenchmarkColumn
        column={col({
          model: 'unknownmodelxyz',
          provider: 'openai',
          status: 'error',
          error: 'upstream exploded',
        })}
        isCheapest={false}
        isFastest={false}
        onRemove={noop}
        onChangeModel={noop}
        onRetry={onRetry}
      />
    ));

    // model infers nothing → resolveProviderId('openai') wins.
    expect(getByTestId('pic').getAttribute('data-pid')).toBe('openai');
    expect(container.textContent).toContain('upstream exploded');
    // No metrics → every metric shows the em-dash placeholder.
    expect(container.textContent).toContain('—');
    expect(container.textContent).not.toContain('Cheapest');

    fireEvent.click(container.querySelector('.benchmark-column__error button')!);
    expect(onRetry).toHaveBeenCalledWith('c1');
  });

  it('renders the idle placeholder and falls back to a lowercased provider id', () => {
    const { container, getByTestId } = render(() => (
      <BenchmarkColumn
        column={col({ model: 'mystery', provider: 'WeirdCustom', status: 'idle' })}
        isCheapest={false}
        isFastest={false}
        onRemove={noop}
        onChangeModel={noop}
        onRetry={noop}
      />
    ));
    expect(getByTestId('pic').getAttribute('data-pid')).toBe('weirdcustom');
    expect(container.textContent).toContain('Type a prompt below to run this model.');
  });

  it('renders the loading skeleton', () => {
    const { container } = render(() => (
      <BenchmarkColumn
        column={col({ status: 'loading' })}
        isCheapest={false}
        isFastest={false}
        onRemove={noop}
        onChangeModel={noop}
        onRetry={noop}
      />
    ));
    expect(container.querySelector('.benchmark-column__skeleton')).not.toBeNull();
  });
});
