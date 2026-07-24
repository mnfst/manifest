import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getRecording = vi.fn();
const updateRecording = vi.fn();
vi.mock('../../src/services/api.js', () => ({
  getRecording: (...args: unknown[]) => getRecording(...args),
  updateRecording: (...args: unknown[]) => updateRecording(...args),
}));

import SettingsRecordingSection from '../../src/pages/SettingsRecordingSection';

describe('SettingsRecordingSection', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('renders opt-in recording off by default', async () => {
    getRecording.mockResolvedValue({ enabled: false });
    const { getByRole } = render(() => <SettingsRecordingSection agentName={() => 'demo'} />);
    const toggle = getByRole('switch');

    await waitFor(() => expect(toggle.hasAttribute('disabled')).toBe(false));
    expect(toggle.getAttribute('aria-checked')).toBe('false');
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
  });
});
