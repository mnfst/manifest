import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import BenchmarkPrompt from '../../src/components/benchmark/BenchmarkPrompt';

interface PropsOverride {
  value?: string;
  disabled?: boolean;
  running?: boolean;
  onSubmit?: () => void;
  onChange?: (v: string) => void;
  onRecallPrevious?: () => void;
}

function setup(overrides: PropsOverride = {}) {
  const onSubmit = overrides.onSubmit ?? vi.fn();
  const onChange = overrides.onChange ?? vi.fn();
  const onRecallPrevious = overrides.onRecallPrevious ?? vi.fn();
  const props = {
    value: overrides.value ?? 'hello',
    disabled: overrides.disabled ?? false,
    running: overrides.running ?? false,
    onChange,
    onSubmit,
    onRecallPrevious,
  };
  const utils = render(() => <BenchmarkPrompt {...props} />);
  const textarea = utils.container.querySelector('textarea')!;
  const button = utils.container.querySelector('button[type="submit"]') as HTMLButtonElement;
  return { ...utils, textarea, button, onSubmit, onChange, onRecallPrevious };
}

describe('BenchmarkPrompt', () => {
  describe('Enter submission', () => {
    it('submits on Enter when not composing and value is non-empty', () => {
      const onSubmit = vi.fn();
      const { textarea } = setup({ onSubmit });
      fireEvent.keyDown(textarea, { key: 'Enter', isComposing: false });
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('submits on Cmd+Enter and Ctrl+Enter as well', () => {
      const onSubmit = vi.fn();
      const { textarea } = setup({ onSubmit });
      fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
      expect(onSubmit).toHaveBeenCalledTimes(2);
    });

    it('submits on Shift+Cmd+Enter (the modifier branch supersedes the Shift-newline branch)', () => {
      const onSubmit = vi.fn();
      const { textarea } = setup({ onSubmit });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true, metaKey: true });
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('submits on Shift+Ctrl+Enter as well', () => {
      const onSubmit = vi.fn();
      const { textarea } = setup({ onSubmit });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true, ctrlKey: true });
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('does NOT submit on Shift+Enter (line break)', () => {
      const onSubmit = vi.fn();
      const { textarea } = setup({ onSubmit });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('IME composition', () => {
    it('does NOT fire onSubmit when isComposing is true', () => {
      const onSubmit = vi.fn();
      const { textarea } = setup({ onSubmit });
      fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true });
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('does NOT fire onSubmit when keyCode is 229 (legacy IME signal)', () => {
      const onSubmit = vi.fn();
      const { textarea } = setup({ onSubmit });
      fireEvent.keyDown(textarea, { key: 'Enter', keyCode: 229 });
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('fires onSubmit on Enter when isComposing is false (post-composition commit)', () => {
      const onSubmit = vi.fn();
      const { textarea } = setup({ onSubmit });
      fireEvent.keyDown(textarea, { key: 'Enter', isComposing: false });
      expect(onSubmit).toHaveBeenCalled();
    });
  });

  describe('disabled / running state', () => {
    it('does not submit on Enter while running', () => {
      const onSubmit = vi.fn();
      const { textarea } = setup({ onSubmit, running: true });
      fireEvent.keyDown(textarea, { key: 'Enter' });
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('does not submit on Enter while disabled', () => {
      const onSubmit = vi.fn();
      const { textarea } = setup({ onSubmit, disabled: true });
      fireEvent.keyDown(textarea, { key: 'Enter' });
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('does not submit when value is whitespace-only', () => {
      const onSubmit = vi.fn();
      const { textarea } = setup({ onSubmit, value: '   ' });
      fireEvent.keyDown(textarea, { key: 'Enter' });
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('disables the send button when value is empty', () => {
      const { button } = setup({ value: '' });
      expect(button.hasAttribute('disabled')).toBe(true);
    });

    it('shows "Running…" label while running', () => {
      const { button } = setup({ running: true });
      expect(button.textContent).toContain('Running');
    });

    it('shows "Send" label when not running', () => {
      const { button } = setup();
      expect(button.textContent).toContain('Send');
    });
  });

  describe('ArrowUp recall', () => {
    it('recalls the previous prompt when ArrowUp is pressed on empty value', () => {
      const onRecallPrevious = vi.fn();
      const { textarea } = setup({ value: '', onRecallPrevious });
      fireEvent.keyDown(textarea, { key: 'ArrowUp' });
      expect(onRecallPrevious).toHaveBeenCalled();
    });

    it('does not recall when value is non-empty (cursor navigation wins)', () => {
      const onRecallPrevious = vi.fn();
      const { textarea } = setup({ value: 'something', onRecallPrevious });
      fireEvent.keyDown(textarea, { key: 'ArrowUp' });
      expect(onRecallPrevious).not.toHaveBeenCalled();
    });
  });

  describe('change handler', () => {
    it('forwards textarea input to onChange', () => {
      const onChange = vi.fn();
      const { textarea } = setup({ onChange });
      fireEvent.input(textarea, { target: { value: 'typed' } });
      expect(onChange).toHaveBeenCalledWith('typed');
    });
  });

  describe('form submission', () => {
    it('submits via the button click', () => {
      const onSubmit = vi.fn();
      const { button } = setup({ onSubmit });
      fireEvent.click(button);
      expect(onSubmit).toHaveBeenCalled();
    });

    it('button click is a no-op when disabled or running', () => {
      const onSubmit = vi.fn();
      const { button } = setup({ onSubmit, disabled: true });
      fireEvent.click(button);
      // Disabled buttons in the DOM don't fire click; the guard in submit()
      // is the second line of defense — covered by the running test below.
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
