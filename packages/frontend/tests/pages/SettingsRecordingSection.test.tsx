import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getRecording = vi.fn();
const updateRecording = vi.fn();
const toastSuccess = vi.fn();
vi.mock('../../src/services/api.js', () => ({
  getRecording: (...args: unknown[]) => getRecording(...args),
  updateRecording: (...args: unknown[]) => updateRecording(...args),
}));
vi.mock('../../src/services/toast-store.js', () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args) },
}));

import SettingsRecordingSection from '../../src/pages/SettingsRecordingSection';

describe('SettingsRecordingSection', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('renders the disabled state returned for an existing agent', async () => {
    getRecording.mockResolvedValue({ enabled: false });
    const { getByRole, getByText } = render(() => (
      <SettingsRecordingSection agentName={() => 'demo'} />
    ));
    const toggle = getByRole('switch');

    await waitFor(() => expect(toggle.hasAttribute('disabled')).toBe(false));
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(getByText('Observe request messages in the Requests drawer.')).toBeTruthy();
    expect(getRecording).toHaveBeenCalledWith('demo', expect.anything());
  });

  it('enables recording for the current agent', async () => {
    getRecording.mockResolvedValue({ enabled: false });
    updateRecording.mockResolvedValue({ enabled: true });
    const { getByRole } = render(() => <SettingsRecordingSection agentName={() => 'demo'} />);
    const toggle = getByRole('switch');

    await waitFor(() => expect(toggle.hasAttribute('disabled')).toBe(false));
    fireEvent.click(toggle);

    expect(updateRecording).toHaveBeenCalledWith('demo', { enabled: true });
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
    expect(toastSuccess).toHaveBeenCalledWith('Message recording enabled');
  });

  it('disables recording for the current agent', async () => {
    getRecording.mockResolvedValue({ enabled: true });
    updateRecording.mockResolvedValue({ enabled: false });
    const { getByRole } = render(() => <SettingsRecordingSection agentName={() => 'demo'} />);
    const toggle = getByRole('switch');

    await waitFor(() => expect(toggle.hasAttribute('disabled')).toBe(false));
    fireEvent.click(toggle);

    expect(updateRecording).toHaveBeenCalledWith('demo', { enabled: false });
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('false'));
    expect(toastSuccess).toHaveBeenCalledWith('Message recording disabled');
  });

  it('restores the toggle after an update fails', async () => {
    getRecording.mockResolvedValue({ enabled: false });
    updateRecording.mockRejectedValue(new Error('save failed'));
    const { getByRole } = render(() => <SettingsRecordingSection agentName={() => 'demo'} />);
    const toggle = getByRole('switch');

    await waitFor(() => expect(toggle.hasAttribute('disabled')).toBe(false));
    fireEvent.click(toggle);

    expect(updateRecording).toHaveBeenCalledWith('demo', { enabled: true });
    await waitFor(() => expect(toggle.hasAttribute('disabled')).toBe(false));
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
