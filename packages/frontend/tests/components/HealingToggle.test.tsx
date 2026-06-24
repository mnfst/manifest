import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';

const mockGet = vi.fn();
const mockEnable = vi.fn();
const mockDisable = vi.fn();
const mockToastError = vi.fn();

vi.mock('../../src/services/api/routing.js', () => ({
  getHealingStatus: (...a: unknown[]) => mockGet(...a),
  enableHealing: (...a: unknown[]) => mockEnable(...a),
  disableHealing: (...a: unknown[]) => mockDisable(...a),
}));
vi.mock('../../src/services/toast-store.js', () => ({
  toast: { error: (...a: unknown[]) => mockToastError(...a) },
}));

import HealingToggle from '../../src/components/HealingToggle';

describe('HealingToggle', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockEnable.mockReset().mockResolvedValue({ ok: true });
    mockDisable.mockReset().mockResolvedValue({ ok: true });
    mockToastError.mockReset();
  });

  it('shows Disabled and enables on click', async () => {
    mockGet.mockResolvedValue({ enabled: false });
    render(() => <HealingToggle agentName={() => 'my-agent'} />);
    const btn = await screen.findByRole('switch');
    expect(btn.textContent).toContain('Disabled');

    await fireEvent.click(btn);

    await waitFor(() => expect(mockEnable).toHaveBeenCalledWith('my-agent'));
    await waitFor(() => expect(screen.getByRole('switch').textContent).toContain('Enabled'));
  });

  it('shows Enabled and disables on click', async () => {
    mockGet.mockResolvedValue({ enabled: true });
    render(() => <HealingToggle agentName={() => 'my-agent'} />);
    const btn = await screen.findByRole('switch');
    await waitFor(() => expect(btn.getAttribute('aria-checked')).toBe('true'));

    await fireEvent.click(btn);

    await waitFor(() => expect(mockDisable).toHaveBeenCalledWith('my-agent'));
  });

  it('toasts when the update fails', async () => {
    mockGet.mockResolvedValue({ enabled: false });
    mockEnable.mockRejectedValue(new Error('boom'));
    render(() => <HealingToggle agentName={() => 'my-agent'} />);
    const btn = await screen.findByRole('switch');

    await fireEvent.click(btn);

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
  });
});
