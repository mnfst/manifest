import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import FilterSelect from '../../src/components/FilterSelect';
import { setLocale } from '../../src/i18n/index.js';

const ITEMS = ['anthropic', 'gemini', 'openai'];
const COLORS: Record<string, string> = {
  anthropic: '#111111',
  gemini: '#222222',
  openai: '#333333',
};

function renderFilter(
  overrides: Partial<Parameters<typeof FilterSelect>[0]> = {},
  selected: Set<string> = new Set(ITEMS),
) {
  const onToggle = vi.fn();
  const onSelectAll = vi.fn();
  const onUnselectAll = vi.fn();
  const result = render(() => (
    <FilterSelect
      noun="providers"
      items={ITEMS}
      selected={selected}
      colorMap={COLORS}
      onToggle={onToggle}
      onSelectAll={onSelectAll}
      onUnselectAll={onUnselectAll}
      {...overrides}
    />
  ));
  return { ...result, onToggle, onSelectAll, onUnselectAll };
}

const openDropdown = async () => {
  await fireEvent.click(document.querySelector('.agent-filter-select__trigger')!);
};

describe('FilterSelect', () => {
  it('shows the "all selected" trigger label', () => {
    renderFilter();
    expect(screen.getByText('All providers (3)')).toBeDefined();
  });

  it('shows the partial-selection trigger label', () => {
    renderFilter({}, new Set(['anthropic']));
    expect(screen.getByText('1 of 3 providers')).toBeDefined();
  });

  it('formats large selection counts with the active locale', async () => {
    await setLocale('ru');
    try {
      const items = Array.from({ length: 12_345 }, (_, index) => `provider-${index}`);
      const { container } = renderFilter({ items }, new Set(items));

      expect(container.querySelector('.agent-filter-select__trigger')?.textContent).toMatch(
        /Все провайдеры \(12[\u00a0\u202f]345\)/,
      );
    } finally {
      await setLocale('en');
    }
  });

  it('opens and closes the dropdown from the trigger', async () => {
    renderFilter();
    expect(document.querySelector('.agent-filter-select__dropdown')).toBeNull();
    await openDropdown();
    expect(document.querySelector('.agent-filter-select__dropdown')).not.toBeNull();
    await openDropdown();
    expect(document.querySelector('.agent-filter-select__dropdown')).toBeNull();
  });

  it('renders one row per item with swatch color and raw name by default', async () => {
    renderFilter();
    await openDropdown();
    const swatches = document.querySelectorAll('.agent-filter-select__swatch');
    expect(swatches.length).toBe(3);
    expect((swatches[0] as HTMLElement).style.background).toBe('rgb(17, 17, 17)');
    expect(screen.getByText('anthropic')).toBeDefined();
  });

  it('uses the displayName resolver when provided', async () => {
    renderFilter({ displayName: (item) => item.toUpperCase() });
    await openDropdown();
    expect(screen.getByText('ANTHROPIC')).toBeDefined();
  });

  it('marks selected items with the on-toggle class', async () => {
    renderFilter({}, new Set(['anthropic']));
    await openDropdown();
    const toggles = document.querySelectorAll('.agent-filter-select__toggle');
    expect(toggles[0]!.classList.contains('agent-filter-select__toggle--on')).toBe(true);
    expect(toggles[1]!.classList.contains('agent-filter-select__toggle--on')).toBe(false);
  });

  it('calls onToggle with the clicked item', async () => {
    const { onToggle } = renderFilter();
    await openDropdown();
    await fireEvent.click(screen.getByText('gemini'));
    expect(onToggle).toHaveBeenCalledWith('gemini');
  });

  it('disables "Select all" when everything is selected and does not call onSelectAll', async () => {
    const { onSelectAll } = renderFilter();
    await openDropdown();
    const selectAll = screen.getByText('Select all') as HTMLButtonElement;
    expect(selectAll.disabled).toBe(true);
    await fireEvent.click(selectAll);
    expect(onSelectAll).not.toHaveBeenCalled();
  });

  it('enables "Select all" when nothing is selected and calls onSelectAll', async () => {
    const { onSelectAll } = renderFilter({}, new Set<string>());
    await openDropdown();
    const selectAll = screen.getByText('Select all') as HTMLButtonElement;
    expect(selectAll.disabled).toBe(false);
    await fireEvent.click(selectAll);
    expect(onSelectAll).toHaveBeenCalled();
  });

  it('closes on outside click but stays open on inside click', async () => {
    renderFilter();
    await openDropdown();
    await fireEvent.click(screen.getByText('anthropic'));
    expect(document.querySelector('.agent-filter-select__dropdown')).not.toBeNull();
    await fireEvent.click(document.body);
    expect(document.querySelector('.agent-filter-select__dropdown')).toBeNull();
  });

  it('closes on Escape', async () => {
    renderFilter();
    await openDropdown();
    await fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.querySelector('.agent-filter-select__dropdown')).toBeNull();
  });

  it('removes document listeners on unmount', async () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderFilter();
    unmount();
    const removed = removeSpy.mock.calls.map((c) => c[0]);
    expect(removed).toContain('click');
    expect(removed).toContain('keydown');
    removeSpy.mockRestore();
  });
});
