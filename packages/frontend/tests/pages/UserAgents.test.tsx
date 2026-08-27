import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

vi.mock('@solidjs/router', () => ({
  A: (props: any) => (
    <a href={props.href} class={props.class} data-state={JSON.stringify(props.state ?? null)}>
      {props.children}
    </a>
  ),
}));

vi.mock('../../src/components/AddAgentModal.jsx', () => ({
  default: (props: any) => (
    <div
      data-testid="add-agent-modal"
      data-open={String(props.open)}
      data-owner={props.defaultOwnerId}
    >
      <button onClick={() => props.onClose()}>close-add</button>
    </div>
  ),
}));

const mockRemove = vi.fn();
vi.mock('../../src/services/api/teams.js', () => ({
  removeAgentFromUser: (...args: unknown[]) => mockRemove(...args),
}));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('../../src/services/toast-store.js', () => ({ toast: mockToast }));

const [mockOverview, setMockOverview] = createSignal<any>(undefined);
const mockRefetchOverview = vi.fn();
vi.mock('../../src/pages/UserDetail.jsx', () => ({
  useUserDetail: () => ({
    userId: () => 'u-maya',
    user: () => ({ id: 'u-maya', name: 'Maya Okonkwo' }),
    overview: mockOverview,
    refetchUser: vi.fn(),
    refetchOverview: mockRefetchOverview,
  }),
}));

import UserAgents from '../../src/pages/UserAgents';

const agents = [
  {
    agent_name: 'claude-code',
    display_name: 'claude-code',
    agent_platform: 'claude-code',
    agent_category: 'coding',
    owner: { id: 'u-maya', name: 'Maya Okonkwo' },
    projects: [{ id: 'p-atlas', name: 'Atlas' }],
    models_enabled: 12,
    models_total: 40,
    spend_30d_usd: 121.3,
    request_count: 12880,
    last_used_at: new Date(Date.now() - 120_000).toISOString(),
    archived_at: null,
  },
  {
    agent_name: 'bot',
    display_name: 'Bot',
    agent_platform: null,
    agent_category: null,
    owner: { id: 'u-maya', name: 'Maya Okonkwo' },
    projects: [],
    models_enabled: 40,
    models_total: 40,
    spend_30d_usd: 1,
    request_count: 2,
    last_used_at: null,
    archived_at: '2026-08-01T00:00:00Z',
  },
];

describe('UserAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockOverview(undefined);
    mockRemove.mockResolvedValue(undefined);
  });

  it('shows a loading line until the overview arrives', () => {
    const { container } = render(() => <UserAgents />);
    expect(container.textContent).toContain('Loading agents…');
  });

  it('shows the empty state with a New agent action that pre-fills the owner', () => {
    setMockOverview({ agents: [] });
    const { container, getByTestId, getByText } = render(() => <UserAgents />);
    expect(container.textContent).toContain('0 agents owned by Maya Okonkwo');
    expect(container.textContent).toContain('No agents yet');
    fireEvent.click(container.querySelector('.empty-state button')!);
    expect(getByTestId('add-agent-modal').getAttribute('data-open')).toBe('true');
    expect(getByTestId('add-agent-modal').getAttribute('data-owner')).toBe('u-maya');
    fireEvent.click(getByText('close-add'));
    expect(getByTestId('add-agent-modal').getAttribute('data-open')).toBe('false');
    expect(mockRefetchOverview).toHaveBeenCalled();
  });

  it('lists agents with type, projects, spend, last used and the archive badge', () => {
    setMockOverview({ agents });
    const { container } = render(() => <UserAgents />);
    expect(container.textContent).toContain('2 agents owned by');
    expect(container.textContent).toContain('Claude Code');
    expect(container.textContent).toContain('Other');
    expect(container.textContent).toContain('Atlas');
    expect(container.textContent).toContain('None');
    expect(container.textContent).toContain('$121.30');
    expect(container.textContent).toContain('2m ago');
    expect(container.textContent).toContain('Never');
    expect(container.textContent).toContain('Archived');
    expect(container.querySelector('img.who__icon')).toBeTruthy();
    const link = container.querySelector('a[href="/agents/claude-code"]')!;
    expect(JSON.parse(link.getAttribute('data-state')!).via[1]).toEqual({
      label: 'Maya Okonkwo',
      href: '/users/u-maya',
    });
  });

  it('pluralises a single agent', () => {
    setMockOverview({ agents: [agents[0]] });
    const { container } = render(() => <UserAgents />);
    expect(container.textContent).toContain('1 agent owned by');
  });

  it('removes an agent from the user after confirming', async () => {
    setMockOverview({ agents });
    const { container, getAllByText, getByText } = render(() => <UserAgents />);
    fireEvent.click(getAllByText('Remove from this user')[0]!);
    expect(container.textContent).toContain('Remove claude-code from Maya Okonkwo?');
    expect(container.textContent).toContain('will keep running with no owner');
    fireEvent.click(getByText('Remove from this user', { selector: '.modal-card button' }));
    await vi.waitFor(() => expect(mockRemove).toHaveBeenCalledWith('u-maya', 'claude-code'));
    await vi.waitFor(() => expect(container.querySelector('.modal-card')).toBeNull());
    expect(mockToast.success).toHaveBeenCalledWith('claude-code no longer has an owner');
    expect(mockRefetchOverview).toHaveBeenCalled();
  });

  it('reports a failed removal and keeps the dialog open', async () => {
    mockRemove.mockRejectedValue(new Error('nope'));
    setMockOverview({ agents });
    const { container, getAllByText, getByText } = render(() => <UserAgents />);
    fireEvent.click(getAllByText('Remove from this user')[0]!);
    fireEvent.click(getByText('Remove from this user', { selector: '.modal-card button' }));
    await vi.waitFor(() => expect(mockToast.error).toHaveBeenCalled());
    expect(container.querySelector('.modal-card')).toBeTruthy();
  });

  it('cancels the removal on Cancel, Escape, overlay click and not on inner clicks', () => {
    setMockOverview({ agents });
    const { container, getAllByText, getByText } = render(() => <UserAgents />);
    const open = () => fireEvent.click(getAllByText('Remove from this user')[0]!);
    open();
    fireEvent.click(getByText('Cancel'));
    expect(container.querySelector('.modal-card')).toBeNull();
    open();
    fireEvent.keyDown(container.querySelector('.modal-overlay')!, { key: 'Escape' });
    expect(container.querySelector('.modal-card')).toBeNull();
    open();
    fireEvent.keyDown(container.querySelector('.modal-overlay')!, { key: 'x' });
    fireEvent.click(container.querySelector('.modal-card')!);
    expect(container.querySelector('.modal-card')).toBeTruthy();
    fireEvent.click(container.querySelector('.modal-overlay')!);
    expect(container.querySelector('.modal-card')).toBeNull();
  });

  it('opens the New agent modal from the toolbar', () => {
    setMockOverview({ agents });
    const { getByTestId, getByText } = render(() => <UserAgents />);
    fireEvent.click(getByText('New agent'));
    expect(getByTestId('add-agent-modal').getAttribute('data-open')).toBe('true');
  });
});
