import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import BenchmarkPrompt from '../../src/components/benchmark/BenchmarkPrompt';

function renderPrompt(overrides: Partial<Parameters<typeof BenchmarkPrompt>[0]> = {}) {
  const onChange = vi.fn();
  const onSubmit = vi.fn();
  const onRecallPrevious = vi.fn();
  const utils = render(() => (
    <BenchmarkPrompt
      value={overrides.value ?? ''}
      onChange={overrides.onChange ?? onChange}
      onSubmit={overrides.onSubmit ?? onSubmit}
      onRecallPrevious={overrides.onRecallPrevious ?? onRecallPrevious}
      disabled={overrides.disabled ?? false}
      running={overrides.running ?? false}
      headersSlot={overrides.headersSlot}
      replayBanner={overrides.replayBanner}
    />
  ));
  return { ...utils, onChange, onSubmit, onRecallPrevious };
}

describe('BenchmarkPrompt', () => {
  it('calls onChange on textarea input', () => {
    const { container, onChange } = renderPrompt();
    const textarea = container.querySelector('textarea')!;
    fireEvent.input(textarea, { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalledWith('hello');
  });

  it('submits on Enter but not on Shift+Enter', () => {
    const { container, onSubmit } = renderPrompt({ value: 'hi' });
    const textarea = container.querySelector('textarea')!;
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('also submits on Cmd/Ctrl+Enter', () => {
    const { container, onSubmit } = renderPrompt({ value: 'hi' });
    const textarea = container.querySelector('textarea')!;
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('recalls previous prompt on ArrowUp when the textarea is empty', () => {
    const { container, onRecallPrevious } = renderPrompt({ value: '' });
    const textarea = container.querySelector('textarea')!;
    fireEvent.keyDown(textarea, { key: 'ArrowUp' });
    expect(onRecallPrevious).toHaveBeenCalled();
  });

  it('does not recall on ArrowUp when the textarea has content', () => {
    const { container, onRecallPrevious } = renderPrompt({ value: 'abc' });
    fireEvent.keyDown(container.querySelector('textarea')!, { key: 'ArrowUp' });
    expect(onRecallPrevious).not.toHaveBeenCalled();
  });

  it('renders "Running…" on the send button when running is true', () => {
    const { container } = renderPrompt({ running: true });
    expect(container.querySelector('.benchmark-prompt__send')?.textContent).toContain('Running');
  });

  it('disables the send button when the value is empty', () => {
    const { container } = renderPrompt({ value: '' });
    const send = container.querySelector('.benchmark-prompt__send') as HTMLButtonElement;
    expect(send.hasAttribute('disabled')).toBe(true);
  });

  it('renders the optional headersSlot', () => {
    const { container } = renderPrompt({ headersSlot: <span data-testid="slot">S</span> });
    expect(container.querySelector('[data-testid="slot"]')).toBeDefined();
  });

  describe('replay mode', () => {
    it('renders the banner (not the textarea) and labels send as Re-run', () => {
      const { container } = renderPrompt({
        replayBanner: {
          prompt: 'original prompt',
          recordedAt: '2026-04-23T10:00:00Z',
          onExit: () => {},
        },
      });
      expect(container.querySelector('.benchmark-prompt__banner')).toBeDefined();
      expect(container.querySelector('textarea')).toBeNull();
      expect(container.querySelector('.benchmark-prompt__send')?.textContent).toContain('Re-run');
    });

    it('fires the replayBanner.onExit callback when the banner × is clicked', () => {
      const onExit = vi.fn();
      const { container } = renderPrompt({
        replayBanner: { prompt: 'p', recordedAt: '', onExit },
      });
      fireEvent.click(container.querySelector('.benchmark-prompt__banner-exit')!);
      expect(onExit).toHaveBeenCalled();
    });

    it('keeps the send button enabled in replay mode even with an empty value', () => {
      const { container } = renderPrompt({
        value: '',
        replayBanner: { prompt: 'p', recordedAt: '', onExit: () => {} },
      });
      const send = container.querySelector('.benchmark-prompt__send') as HTMLButtonElement;
      expect(send.hasAttribute('disabled')).toBe(false);
    });
  });
});
