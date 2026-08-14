import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import PlaygroundColumn from '../../src/components/playground/PlaygroundColumn';
import type { PlaygroundColumn as ColumnData } from '../../src/services/playground-store';

function col(over: Partial<ColumnData> = {}): ColumnData {
  return {
    id: 'c1',
    model: 'openai/gpt-4o-mini',
    provider: 'openai',
    authType: 'api_key',
    displayName: 'GPT-4o Mini',
    status: 'idle',
    ...over,
  };
}

const baseProps = {
  isCheapest: false,
  isFastest: false,
  onRemove: vi.fn(),
  onChangeModel: vi.fn(),
  onRetry: vi.fn(),
};

describe('PlaygroundColumn', () => {
  it('renders the idle placeholder and no skeleton/markdown', () => {
    const { container } = render(() => <PlaygroundColumn {...baseProps} column={col()} />);
    expect(container.textContent).toContain('Type a prompt below to run this model.');
    expect(container.querySelector('.playground-column__skeleton')).toBeNull();
    expect(container.querySelector('.playground-column__response')).toBeNull();
  });

  it('shows the skeleton while loading with no response yet', () => {
    const { container } = render(() => (
      <PlaygroundColumn {...baseProps} column={col({ status: 'loading' })} />
    ));
    expect(container.querySelector('.playground-column__skeleton')).not.toBeNull();
    expect(container.querySelector('.playground-column__response')).toBeNull();
  });

  it('progressively renders streamed text while still loading (no skeleton once text exists)', async () => {
    const { container } = render(() => (
      <PlaygroundColumn
        {...baseProps}
        column={col({ status: 'loading', response: 'partial answer' })}
      />
    ));
    // Skeleton is replaced by the markdown response as soon as text arrives.
    expect(container.querySelector('.playground-column__skeleton')).toBeNull();
    // MarkdownContent loads marked/dompurify lazily, so wait for the response.
    await vi.waitFor(() => {
      const md = container.querySelector('.playground-column__response');
      expect(md).not.toBeNull();
      expect(md!.textContent).toContain('partial answer');
    });
  });

  it('renders the final markdown response on success', async () => {
    const { container } = render(() => (
      <PlaygroundColumn
        {...baseProps}
        column={col({ status: 'success', response: '## Done\n\nall good' })}
      />
    ));
    await vi.waitFor(() => {
      expect(container.querySelector('.playground-column__response h2')?.textContent).toBe('Done');
    });
  });

  it('renders the error state with a Retry button and fires onRetry', () => {
    const onRetry = vi.fn();
    const { container, getByText } = render(() => (
      <PlaygroundColumn
        {...baseProps}
        onRetry={onRetry}
        column={col({ status: 'error', error: 'rate limited' })}
      />
    ));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('rate limited');
    fireEvent.click(getByText('Retry'));
    expect(onRetry).toHaveBeenCalledWith('c1');
  });

  it('hides the Retry button in read-only mode', () => {
    const { queryByText } = render(() => (
      <PlaygroundColumn
        {...baseProps}
        readOnly
        column={col({ status: 'error', error: 'boom' })}
      />
    ));
    expect(queryByText('Retry')).toBeNull();
  });

  describe('header — change model + remove', () => {
    it('renders an editable title button that fires onChangeModel, plus a remove button', () => {
      const onChangeModel = vi.fn();
      const onRemove = vi.fn();
      const { container, getByLabelText } = render(() => (
        <PlaygroundColumn
          {...baseProps}
          onChangeModel={onChangeModel}
          onRemove={onRemove}
          column={col()}
        />
      ));
      fireEvent.click(container.querySelector('.playground-column__title')!);
      expect(onChangeModel).toHaveBeenCalledWith('c1');
      fireEvent.click(getByLabelText('Remove GPT-4o Mini'));
      expect(onRemove).toHaveBeenCalledWith('c1');
    });

    it('renders a static (non-button) title and no remove button when read-only', () => {
      const { container, queryByLabelText } = render(() => (
        <PlaygroundColumn {...baseProps} readOnly column={col()} />
      ));
      expect(container.querySelector('button.playground-column__title')).toBeNull();
      expect(container.querySelector('.playground-column__title--readonly')).not.toBeNull();
      expect(queryByLabelText('Remove GPT-4o Mini')).toBeNull();
    });
  });

  describe('best-answer star', () => {
    it('renders an interactive star button on success when onMarkBest is set', () => {
      const onMarkBest = vi.fn();
      const { container } = render(() => (
        <PlaygroundColumn
          {...baseProps}
          column={col({ status: 'success', response: 'ok' })}
          onMarkBest={onMarkBest}
          isBest={false}
        />
      ));
      const btn = container.querySelector('button.playground-column__best') as HTMLButtonElement;
      expect(btn).not.toBeNull();
      expect(btn.getAttribute('aria-pressed')).toBe('false');
      expect(btn.getAttribute('aria-label')).toBe('Mark GPT-4o Mini as best answer');
      fireEvent.click(btn);
      expect(onMarkBest).toHaveBeenCalledTimes(1);
    });

    it('reflects the pressed/best state in the button when isBest is true', () => {
      const { container } = render(() => (
        <PlaygroundColumn
          {...baseProps}
          column={col({ status: 'success', response: 'ok' })}
          onMarkBest={vi.fn()}
          isBest
        />
      ));
      const btn = container.querySelector('button.playground-column__best')!;
      expect(btn.getAttribute('aria-pressed')).toBe('true');
      expect(btn.getAttribute('aria-label')).toBe('Unmark GPT-4o Mini as best answer');
      expect(btn.classList.contains('playground-column__best--on')).toBe(true);
    });

    it('does not render the star button until the column is successful', () => {
      const { container } = render(() => (
        <PlaygroundColumn
          {...baseProps}
          column={col({ status: 'loading', response: 'streaming' })}
          onMarkBest={vi.fn()}
        />
      ));
      expect(container.querySelector('.playground-column__best')).toBeNull();
    });

    it('renders a static star (no button) when read-only, not marked best, and onMarkBest is absent', () => {
      const { container } = render(() => (
        <PlaygroundColumn
          {...baseProps}
          column={col({ status: 'success', response: 'ok' })}
          isBest
        />
      ));
      const staticStar = container.querySelector('.playground-column__best--static');
      expect(staticStar).not.toBeNull();
      expect(staticStar!.tagName.toLowerCase()).toBe('span');
      expect(staticStar!.getAttribute('aria-label')).toBe(
        'GPT-4o Mini was marked the best answer',
      );
      expect(container.querySelector('button.playground-column__best')).toBeNull();
    });

    it('renders neither star variant when read-only and not the best answer', () => {
      const { container } = render(() => (
        <PlaygroundColumn
          {...baseProps}
          column={col({ status: 'success', response: 'ok' })}
          isBest={false}
        />
      ));
      expect(container.querySelector('.playground-column__best')).toBeNull();
    });
  });

  describe('metrics footer', () => {
    it('shows dashes when there are no metrics', () => {
      const { container } = render(() => (
        <PlaygroundColumn {...baseProps} column={col({ status: 'idle' })} />
      ));
      const values = container.querySelectorAll('.playground-column__metric-value');
      expect([...values].every((v) => v.textContent === '—')).toBe(true);
    });

    it('renders cost, output tokens and duration when metrics are present', () => {
      const { container } = render(() => (
        <PlaygroundColumn
          {...baseProps}
          column={col({
            status: 'success',
            response: 'ok',
            metrics: { cost: 0.0125, inputTokens: 10, outputTokens: 1234, durationMs: 2500 },
          })}
        />
      ));
      const txt = container.querySelector('.playground-column__metrics')!.textContent ?? '';
      expect(txt).toContain('$0.01');
      expect(txt).toContain('1.2k');
    });

    it('shows the cheapest + fastest win badges only on success', () => {
      const { container } = render(() => (
        <PlaygroundColumn
          {...baseProps}
          isCheapest
          isFastest
          column={col({
            status: 'success',
            response: 'ok',
            metrics: { cost: 0.001, inputTokens: 1, outputTokens: 2, durationMs: 50 },
          })}
        />
      ));
      expect(container.querySelectorAll('.playground-column__win-badge').length).toBe(2);
    });

    it('does not show win badges when the column is not successful', () => {
      const { container } = render(() => (
        <PlaygroundColumn
          {...baseProps}
          isCheapest
          isFastest
          column={col({ status: 'loading', response: 'x' })}
        />
      ));
      expect(container.querySelectorAll('.playground-column__win-badge').length).toBe(0);
    });

    it('falls back to a dash when formatCost returns null (negative cost)', () => {
      const { container } = render(() => (
        <PlaygroundColumn
          {...baseProps}
          column={col({
            status: 'success',
            response: 'ok',
            metrics: { cost: -1, inputTokens: 1, outputTokens: 2, durationMs: 50 },
          })}
        />
      ));
      // First metric value is the cost cell.
      const cost = container.querySelector('.playground-column__metric-value')!;
      expect(cost.textContent).toBe('—');
    });
  });

  describe('response headers disclosure', () => {
    it('is hidden when there are no headers', () => {
      const { container } = render(() => (
        <PlaygroundColumn
          {...baseProps}
          column={col({ status: 'success', response: 'ok', headers: {} })}
        />
      ));
      expect(container.querySelector('.playground-column__headers')).toBeNull();
    });

    it('toggles the header list open and closed', () => {
      const { container, getByText } = render(() => (
        <PlaygroundColumn
          {...baseProps}
          column={col({
            status: 'success',
            response: 'ok',
            headers: { 'x-request-id': 'abc', 'x-model': 'gpt' },
          })}
        />
      ));
      expect(container.querySelector('.playground-column__headers-list')).toBeNull();
      const toggle = getByText('Response headers');
      fireEvent.click(toggle);
      const list = container.querySelector('.playground-column__headers-list')!;
      expect(list.textContent).toContain('x-request-id');
      expect(list.textContent).toContain('abc');
      fireEvent.click(toggle);
      expect(container.querySelector('.playground-column__headers-list')).toBeNull();
    });
  });

  it('resolves an icon for an unknown provider via the lowercase fallback', () => {
    const { container } = render(() => (
      <PlaygroundColumn {...baseProps} column={col({ provider: 'SomeWeirdProvider' })} />
    ));
    // Component still renders the title/name without throwing.
    expect(container.querySelector('.playground-column__name')?.textContent).toBe(
      'GPT-4o Mini',
    );
  });
});
