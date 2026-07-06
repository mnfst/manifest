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

import SettingsAutofixSection from '../../src/pages/SettingsAutofixSection';

/** Wait for the initial `getAutofix` resource to settle so the switch's
 *  `disabled={... || config.loading}` binding flips to enabled. */
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
    mockGetAutofix.mockResolvedValue({ enabled: false });
    const { container } = render(() => <SettingsAutofixSection agentName={() => 'demo'} />);

    expect(container.textContent).toContain('Auto-fix');
    const btn = await waitForLoaded(container);

    // Exposed as an accessible switch, fetched against the current agent name.
    expect(btn.getAttribute('role')).toBe('switch');
    expect(mockGetAutofix).toHaveBeenCalledWith('demo', expect.anything());
    // Disabled config → the switch is not in its "on" state.
    expect(btn.classList.contains('settings-switch--on')).toBe(false);
    expect(btn.getAttribute('aria-checked')).toBe('false');
  });

  it('shows the switch in its on state when Auto-fix is enabled', async () => {
    mockGetAutofix.mockResolvedValue({ enabled: true });
    const { container } = render(() => <SettingsAutofixSection agentName={() => 'demo'} />);

    const btn = await waitForLoaded(container);
    expect(btn.classList.contains('settings-switch--on')).toBe(true);
    expect(btn.getAttribute('aria-checked')).toBe('true');
  });

  it('disables the switch while the config is still loading', () => {
    // Never-resolving fetch keeps `config.loading` true.
    mockGetAutofix.mockReturnValue(new Promise(() => {}));
    const { container } = render(() => <SettingsAutofixSection agentName={() => 'demo'} />);

    const btn = container.querySelector('.settings-switch') as HTMLButtonElement;
    expect(btn.hasAttribute('disabled')).toBe(true);
    // Config unresolved → `config()?.enabled ?? false` falls back to off.
    expect(btn.classList.contains('settings-switch--on')).toBe(false);
  });

  it('toggles Auto-fix on when currently disabled', async () => {
    mockGetAutofix.mockResolvedValue({ enabled: false });
    mockUpdateAutofix.mockResolvedValue({ enabled: true });
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
    mockGetAutofix.mockResolvedValue({ enabled: true });
    mockUpdateAutofix.mockResolvedValue({ enabled: false });
    const { container } = render(() => <SettingsAutofixSection agentName={() => 'demo'} />);

    const btn = await waitForLoaded(container);
    fireEvent.click(btn);

    expect(mockUpdateAutofix).toHaveBeenCalledWith('demo', { enabled: false });
    await waitFor(() => {
      expect(btn.classList.contains('settings-switch--on')).toBe(false);
    });
  });

  it('ignores clicks while a save is already in flight', async () => {
    mockGetAutofix.mockResolvedValue({ enabled: false });
    // Keep the first update pending so `busy()` stays true for the second click.
    mockUpdateAutofix.mockReturnValue(new Promise(() => {}));
    const { container } = render(() => <SettingsAutofixSection agentName={() => 'demo'} />);

    const btn = await waitForLoaded(container);
    fireEvent.click(btn);
    fireEvent.click(btn);

    expect(mockUpdateAutofix).toHaveBeenCalledTimes(1);
  });

  it('surfaces a toast when the update fails', async () => {
    mockGetAutofix.mockResolvedValue({ enabled: false });
    mockUpdateAutofix.mockRejectedValue(new Error('boom'));
    const { container } = render(() => <SettingsAutofixSection agentName={() => 'demo'} />);

    const btn = await waitForLoaded(container);
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to update Auto-fix');
    });
  });
});
