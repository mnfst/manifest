import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let cohortEligible = false;
const mockGetStatus = vi.fn();
const mockGetAgents = vi.fn();

vi.mock('@solidjs/router', () => ({
  A: (props: any) => (
    <a href={props.href} class={props.class} classList={props.classList} onClick={props.onClick}>
      {props.children}
    </a>
  ),
}));

vi.mock('../../src/services/api/autofix.js', () => ({
  getAutofixCohort: () => Promise.resolve({ eligible: cohortEligible }),
}));

vi.mock('../../src/services/api/analytics.js', () => ({
  HEALED_REQUESTS_TOOLTIP: 'Successful requests that were healed by Auto-fix or fallback.',
  TOTAL_ATTEMPTS_TOOLTIP: 'Every provider call counts here, including fallback attempts and auto-fix retries. One request can produce several attempts.',
  ATTEMPT_SUCCESS_RATE_TOOLTIP: 'Successful attempts over all attempts, on the filtered period.',
  attemptSuccessRate: (row: { attempts: number; succeeded?: number }) =>
    !row.attempts || row.succeeded == null ? null : row.succeeded / row.attempts,
  getWorkspaceAutofixStatus: (...args: unknown[]) => mockGetStatus(...args),
}));

vi.mock('../../src/services/api.js', () => ({
  getAgents: (...args: unknown[]) => mockGetAgents(...args),
}));

vi.mock('../../src/services/sse.js', () => ({
  messagePing: () => 0,
  agentPing: () => 0,
  routingPing: () => 0,
}));

import NotificationBell from '../../src/components/NotificationBell';

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.clear();
    cohortEligible = false;
    mockGetStatus.mockResolvedValue({
      available: true,
      any_enabled: false,
      enabled_agents: [],
    });
    mockGetAgents.mockResolvedValue({
      agents: [{ agent_name: 'demo', display_name: 'Demo agent' }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not load workspace Auto-fix status outside the cohort', async () => {
    render(() => <NotificationBell />);
    await waitFor(() => expect(mockGetAgents).toHaveBeenCalled());
    expect(screen.queryByLabelText('Notifications')).toBeNull();
    expect(mockGetStatus).not.toHaveBeenCalled();
  });

  it('shows disabled cohort agents, marks them read, and closes outside', async () => {
    cohortEligible = true;
    render(() => <NotificationBell />);

    await waitFor(() => expect(screen.getByLabelText('Notifications')).toBeDefined());
    fireEvent.click(screen.getByLabelText('Notifications'));
    const link = screen.getByText(/Auto-fix is inactive on/).closest('a')!;
    expect(link.getAttribute('href')).toBe('/harnesses/demo/settings?highlight=autofix');
    fireEvent.click(link);
    expect(localStorage.getItem('manifest_notif_read')).toContain('demo');
    expect(screen.queryByText(/Auto-fix is inactive on/)).toBeNull();

    fireEvent.click(screen.getByLabelText('Notifications'));
    expect(screen.getByText(/Auto-fix is inactive on/)).toBeDefined();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText(/Auto-fix is inactive on/)).toBeNull();
  });

  it('clears read state after an agent is enabled and accepts array agent responses', async () => {
    cohortEligible = true;
    localStorage.setItem('manifest_notif_read', JSON.stringify(['demo']));
    mockGetAgents.mockResolvedValue([{ agent_name: 'demo', display_name: '' }]);
    mockGetStatus
      .mockResolvedValueOnce({ available: true, any_enabled: false, enabled_agents: [] })
      .mockResolvedValue({ available: true, any_enabled: true, enabled_agents: ['demo'] });
    render(() => <NotificationBell />);

    await waitFor(() => expect(screen.getByLabelText('Notifications')).toBeDefined());
    await vi.advanceTimersByTimeAsync(15_000);
    await waitFor(() => expect(screen.queryByLabelText('Notifications')).toBeNull());
    expect(localStorage.getItem('manifest_notif_read')).toBe('[]');
  });

  it('hides itself when loading agents fails', async () => {
    cohortEligible = true;
    mockGetAgents.mockRejectedValue(new Error('offline'));
    render(() => <NotificationBell />);
    await waitFor(() => expect(mockGetAgents).toHaveBeenCalled());
    expect(screen.queryByLabelText('Notifications')).toBeNull();
  });

  it('recovers from unread-state storage failures', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(() => <NotificationBell />);
    await waitFor(() => expect(mockGetAgents).toHaveBeenCalled());
    expect(screen.queryByLabelText('Notifications')).toBeNull();
    getItem.mockRestore();
  });

  it('keeps working when marking a notification read cannot persist', async () => {
    cohortEligible = true;
    render(() => <NotificationBell />);
    await waitFor(() => expect(screen.getByLabelText('Notifications')).toBeDefined());
    fireEvent.click(screen.getByLabelText('Notifications'));
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    fireEvent.click(screen.getByText(/Auto-fix is inactive on/).closest('a')!);
    expect(screen.queryByText(/Auto-fix is inactive on/)).toBeNull();
    setItem.mockRestore();
  });

  it('keeps working when clearing enabled-agent read state cannot persist', async () => {
    cohortEligible = true;
    localStorage.setItem('manifest_notif_read', JSON.stringify(['demo']));
    mockGetStatus
      .mockResolvedValueOnce({ available: true, any_enabled: false, enabled_agents: [] })
      .mockResolvedValue({ available: true, any_enabled: true, enabled_agents: ['demo'] });
    render(() => <NotificationBell />);
    await waitFor(() => expect(screen.getByLabelText('Notifications')).toBeDefined());
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await vi.advanceTimersByTimeAsync(15_000);
    await waitFor(() => expect(screen.queryByLabelText('Notifications')).toBeNull());
    setItem.mockRestore();
  });
});
