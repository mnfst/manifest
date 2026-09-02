import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import VirtualList from '../../src/components/VirtualList';

const rows = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `row-${i}` }));

describe('VirtualList', () => {
  it('does not mount items that sit far below the default viewport', () => {
    const { container } = render(() => (
      <VirtualList items={rows(100)} itemHeight={() => 20} class="vl">
        {(item) => <div data-testid={item.id}>{item.id}</div>}
      </VirtualList>
    ));

    expect(container.querySelector('[data-testid="row-0"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="row-99"]')).toBeNull();
    expect(container.querySelectorAll('[data-testid^="row-"]').length).toBeLessThan(50);
  });

  it('mounts later items after the scroller moves down', () => {
    const { container } = render(() => (
      <VirtualList items={rows(100)} itemHeight={() => 20} class="vl">
        {(item) => <div data-testid={item.id}>{item.id}</div>}
      </VirtualList>
    ));
    const scroller = container.querySelector('.vl') as HTMLElement;
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, value: 1600 });
    fireEvent.scroll(scroller);

    expect(container.querySelector('[data-testid="row-80"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="row-0"]')).toBeNull();
  });

  it('renders every item when the catalog fits in the viewport', () => {
    const { container } = render(() => (
      <VirtualList items={rows(3)} itemHeight={() => 20} class="vl">
        {(item) => <div data-testid={item.id}>{item.id}</div>}
      </VirtualList>
    ));

    expect(container.querySelector('[data-testid="row-0"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="row-1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="row-2"]')).not.toBeNull();
  });

  it('renders an empty spacer when there are no items', () => {
    const { container } = render(() => (
      <VirtualList items={[]} itemHeight={() => 20} class="vl">
        {(item) => <div data-testid={item.id}>{item.id}</div>}
      </VirtualList>
    ));

    expect(container.querySelector('.vl')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid^="row-"]').length).toBe(0);
  });

  it('narrows the window after ResizeObserver reports a real scroller height', () => {
    const callbacks: ResizeObserverCallback[] = [];
    class FakeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = FakeObserver as unknown as typeof ResizeObserver;

    const { container, unmount } = render(() => (
      <VirtualList items={rows(100)} itemHeight={() => 20} class="vl">
        {(item) => <div data-testid={item.id}>{item.id}</div>}
      </VirtualList>
    ));
    const scroller = container.querySelector('.vl') as HTMLElement;
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 80 });
    callbacks[0]?.([], {} as ResizeObserver);

    expect(container.querySelector('[data-testid="row-0"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="row-20"]')).toBeNull();
    unmount();
    globalThis.ResizeObserver = original;
  });
});
