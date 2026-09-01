import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

const mockGetAccess = vi.fn();
vi.mock('../../src/services/api/teams.js', () => ({
  getAgentModelAccess: (...args: unknown[]) => mockGetAccess(...args),
}));

vi.mock('../../src/components/ProviderIcon.jsx', () => ({
  providerIcon: (id: string) => (id === 'anthropic' ? <svg data-testid="provider-icon" /> : null),
}));

vi.mock('../../src/components/ModelAccessModal.jsx', () => ({
  default: (props: any) => (
    <div
      data-testid="model-access-modal"
      data-open={String(props.open)}
      data-agent={props.agentName}
      data-provider={props.access.user_provider_id}
      data-targets={props.applyTargets.length}
    >
      <button
        onClick={() =>
          props.onSaved({ ...props.access, all_models: false, enabled_count: 3, total_count: 18 })
        }
      >
        save-modal
      </button>
      <button onClick={() => props.onClose()}>close-modal</button>
    </div>
  ),
}));

const [mockOverview, setMockOverview] = createSignal<any>(undefined);
const [mockOverviewError, setMockOverviewError] = createSignal<unknown>(undefined);
const mockRefetchOverview = vi.fn();
const overviewResource = Object.defineProperties(() => mockOverview(), {
  error: { get: () => mockOverviewError() },
  loading: { get: () => false },
});
vi.mock('../../src/pages/UserDetail.jsx', () => ({
  useUserDetail: () => ({
    userId: () => 'u-maya',
    user: () => ({ id: 'u-maya', name: 'Maya Okonkwo' }),
    overview: overviewResource,
    refetchUser: vi.fn(),
    refetchOverview: mockRefetchOverview,
  }),
}));

import UserModelAccess, { modelsLabel, providerLabel } from '../../src/pages/UserModelAccess';

const agents = [
  {
    agent_name: 'claude-code',
    display_name: 'claude-code',
    agent_platform: 'claude-code',
    agent_category: 'coding',
    owner: null,
    projects: [],
    models_enabled: 12,
    models_total: 40,
    spend_30d_usd: 0,
    request_count: 0,
    last_used_at: null,
    archived_at: null,
  },
  {
    agent_name: 'bot',
    display_name: 'Bot',
    agent_platform: null,
    agent_category: null,
    owner: null,
    projects: [],
    models_enabled: 40,
    models_total: 40,
    spend_30d_usd: 0,
    request_count: 0,
    last_used_at: null,
    archived_at: null,
  },
];

const anthropic = {
  user_provider_id: 'conn-1',
  provider: 'anthropic',
  auth_type: 'subscription',
  label: 'Default',
  provider_enabled: true,
  all_models: true,
  models: [],
  enabled_count: 18,
  total_count: 18,
};
const custom = {
  ...anthropic,
  user_provider_id: 'conn-2',
  provider: 'custom:abc',
  auth_type: 'weird',
  all_models: false,
  enabled_count: 6,
  total_count: 14,
};

describe('UserModelAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockOverview(undefined);
    setMockOverviewError(undefined);
    mockGetAccess.mockImplementation(async (name: string) =>
      name === 'claude-code' ? [anthropic, custom] : [],
    );
  });

  it('renders nothing but the intro until the overview loads', () => {
    const { container } = render(() => <UserModelAccess />);
    expect(container.textContent).toContain("Maya Okonkwo's agents");
    expect(container.querySelector('.panel')).toBeNull();
  });

  it('shows the empty state for a user without agents', () => {
    setMockOverview({ agents: [] });
    const { container } = render(() => <UserModelAccess />);
    expect(container.textContent).toContain('Maya Okonkwo has no agents yet.');
    expect(mockGetAccess).not.toHaveBeenCalled();
  });

  it('shows a skeleton while fetching', () => {
    mockGetAccess.mockReturnValue(new Promise(() => {}));
    setMockOverview({ agents });
    const { container } = render(() => <UserModelAccess />);
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });

  it('shows the error state and retries', async () => {
    mockGetAccess.mockRejectedValueOnce(new Error('boom'));
    setMockOverview({ agents });
    const { container, getByText } = render(() => <UserModelAccess />);
    await vi.waitFor(() => expect(container.textContent).toContain('boom'));
    fireEvent.click(getByText('Try again'));
    await vi.waitFor(() => expect(container.textContent).toContain('Anthropic'));
  });

  it('shows an empty state when no agent has a provider connection', async () => {
    mockGetAccess.mockResolvedValue([]);
    setMockOverview({ agents });
    const { container } = render(() => <UserModelAccess />);
    await vi.waitFor(() => expect(container.textContent).toContain('No provider connections yet'));
  });

  it('lists one row per agent and provider and opens the editor', async () => {
    setMockOverview({ agents });
    const { container, getByTestId, getAllByText, getByText } = render(() => <UserModelAccess />);
    await vi.waitFor(() => expect(container.textContent).toContain('Anthropic'));
    expect(container.textContent).toContain('Subscription · Default');
    expect(container.textContent).toContain('weird · Default');
    expect(container.textContent).toContain('All 18');
    expect(container.textContent).toContain('6 of 14');
    expect(container.textContent).toContain('custom:abc');
    expect(container.querySelectorAll('[data-testid="provider-icon"]').length).toBe(1);
    expect(container.querySelector('img.who__icon')).toBeTruthy();

    fireEvent.click(getAllByText('Models', { selector: 'button' })[0]!);
    const modal = getByTestId('model-access-modal');
    expect(modal.getAttribute('data-open')).toBe('true');
    expect(modal.getAttribute('data-agent')).toBe('claude-code');
    expect(modal.getAttribute('data-provider')).toBe('conn-1');
    expect(modal.getAttribute('data-targets')).toBe('2');
    const callsBefore = mockGetAccess.mock.calls.length;
    fireEvent.click(getByText('save-modal'));
    await vi.waitFor(() => expect(container.textContent).toContain('3 of 18'));
    fireEvent.click(getByText('close-modal'));
    expect(container.querySelector('[data-testid="model-access-modal"]')).toBeNull();
    // A save (or an apply, which saves first) may have changed other agents: refetch.
    await vi.waitFor(() => expect(mockGetAccess.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('exposes label helpers', () => {
    expect(providerLabel('anthropic')).toBe('Anthropic');
    expect(providerLabel('custom:x')).toBe('custom:x');
    expect(modelsLabel(anthropic)).toBe('All 18');
    expect(modelsLabel(custom)).toBe('6 of 14');
  });
});

describe('UserModelAccess — failures and refetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockOverview(undefined);
    setMockOverviewError(undefined);
    mockGetAccess.mockImplementation(async (name: string) =>
      name === 'claude-code' ? [anthropic, custom] : [],
    );
  });

  it('shows an error state with retry when the overview failed', () => {
    setMockOverviewError(new Error('boom'));
    const { container, getByText } = render(() => <UserModelAccess />);
    expect(container.textContent).toContain("Couldn't load their agents");
    expect(mockGetAccess).not.toHaveBeenCalled();
    fireEvent.click(getByText('Try again'));
    expect(mockRefetchOverview).toHaveBeenCalled();
  });

  it('does not refetch the rows when the modal closes without a save', async () => {
    setMockOverview({ agents });
    const { container, getAllByText, getByText } = render(() => <UserModelAccess />);
    await vi.waitFor(() => expect(container.textContent).toContain('Anthropic'));
    const callsBefore = mockGetAccess.mock.calls.length;
    fireEvent.click(getAllByText('Models', { selector: 'button' })[0]!);
    fireEvent.click(getByText('close-modal'));
    await Promise.resolve();
    expect(mockGetAccess.mock.calls.length).toBe(callsBefore);
  });
});
