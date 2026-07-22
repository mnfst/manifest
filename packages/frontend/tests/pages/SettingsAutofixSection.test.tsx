import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

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

vi.mock('@solidjs/router', () => ({
  useSearchParams: () => [{}],
}));

import SettingsAutofixSection from '../../src/pages/SettingsAutofixSection';

/** Wait for the initial `getAutofix` resource to settle so the switch's
 *  `disabled={... || config.loading}` binding flips to enabled. Only reachable
 *  when the fetched config has `available: true` — otherwise the section is
 *  hidden entirely and there is no switch to find. */
async function waitForLoaded(container: HTMLElement): Promise<HTMLButtonElement> {
  return await waitFor(() => {
    const btn = container.querySelector('.settings-switch') as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    expect(btn!.hasAttribute('disabled')).toBe(false);
    return btn!;
  });
}

describe('SettingsAutofixSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  it('renders the Auto-fix title and switch', async () => {
    mockGetAutofix.mockResolvedValue({ enabled: false, available: true });
    const { container } = render(() => <SettingsAutofixSection agentName={() => 'demo'} />);

    // The whole section is gated behind `available()`, so nothing renders until
    // the config resolves with early access granted.
    const btn = await waitForLoaded(container);
    expect(container.textContent).toContain('Auto-fix');

    // Exposed as an accessible switch, fetched against the current agent name.
    expect(btn.getAttribute('role')).toBe('switch');
    expect(mockGetAutofix).toHaveBeenCalledWith('demo', expect.anything());
    // Disabled config → the switch is not in its "on" state.
    expect(btn.classList.contains('settings-switch--on')).toBe(false);
    expect(btn.getAttribute('aria-checked')).toBe('false');
  });

  it('shows the switch in its on state when Auto-fix is enabled', async () => {
    mockGetAutofix.mockResolvedValue({ enabled: true, available: true });
    const { container } = render(() => <SettingsAutofixSection agentName={() => 'demo'} />);

    const btn = await waitForLoaded(container);
    expect(btn.classList.contains('settings-switch--on')).toBe(true);
    expect(btn.getAttribute('aria-checked')).toBe('true');
  });

  it('defaults the switch to off when the fetched config omits enabled', async () => {
    // `available: true` reveals the section, but an absent `enabled` must fall
    // back to off via the `config()?.enabled ?? false` guard, not render "on".
    mockGetAutofix.mockResolvedValue({ available: true });
    const { container } = render(() => <SettingsAutofixSection agentName={() => 'demo'} />);

    const btn = await waitForLoaded(container);
    expect(btn.classList.contains('settings-switch--on')).toBe(false);
    expect(btn.getAttribute('aria-checked')).toBe('false');
  });

  it('renders nothing while the config is still loading', () => {
    // Never-resolving fetch keeps `config.loading` true, so `available()` stays
    // false (no resolved config yet) and the section never mounts.
    mockGetAutofix.mockReturnValue(new Promise(() => {}));
    const { container } = render(() => <SettingsAutofixSection agentName={() => 'demo'} />);

    expect(container.querySelector('.settings-switch')).toBeNull();
    expect(container.textContent).not.toContain('Auto-fix');
  });

  it('renders nothing when Auto-fix early access is not available', async () => {
    mockGetAutofix.mockResolvedValue({ enabled: false, available: false });
    const { container } = render(() => <SettingsAutofixSection agentName={() => 'demo'} />);

    // Config resolves, but `available: false` keeps the whole section hidden —
    // the "Get early access" card in the sidebar is the entry point instead.
    await waitFor(() => expect(mockGetAutofix).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 0));

    expect(container.querySelector('.settings-switch')).toBeNull();
    expect(container.querySelector('[role="switch"]')).toBeNull();
    expect(container.textContent).not.toContain('Auto-fix');
    expect(mockUpdateAutofix).not.toHaveBeenCalled();
  });

  it('toggles Auto-fix on when currently disabled', async () => {
    mockGetAutofix.mockResolvedValue({ enabled: false, available: true });
    mockUpdateAutofix.mockResolvedValue({ enabled: true, available: true });
    const { container } = render(() => <SettingsAutofixSection agentName={() => 'demo'} />);

    const btn = await waitForLoaded(container);
    fireEvent.click(btn);

    expect(mockUpdateAutofix).toHaveBeenCalledWith('demo', { enabled: true });
    // After the update resolves, the mutated config flips the switch on.
    await waitFor(() => {
      expect(btn.classList.contains('settings-switch--on')).toBe(true);
    });
  });

  it('toggles Auto-fix off when currently enabled', async () => {
    mockGetAutofix.mockResolvedValue({ enabled: true, available: true });
    mockUpdateAutofix.mockResolvedValue({ enabled: false, available: true });
    const { container } = render(() => <SettingsAutofixSection agentName={() => 'demo'} />);

    const btn = await waitForLoaded(container);
    fireEvent.click(btn);

    expect(mockUpdateAutofix).toHaveBeenCalledWith('demo', { enabled: false });
    await waitFor(() => {
      expect(btn.classList.contains('settings-switch--on')).toBe(false);
    });
  });

  it('ignores clicks while a save is already in flight', async () => {
    mockGetAutofix.mockResolvedValue({ enabled: false, available: true });
    // Keep the first update pending so `busy()` stays true for the second click.
    mockUpdateAutofix.mockReturnValue(new Promise(() => {}));
    const { container } = render(() => <SettingsAutofixSection agentName={() => 'demo'} />);

    const btn = await waitForLoaded(container);
    fireEvent.click(btn);
    fireEvent.click(btn);

    expect(mockUpdateAutofix).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when the initial read fails', async () => {
    mockGetAutofix.mockRejectedValue(new Error('read failed'));
    const { container } = render(() => <SettingsAutofixSection agentName={() => 'demo'} />);

    // A failed read makes `available()` short-circuit to false via its
    // `config.error` guard, so the heading and switch stay hidden entirely.
    await waitFor(() => expect(mockGetAutofix).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 0));

    expect(container.querySelector('.settings-switch')).toBeNull();
    expect(container.textContent).not.toContain('Auto-fix');
    // Nothing renders, so no write is ever attempted.
    expect(mockUpdateAutofix).not.toHaveBeenCalled();
  });

  it('hides the section when a later refetch fails', async () => {
    const [name, setName] = createSignal('a');
    mockGetAutofix.mockResolvedValueOnce({ enabled: true, available: true });
    mockGetAutofix.mockRejectedValueOnce(new Error('refetch failed'));
    const { container } = render(() => <SettingsAutofixSection agentName={name} />);

    // First load renders the switch in its on state.
    const btn = await waitForLoaded(container);
    expect(btn.classList.contains('settings-switch--on')).toBe(true);

    // Switching harness refetches for 'b', which rejects. `available()` flips to
    // false via its `config.error` guard and tears the section back down.
    setName('b');
    await waitFor(() => {
      expect(container.querySelector('.settings-switch')).toBeNull();
    });
    expect(container.textContent).not.toContain('Auto-fix');
  });

  it('shows the switch off (not the previous agent state) while a harness switch is loading', async () => {
    const [name, setName] = createSignal('a');
    mockGetAutofix.mockResolvedValueOnce({ enabled: true, available: true });
    // The second agent's read never resolves → config.loading stays true, but
    // Solid keeps the previous (available: true) value so the section stays
    // mounted. Without the loading gate the switch would show 'a's ON state.
    mockGetAutofix.mockReturnValueOnce(new Promise(() => {}));
    const { container } = render(() => <SettingsAutofixSection agentName={name} />);

    const btn = await waitForLoaded(container);
    expect(btn.classList.contains('settings-switch--on')).toBe(true);

    setName('b');
    await waitFor(() => {
      const el = container.querySelector('.settings-switch') as HTMLButtonElement;
      expect(el.hasAttribute('disabled')).toBe(true);
    });
    expect(btn.classList.contains('settings-switch--on')).toBe(false);
  });

  it('does not apply a stale save after the harness switches mid-request', async () => {
    const [name, setName] = createSignal('a');
    mockGetAutofix.mockResolvedValue({ enabled: false, available: true });
    let resolveUpdate: (v: { enabled: boolean; available: boolean }) => void = () => {};
    mockUpdateAutofix.mockReturnValue(
      new Promise<{ enabled: boolean; available: boolean }>((r) => {
        resolveUpdate = r;
      }),
    );
    const { container } = render(() => <SettingsAutofixSection agentName={name} />);

    const btn = await waitForLoaded(container);
    fireEvent.click(btn); // targets 'a'
    expect(mockUpdateAutofix).toHaveBeenCalledWith('a', { enabled: true });

    // Switch harness before the save resolves; the resource refetches for 'b'.
    setName('b');
    await waitFor(() => expect(mockGetAutofix).toHaveBeenCalledWith('b', expect.anything()));

    // Resolve the stale 'a' update as ON, then let the toggle chain settle (the
    // save's finally re-enables the switch). The guard must drop the stale
    // response so the current 'b' harness stays OFF.
    resolveUpdate({ enabled: true, available: true });
    await waitFor(() => {
      const el = container.querySelector('.settings-switch') as HTMLButtonElement;
      expect(el.hasAttribute('disabled')).toBe(false);
    });
    expect(btn.classList.contains('settings-switch--on')).toBe(false);
  });

  it('raises no toast of its own on update failure and re-enables the switch', async () => {
    mockGetAutofix.mockResolvedValue({ enabled: false, available: true });
    mockUpdateAutofix.mockRejectedValue(new Error('boom'));
    const { container } = render(() => <SettingsAutofixSection agentName={() => 'demo'} />);

    const btn = await waitForLoaded(container);
    fireEvent.click(btn);

    // The rejected save must not crash the component and must re-enable the switch
    // (spinner reset in `finally`). It raises no generic toast of its own — the
    // real `updateAutofix` (via `fetchMutate`) already surfaces the backend error,
    // so a second toast here would be a duplicate.
    await waitFor(() => {
      expect(btn.hasAttribute('disabled')).toBe(false);
    });
    expect(mockToastError).not.toHaveBeenCalled();
    expect(btn.classList.contains('settings-switch--on')).toBe(false);
  });
});
