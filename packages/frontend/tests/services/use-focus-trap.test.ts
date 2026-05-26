import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, createSignal } from 'solid-js';
import { useFocusTrap } from '../../src/services/use-focus-trap';

/**
 * Helper: builds a container with N focusable buttons + an "outside" button
 * that lives in the document but outside the trap. Returns dispose to tear
 * down the Solid root cleanly.
 */
function setupTrap(opts: {
  childCount: number;
  containerTabIndex?: number;
}) {
  const outside = document.createElement('button');
  outside.textContent = 'outside';
  document.body.appendChild(outside);
  outside.focus();

  const container = document.createElement('div');
  if (opts.containerTabIndex !== undefined) {
    container.tabIndex = opts.containerTabIndex;
  }
  for (let i = 0; i < opts.childCount; i++) {
    const btn = document.createElement('button');
    btn.textContent = `child-${i}`;
    container.appendChild(btn);
  }
  document.body.appendChild(container);

  const [open, setOpen] = createSignal(false);
  const dispose = createRoot((d) => {
    useFocusTrap(open, () => container);
    return d;
  });

  return {
    container,
    outside,
    open,
    setOpen,
    cleanup: () => {
      dispose();
      container.remove();
      outside.remove();
    },
  };
}

describe('useFocusTrap', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('does nothing while open() is false', () => {
    const t = setupTrap({ childCount: 2 });
    expect(document.activeElement).toBe(t.outside);
    t.cleanup();
  });

  it('does nothing when the container accessor returns undefined', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();

    const [open, setOpen] = createSignal(false);
    const dispose = createRoot((d) => {
      useFocusTrap(open, () => undefined);
      return d;
    });

    setOpen(true);
    // Focus stays where it was — there is no container to redirect into.
    expect(document.activeElement).toBe(outside);
    dispose();
    outside.remove();
  });

  it('moves focus to the first focusable child when opened', () => {
    const t = setupTrap({ childCount: 2 });
    t.setOpen(true);
    const firstChild = t.container.querySelector('button');
    expect(document.activeElement).toBe(firstChild);
    t.cleanup();
  });

  it('focuses the container itself when it has no focusable children but has tabindex', () => {
    const t = setupTrap({ childCount: 0, containerTabIndex: -1 });
    t.setOpen(true);
    expect(document.activeElement).toBe(t.container);
    t.cleanup();
  });

  it('does not move focus when there are no children and no tabindex', () => {
    const t = setupTrap({ childCount: 0 });
    t.setOpen(true);
    // Focus stays on the outside button — nothing in the container can take it.
    expect(document.activeElement).toBe(t.outside);
    t.cleanup();
  });

  it('wraps Tab from the last focusable to the first', () => {
    const t = setupTrap({ childCount: 3 });
    t.setOpen(true);
    const buttons = Array.from(t.container.querySelectorAll('button'));
    const first = buttons[0]!;
    const last = buttons[buttons.length - 1]!;
    last.focus();
    expect(document.activeElement).toBe(last);

    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    t.container.dispatchEvent(ev);

    expect(document.activeElement).toBe(first);
    t.cleanup();
  });

  it('wraps Shift+Tab from the first focusable to the last', () => {
    const t = setupTrap({ childCount: 3 });
    t.setOpen(true);
    const buttons = Array.from(t.container.querySelectorAll('button'));
    const first = buttons[0]!;
    const last = buttons[buttons.length - 1]!;
    first.focus();
    expect(document.activeElement).toBe(first);

    const ev = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    t.container.dispatchEvent(ev);

    expect(document.activeElement).toBe(last);
    t.cleanup();
  });

  it('does not intercept Tab when focus is between first and last (lets the browser handle it)', () => {
    const t = setupTrap({ childCount: 3 });
    t.setOpen(true);
    const buttons = Array.from(t.container.querySelectorAll('button'));
    const middle = buttons[1]!;
    middle.focus();

    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    t.container.dispatchEvent(ev);

    // Focus stays on middle because the trap only wraps at the edges.
    expect(document.activeElement).toBe(middle);
    t.cleanup();
  });

  it('preventDefaults Tab and keeps focus inside when there are no focusables but the container has tabindex', () => {
    const t = setupTrap({ childCount: 0, containerTabIndex: -1 });
    t.setOpen(true);
    expect(document.activeElement).toBe(t.container);

    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    const wasPrevented = !t.container.dispatchEvent(ev);
    // Either the listener prevented default OR the event was simply not stopped —
    // jsdom's dispatchEvent returns `false` when default was prevented.
    expect(wasPrevented).toBe(true);
    t.cleanup();
  });

  it('ignores non-Tab keys', () => {
    const t = setupTrap({ childCount: 2 });
    t.setOpen(true);
    const buttons = Array.from(t.container.querySelectorAll('button'));
    const last = buttons[buttons.length - 1]!;
    last.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    t.container.dispatchEvent(ev);
    // Nothing changed.
    expect(document.activeElement).toBe(last);
    t.cleanup();
  });

  it('restores focus to the previously-focused element on close', () => {
    const t = setupTrap({ childCount: 2 });
    expect(document.activeElement).toBe(t.outside);
    t.setOpen(true);
    expect(document.activeElement).not.toBe(t.outside);
    // Toggle open back to false; the effect re-runs and the prior cleanup
    // fires, which restores focus to whatever was active before open.
    t.setOpen(false);
    expect(document.activeElement).toBe(t.outside);
    t.cleanup();
  });

  it('does not restore focus to a previously-focused element that is no longer in the document', () => {
    const t = setupTrap({ childCount: 2 });
    // Replace the previously-focused element while the trap is open.
    t.setOpen(true);
    t.outside.remove();
    // Cleanup must not crash — the document.contains() guard is what makes this safe.
    expect(() => t.cleanup()).not.toThrow();
  });

  it('handles a null document.activeElement gracefully on open', () => {
    // Force a null activeElement by snapshotting via Object.defineProperty.
    const original = Object.getOwnPropertyDescriptor(Document.prototype, 'activeElement');
    Object.defineProperty(document, 'activeElement', { configurable: true, get: () => null });

    const container = document.createElement('div');
    container.tabIndex = -1;
    document.body.appendChild(container);

    const [open, setOpen] = createSignal(false);
    const dispose = createRoot((d) => {
      useFocusTrap(open, () => container);
      return d;
    });

    expect(() => setOpen(true)).not.toThrow();

    // Restore activeElement so cleanup doesn't trip.
    if (original) Object.defineProperty(Document.prototype, 'activeElement', original);
    dispose();
    container.remove();
  });
});
