import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import type { RoutingProvider } from '../../src/services/api/routing.js';
import RouteKeyChip from '../../src/components/RouteKeyChip';

function makeKey(label: string, overrides: Partial<RoutingProvider> = {}): RoutingProvider {
  return {
    id: `id-${label}`,
    provider: 'openai',
    auth_type: 'api_key',
    is_active: true,
    has_api_key: true,
    label,
    priority: 0,
    connected_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const twoKeys: RoutingProvider[] = [makeKey('key-1'), makeKey('key-2', { id: 'id-key-2', priority: 1 })];

function renderChip(propsOverride: Partial<Parameters<typeof RouteKeyChip>[0]> = {}) {
  const onPick = propsOverride.onPick ?? vi.fn();
  const result = render(() => (
    <RouteKeyChip
      keys={propsOverride.keys ?? twoKeys}
      currentLabel={propsOverride.currentLabel ?? null}
      modelLabel={propsOverride.modelLabel ?? 'GPT-4o'}
      usedLabels={propsOverride.usedLabels}
      onPick={onPick}
      buttonClass={propsOverride.buttonClass ?? 'chip-class'}
      disabled={propsOverride.disabled}
      allowClear={propsOverride.allowClear}
      leadingMargin={propsOverride.leadingMargin}
      menuMinWidth={propsOverride.menuMinWidth}
      stopPropagation={propsOverride.stopPropagation}
    />
  ));
  return { ...result, onPick };
}

function getTriggerButton(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('button[aria-haspopup="listbox"]') as HTMLButtonElement;
}

function getListbox(container: HTMLElement): HTMLElement | null {
  return container.querySelector('ul[role="listbox"]');
}

function getOptionButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button[role="option"]'));
}

describe('RouteKeyChip', () => {
  it('renders button with currentLabel and aria-label referencing modelLabel', () => {
    const { container } = renderChip({ currentLabel: 'my-key', modelLabel: 'Claude Opus' });
    const button = getTriggerButton(container);
    expect(button).toBeDefined();
    expect(button.textContent).toContain('my-key');
    expect(button.getAttribute('aria-label')).toContain('Claude Opus');
    expect(button.getAttribute('aria-label')).toContain('my-key');
  });

  it('opens dropdown on button click and toggles aria-expanded to true', () => {
    const { container } = renderChip();
    const button = getTriggerButton(container);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(getListbox(container)).toBeNull();

    fireEvent.click(button);

    expect(getListbox(container)).not.toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes dropdown on button click when already open', () => {
    const { container } = renderChip();
    const button = getTriggerButton(container);
    fireEvent.click(button);
    expect(getListbox(container)).not.toBeNull();

    fireEvent.click(button);

    expect(getListbox(container)).toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes dropdown when clicking outside via mousedown', () => {
    const { container } = renderChip();
    fireEvent.click(getTriggerButton(container));
    expect(getListbox(container)).not.toBeNull();

    const outside = document.createElement('div');
    document.body.appendChild(outside);
    fireEvent.mouseDown(outside);

    expect(getListbox(container)).toBeNull();
    outside.remove();
  });

  it('does not close dropdown when clicking inside the listbox', () => {
    const { container } = renderChip();
    fireEvent.click(getTriggerButton(container));
    const listbox = getListbox(container);
    expect(listbox).not.toBeNull();

    // mousedown on the listbox itself — it is contained by containerRef
    fireEvent.mouseDown(listbox!);

    expect(getListbox(container)).not.toBeNull();
  });

  it('disables option buttons whose lowercase label is in usedLabels', () => {
    const { container } = renderChip({
      usedLabels: () => new Set(['key-1']),
    });
    fireEvent.click(getTriggerButton(container));

    const options = getOptionButtons(container);
    const optKey1 = options.find((o) => o.textContent?.includes('key-1'));
    const optKey2 = options.find((o) => o.textContent?.includes('key-2'));
    expect(optKey1).toBeDefined();
    expect(optKey2).toBeDefined();
    expect(optKey1!.hasAttribute('disabled')).toBe(true);
    expect(optKey2!.hasAttribute('disabled')).toBe(false);
  });

  it('calls onPick with null when Clear pin is clicked and closes dropdown', () => {
    const onPick = vi.fn();
    const { container } = renderChip({ allowClear: true, currentLabel: 'key-1', onPick });
    fireEvent.click(getTriggerButton(container));

    const clearBtn = getOptionButtons(container).find((b) => b.textContent?.includes('Clear pin'));
    expect(clearBtn).toBeDefined();
    fireEvent.click(clearBtn!);

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(null);
    expect(getListbox(container)).toBeNull();
  });

  it('calls onPick with selected label when a non-selected option is clicked', () => {
    const onPick = vi.fn();
    const { container } = renderChip({ currentLabel: 'key-1', onPick });
    fireEvent.click(getTriggerButton(container));

    const optKey2 = getOptionButtons(container).find((o) => o.textContent?.includes('key-2'));
    expect(optKey2).toBeDefined();
    fireEvent.click(optKey2!);

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('key-2');
    expect(getListbox(container)).toBeNull();
  });

  it('does not call onPick when clicking the already-selected option', () => {
    const onPick = vi.fn();
    const { container } = renderChip({ currentLabel: 'key-1', onPick });
    fireEvent.click(getTriggerButton(container));

    const optKey1 = getOptionButtons(container).find((o) => o.textContent?.includes('key-1'));
    expect(optKey1).toBeDefined();
    fireEvent.click(optKey1!);

    expect(onPick).not.toHaveBeenCalled();
    // Clicking an option still closes the dropdown (setOpen(false) runs unconditionally)
    expect(getListbox(container)).toBeNull();
  });

  it('sets aria-selected correctly on options based on currentLabel', () => {
    const { container } = renderChip({ currentLabel: 'key-1' });
    fireEvent.click(getTriggerButton(container));

    const optKey1 = getOptionButtons(container).find((o) => o.textContent?.includes('key-1'));
    const optKey2 = getOptionButtons(container).find((o) => o.textContent?.includes('key-2'));
    expect(optKey1!.getAttribute('aria-selected')).toBe('true');
    expect(optKey2!.getAttribute('aria-selected')).toBe('false');
  });

  it('falls back to first key label when currentLabel is null', () => {
    const { container } = renderChip({
      currentLabel: null,
      keys: [makeKey('default-key'), makeKey('other-key', { id: 'id-other', priority: 1 })],
    });
    const button = getTriggerButton(container);
    expect(button.textContent).toContain('default-key');
    expect(button.textContent).not.toContain('other-key');
  });

  it('calls event.stopPropagation when stopPropagation prop is true', () => {
    const { container } = renderChip({ stopPropagation: true });
    const button = getTriggerButton(container);

    // Spy on stopPropagation by synthesizing the event explicitly.
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
    const stopSpy = vi.spyOn(evt, 'stopPropagation');
    button.dispatchEvent(evt);

    expect(stopSpy).toHaveBeenCalled();
  });

  it('does not call stopPropagation when stopPropagation prop is false/undefined', () => {
    const { container } = renderChip();
    const button = getTriggerButton(container);

    const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
    const stopSpy = vi.spyOn(evt, 'stopPropagation');
    button.dispatchEvent(evt);

    expect(stopSpy).not.toHaveBeenCalled();
  });

  it('hides Clear pin button when allowClear is false even if currentLabel is set', () => {
    const { container } = renderChip({ allowClear: false, currentLabel: 'key-1' });
    fireEvent.click(getTriggerButton(container));

    const clearBtn = getOptionButtons(container).find((b) => b.textContent?.includes('Clear pin'));
    expect(clearBtn).toBeUndefined();
  });

  it('disables the trigger button when disabled prop is true', () => {
    const { container } = renderChip({ disabled: true });
    const button = getTriggerButton(container);
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('does not open the dropdown when disabled prop is true', () => {
    const { container } = renderChip({ disabled: true });
    fireEvent.click(getTriggerButton(container));

    // A disabled <button> swallows click events, so the dropdown never renders.
    const options = getOptionButtons(container);
    expect(options.length).toBe(0);
  });

  it('applies margin-left: 4px inline style when leadingMargin is true', () => {
    const { container } = renderChip({ leadingMargin: true });
    const style = getTriggerButton(container).getAttribute('style') ?? '';
    expect(style).toContain('margin-left: 4px');
  });

  it('omits the margin-left rule when leadingMargin is false/undefined', () => {
    const { container } = renderChip();
    const style = getTriggerButton(container).getAttribute('style') ?? '';
    expect(style).not.toContain('margin-left: 4px');
  });

  it('uses the menuMinWidth prop for the dropdown min-width', () => {
    const { container } = renderChip({ menuMinWidth: 200 });
    fireEvent.click(getTriggerButton(container));
    const ul = getListbox(container);
    expect(ul).not.toBeNull();
    const style = ul!.getAttribute('style') ?? '';
    expect(style).toContain('min-width: 200px');
  });

  it('falls back to a 160px min-width when menuMinWidth is not provided', () => {
    const { container } = renderChip();
    fireEvent.click(getTriggerButton(container));
    const ul = getListbox(container);
    const style = ul!.getAttribute('style') ?? '';
    expect(style).toContain('min-width: 160px');
  });

  it('renders an empty string when keys is empty and currentLabel is null', () => {
    const { container } = renderChip({ keys: [], currentLabel: null });
    const button = getTriggerButton(container);
    // The displayed label span is the first child span — its text should be empty.
    const labelSpan = button.querySelector('span:first-child');
    expect(labelSpan?.textContent).toBe('');
  });

  it('treats usedLabels as case-insensitive (lowercase set lookup)', () => {
    // The component lowercases the key.label before checking usedLabels —
    // a Set containing the lowercase form must mark it as used.
    const { container } = renderChip({
      keys: [makeKey('Key-MixedCase')],
      usedLabels: () => new Set(['key-mixedcase']),
    });
    fireEvent.click(getTriggerButton(container));
    const option = getOptionButtons(container)[0];
    expect(option.hasAttribute('disabled')).toBe(true);
  });
});
