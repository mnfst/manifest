import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import HeaderComboBox, { type HeaderSuggestion } from '../../src/components/HeaderComboBox';

const suggestions: HeaderSuggestion[] = [
  { label: 'x-manifest-tier', value: 'x-manifest-tier', sublabel: '12× · premium · free', group: 'openai-js' },
  { label: 'x-custom-foo', value: 'x-custom-foo', sublabel: '5× seen' },
];

function Harness(props: {
  initial?: string;
  onInput?: (v: string) => void;
  invalid?: boolean;
  errorMessage?: string;
  freeFormHint?: string;
}) {
  const [val, setVal] = createSignal(props.initial ?? '');
  return (
    <HeaderComboBox
      value={val()}
      onInput={(v) => {
        setVal(v);
        props.onInput?.(v);
      }}
      suggestions={suggestions}
      placeholder="enter header"
      invalid={props.invalid}
      errorMessage={props.errorMessage}
      freeFormHint={props.freeFormHint}
    />
  );
}

describe('HeaderComboBox', () => {
  it('renders suggestions on focus and includes a sublabel when provided', () => {
    const { container, getByPlaceholderText } = render(() => <Harness />);
    const input = getByPlaceholderText('enter header');
    fireEvent.focus(input);
    expect(container.textContent).toContain('x-manifest-tier');
    expect(container.textContent).toContain('12× · premium · free');
    expect(container.textContent).toContain('openai-js');
  });

  it('filters suggestions by typed prefix (case-insensitive)', () => {
    const { container, getByPlaceholderText } = render(() => <Harness />);
    const input = getByPlaceholderText('enter header') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'CUSTOM' } });
    expect(container.textContent).toContain('x-custom-foo');
    expect(container.textContent).not.toContain('x-manifest-tier');
  });

  it('selects a suggestion via mousedown and fires onInput', () => {
    const onInput = vi.fn();
    const { container, getByPlaceholderText } = render(() => <Harness onInput={onInput} />);
    const input = getByPlaceholderText('enter header');
    fireEvent.focus(input);
    const first = container.querySelector('.header-combo__option') as HTMLElement;
    fireEvent.mouseDown(first);
    expect(onInput).toHaveBeenCalledWith('x-manifest-tier');
  });

  it('navigates with ArrowDown + Enter and selects the highlighted entry', () => {
    const onInput = vi.fn();
    const { getByPlaceholderText } = render(() => <Harness onInput={onInput} />);
    const input = getByPlaceholderText('enter header');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onInput).toHaveBeenCalledWith('x-manifest-tier');
  });

  it('ArrowUp clamps at -1 and Escape closes the menu', () => {
    const { container, getByPlaceholderText } = render(() => <Harness />);
    const input = getByPlaceholderText('enter header');
    fireEvent.focus(input);
    // ArrowUp when nothing selected shouldn't crash.
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(container.querySelector('.header-combo__menu')).toBeNull();
  });

  it('shows a pinned free-form option when the value does not match a suggestion', () => {
    const { container, getByPlaceholderText } = render(() => (
      <Harness freeFormHint='Use "x-new-header" as a custom header' />
    ));
    const input = getByPlaceholderText('enter header') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'x-new-header' } });
    expect(container.textContent).toContain('Use "x-new-header" as a custom header');
    const free = container.querySelector('.header-combo__option--free') as HTMLElement;
    expect(free).not.toBeNull();
  });

  it('commits a free-form value via mousedown on the pinned option', () => {
    const onInput = vi.fn();
    const { container, getByPlaceholderText } = render(() => <Harness onInput={onInput} />);
    const input = getByPlaceholderText('enter header') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'x-new-header' } });
    const free = container.querySelector('.header-combo__option--free') as HTMLElement;
    fireEvent.mouseDown(free);
    expect(onInput).toHaveBeenCalledWith('x-new-header');
  });

  it('renders the error message when invalid is true', () => {
    const { container } = render(() => (
      <Harness invalid errorMessage="bad header" />
    ));
    expect(container.textContent).toContain('bad header');
    expect(container.querySelector('.header-combo--invalid')).not.toBeNull();
  });
});
