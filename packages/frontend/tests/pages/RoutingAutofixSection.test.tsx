import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@solidjs/testing-library';

const mockGetAutofix = vi.fn();
const mockUpdateAutofix = vi.fn();
vi.mock('../../src/services/api.js', () => ({
  getAutofix: (...args: unknown[]) => mockGetAutofix(...args),
  updateAutofix: (...args: unknown[]) => mockUpdateAutofix(...args),
}));

const mockToastError = vi.fn();
vi.mock('../../src/services/toast-store.js', () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args) },
}));

import RoutingAutofixSection from '../../src/pages/RoutingAutofixSection';

/** Wait for the initial `getAutofix` resource to settle so the switch's
 *  `disabled={... || config.loading}` binding flips to enabled. */
async function waitForLoaded(container: HTMLElement): Promise<HTMLButtonElement> {
  return await waitFor(() => {
    const btn = container.querySelector('.routing-switch') as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    expect(btn!.hasAttribute('disabled')).toBe(false);
    return btn!;
  });
}

describe('RoutingAutofixSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  it('renders the Auto-fix title and switch, hiding the budget input when disabled', async () => {
    mockGetAutofix.mockResolvedValue({ enabled: false, maxAttempts: 3 });
    const { container } = render(() => <RoutingAutofixSection agentName={() => 'demo'} />);

    expect(container.textContent).toContain('Auto-fix');
    await waitForLoaded(container);

    // getAutofix is fetched against the current agent name.
    expect(mockGetAutofix).toHaveBeenCalledWith('demo', expect.anything());
    // Disabled config → no budget number input.
    expect(container.querySelector('input[type=number]')).toBeNull();
  });

  it('toggles Auto-fix on and reveals the budget input after the update resolves', async () => {
    mockGetAutofix.mockResolvedValue({ enabled: false, maxAttempts: 3 });
    mockUpdateAutofix.mockResolvedValue({ enabled: true, maxAttempts: 3 });
    const { container } = render(() => <RoutingAutofixSection agentName={() => 'demo'} />);

    const btn = await waitForLoaded(container);
    fireEvent.click(btn);

    expect(mockUpdateAutofix).toHaveBeenCalledWith('demo', { enabled: true });
    await waitFor(() => {
      const input = container.querySelector('input[type=number]') as HTMLInputElement | null;
      expect(input).not.toBeNull();
      expect(input!.value).toBe('3');
    });
  });

  it('persists a valid in-range budget change', async () => {
    mockGetAutofix.mockResolvedValue({ enabled: true, maxAttempts: 3 });
    mockUpdateAutofix.mockResolvedValue({ enabled: true, maxAttempts: 5 });
    const { container } = render(() => <RoutingAutofixSection agentName={() => 'demo'} />);

    await waitForLoaded(container);
    const input = await waitFor(() => {
      const el = container.querySelector('input[type=number]') as HTMLInputElement | null;
      expect(el).not.toBeNull();
      return el!;
    });

    fireEvent.change(input, { target: { value: '5' } });
    expect(mockUpdateAutofix).toHaveBeenCalledWith('demo', { maxAttempts: 5 });
  });

  it('ignores an out-of-range budget value (too high)', async () => {
    mockGetAutofix.mockResolvedValue({ enabled: true, maxAttempts: 3 });
    const { container } = render(() => <RoutingAutofixSection agentName={() => 'demo'} />);

    await waitForLoaded(container);
    const input = await waitFor(() => {
      const el = container.querySelector('input[type=number]') as HTMLInputElement | null;
      expect(el).not.toBeNull();
      return el!;
    });

    fireEvent.change(input, { target: { value: '11' } });
    expect(mockUpdateAutofix).not.toHaveBeenCalled();
  });

  it('ignores an out-of-range budget value (below minimum)', async () => {
    mockGetAutofix.mockResolvedValue({ enabled: true, maxAttempts: 3 });
    const { container } = render(() => <RoutingAutofixSection agentName={() => 'demo'} />);

    await waitForLoaded(container);
    const input = await waitFor(() => {
      const el = container.querySelector('input[type=number]') as HTMLInputElement | null;
      expect(el).not.toBeNull();
      return el!;
    });

    fireEvent.change(input, { target: { value: '0' } });
    expect(mockUpdateAutofix).not.toHaveBeenCalled();
  });

  it('ignores a budget change that equals the current value (no-op)', async () => {
    mockGetAutofix.mockResolvedValue({ enabled: true, maxAttempts: 3 });
    const { container } = render(() => <RoutingAutofixSection agentName={() => 'demo'} />);

    await waitForLoaded(container);
    const input = await waitFor(() => {
      const el = container.querySelector('input[type=number]') as HTMLInputElement | null;
      expect(el).not.toBeNull();
      return el!;
    });

    // Current maxAttempts is 3 — re-entering it is a no-op and must not save.
    fireEvent.change(input, { target: { value: '3' } });
    expect(mockUpdateAutofix).not.toHaveBeenCalled();
  });

  it('falls back to a default budget of 3 when maxAttempts is absent', async () => {
    // enabled with no explicit maxAttempts → the `?? 3` fallback drives the
    // input's initial value.
    mockGetAutofix.mockResolvedValue({ enabled: true });
    const { container } = render(() => <RoutingAutofixSection agentName={() => 'demo'} />);

    await waitForLoaded(container);
    const input = await waitFor(() => {
      const el = container.querySelector('input[type=number]') as HTMLInputElement | null;
      expect(el).not.toBeNull();
      return el!;
    });
    expect(input.value).toBe('3');
  });

  it('surfaces a toast when the update fails', async () => {
    mockGetAutofix.mockResolvedValue({ enabled: false, maxAttempts: 3 });
    mockUpdateAutofix.mockRejectedValue(new Error('boom'));
    const { container } = render(() => <RoutingAutofixSection agentName={() => 'demo'} />);

    const btn = await waitForLoaded(container);
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to update Auto-fix');
    });
  });
});
