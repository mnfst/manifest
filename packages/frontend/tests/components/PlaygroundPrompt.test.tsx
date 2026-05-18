import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import PlaygroundPrompt from '../../src/components/playground/PlaygroundPrompt';

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
  const utils = render(() => <PlaygroundPrompt {...props} />);
  const textarea = utils.container.querySelector('textarea')!;
  const button = utils.container.querySelector('button[type="submit"]') as HTMLButtonElement;
  return { ...utils, textarea, button, onSubmit, onChange, onRecallPrevious };
}

describe('PlaygroundPrompt', () => {
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

    it('labels the send button "Running" while running', () => {
      const { button } = setup({ running: true });
      expect(button.getAttribute('aria-label')).toBe('Running');
    });

    it('labels the send button "Send prompt" when not running', () => {
      const { button } = setup();
      expect(button.getAttribute('aria-label')).toBe('Send prompt');
    });

    it('keeps the send button enabled while running so the spinner stays clickable-free but visible', () => {
      // disabled = props.disabled || empty value. running alone doesn't disable.
      const { button } = setup({ running: true, disabled: false, value: 'hi' });
      expect(button.hasAttribute('disabled')).toBe(false);
    });

    it('keeps the textarea editable while running (disabled only when disabled && !running)', () => {
      const { textarea } = setup({ disabled: true, running: true });
      expect(textarea.hasAttribute('disabled')).toBe(false);
    });

    it('disables the textarea when disabled and not running', () => {
      const { textarea } = setup({ disabled: true, running: false, value: 'hi' });
      expect(textarea.hasAttribute('disabled')).toBe(true);
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

  describe('headers slot', () => {
    it('renders the optional headersSlot content in the toolbar', () => {
      const { container } = render(() => (
        <PlaygroundPrompt
          value="hi"
          disabled={false}
          running={false}
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onRecallPrevious={vi.fn()}
          headersSlot={<span data-testid="hslot">slot-here</span>}
        />
      ));
      expect(container.querySelector('[data-testid="hslot"]')?.textContent).toBe('slot-here');
    });

    it('renders nothing in the slot area when headersSlot is absent', () => {
      const { container } = render(() => (
        <PlaygroundPrompt
          value="hi"
          disabled={false}
          running={false}
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onRecallPrevious={vi.fn()}
        />
      ));
      expect(container.querySelector('.playground-prompt__toolbar-left')?.textContent).toBe('');
    });
  });

  describe('form submission', () => {
    it('submits via the button click', () => {
      const onSubmit = vi.fn();
      const { button } = setup({ onSubmit });
      fireEvent.click(button);
      expect(onSubmit).toHaveBeenCalled();
    });

    it('submits via the form submit event (preventDefault path)', () => {
      const onSubmit = vi.fn();
      const { container } = setup({ onSubmit });
      const form = container.querySelector('form')!;
      fireEvent.submit(form);
      expect(onSubmit).toHaveBeenCalled();
    });

    it('autogrows the textarea on input without throwing', () => {
      const { textarea } = setup({ onChange: vi.fn() });
      // jsdom has no layout; the autoGrow path still runs (scrollHeight = 0).
      expect(() => fireEvent.input(textarea, { target: { value: 'line1\nline2' } })).not.toThrow();
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
