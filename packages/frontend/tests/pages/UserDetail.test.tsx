import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

let mockUserId = 'u-maya';
let mockPathname = '/users/u-maya';
vi.mock('@solidjs/router', () => ({
  useParams: () => ({
    get userId() {
      return mockUserId;
    },
  }),
  useLocation: () => ({
    get pathname() {
      return mockPathname;
    },
  }),
  A: (props: any) => (
    <a
      href={props.href}
      class={[
        props.class,
        ...Object.entries(props.classList ?? {})
          .filter(([, on]) => on)
          .map(([name]) => name),
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {props.children}
    </a>
  ),
}));

vi.mock('@solidjs/meta', () => ({
  Title: (props: any) => <title>{props.children}</title>,
}));

const mockGetUser = vi.fn();
const mockGetUserOverview = vi.fn();
const mockUpdateUser = vi.fn();
vi.mock('../../src/services/api/teams.js', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  getUserOverview: (...args: unknown[]) => mockGetUserOverview(...args),
  updateUser: (...args: unknown[]) => mockUpdateUser(...args),
}));

const mockSetBreadcrumb = vi.fn();
const mockClearBreadcrumb = vi.fn();
vi.mock('../../src/services/breadcrumb-store.js', () => ({
  setBreadcrumb: (...args: unknown[]) => mockSetBreadcrumb(...args),
  clearBreadcrumb: (...args: unknown[]) => mockClearBreadcrumb(...args),
}));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('../../src/services/toast-store.js', () => ({ toast: mockToast }));

import UserDetail, { useUserDetail } from '../../src/pages/UserDetail';

const maya = {
  id: 'u-maya',
  name: 'Maya Okonkwo',
  email: 'maya@x.com',
  role: 'Engineering',
  archived_at: null,
  created_at: '2026-08-01T00:00:00Z',
};

const overview = {
  cost_30d_usd: 100,
  cost_trend_pct: 5,
  cost_365d_usd: 900,
  requests: 10,
  tokens: 100,
  cost_series: [],
  agents: [],
};

const Child = () => {
  const ctx = useUserDetail();
  return (
    <div data-testid="child">
      {ctx.userId()}|{ctx.user()?.name}|{String(ctx.overview()?.cost_30d_usd)}
      <button onClick={() => ctx.refetchUser()}>refetch-user</button>
      <button onClick={() => ctx.refetchOverview()}>refetch-overview</button>
    </div>
  );
};

describe('UserDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserId = 'u-maya';
    mockPathname = '/users/u-maya';
    mockGetUser.mockResolvedValue(maya);
    mockGetUserOverview.mockResolvedValue(overview);
    mockUpdateUser.mockResolvedValue(maya);
  });

  it('renders the header, breadcrumb, tabs and children through the context', async () => {
    const { container, getByTestId, unmount } = render(() => (
      <UserDetail>
        <Child />
      </UserDetail>
    ));
    await vi.waitFor(() => expect(container.textContent).toContain('Maya Okonkwo'));
    expect(mockSetBreadcrumb).toHaveBeenCalledWith([{ label: 'Users', href: '/users' }], {
      label: 'Maya Okonkwo',
    });
    expect(container.textContent).toContain('Engineering');
    expect(container.textContent).not.toMatch(/budget/i);
    await vi.waitFor(() =>
      expect(getByTestId('child').textContent).toContain('u-maya|Maya Okonkwo|100'),
    );
    const tabs = container.querySelectorAll('.panel__tab');
    expect(tabs.length).toBe(4);
    expect(tabs[0]!.classList.contains('panel__tab--active')).toBe(true);
    expect(tabs[1]!.getAttribute('href')).toBe('/users/u-maya/agents');
    fireEvent.click(container.querySelector('[data-testid="child"] button')!);
    await vi.waitFor(() => expect(mockGetUser).toHaveBeenCalledTimes(2));
    fireEvent.click(container.querySelectorAll('[data-testid="child"] button')[1]!);
    await vi.waitFor(() => expect(mockGetUserOverview).toHaveBeenCalledTimes(2));
    unmount();
    expect(mockClearBreadcrumb).toHaveBeenCalled();
  });

  it('marks the active tab from the pathname', async () => {
    mockPathname = '/users/u-maya/model-access';
    const { container } = render(() => <UserDetail />);
    await vi.waitFor(() => expect(container.textContent).toContain('Maya Okonkwo'));
    const active = container.querySelector('.panel__tab--active');
    expect(active!.textContent).toBe('Model access');
    mockPathname = '/users/u-maya/overview';
  });

  it('throws when the hook is used outside the shell', () => {
    expect(() => render(() => <Child />)).toThrow('useUserDetail must be used inside UserDetail');
  });

  it('shows "User not found" when the user is missing', async () => {
    mockGetUser.mockResolvedValue(null);
    const { container } = render(() => <UserDetail />);
    await vi.waitFor(() => expect(container.textContent).toContain('User not found'));
    expect(container.querySelector('a[href="/users"]')).toBeTruthy();
    expect(mockSetBreadcrumb).not.toHaveBeenCalled();
  });

  it('shows a role placeholder for a user without a role, and the archived badge', async () => {
    mockGetUser.mockResolvedValue({
      ...maya,
      role: null,
      archived_at: '2026-08-10T00:00:00Z',
    });
    mockGetUserOverview.mockRejectedValue(new Error('boom'));
    const { container } = render(() => <UserDetail />);
    await vi.waitFor(() => expect(container.textContent).toContain('Add a role'));
    expect(container.textContent).toContain('Archived');
    expect(container.querySelector('.budget-alert')).toBeNull();
  });

  it('edits the role in place', async () => {
    const { container, getByLabelText, getByText } = render(() => <UserDetail />);
    await vi.waitFor(() => expect(container.textContent).toContain('Engineering'));
    const roleChip = getByText('Engineering');
    fireEvent.click(roleChip);
    expect(container.querySelector('[aria-label="Edit role"]')).toBeTruthy();
    // Clicking the chip again closes the popover.
    fireEvent.click(roleChip);
    expect(container.querySelector('[aria-label="Edit role"]')).toBeNull();
    fireEvent.click(roleChip);
    fireEvent.input(getByLabelText('Role'), { target: { value: '  Support ' } });
    fireEvent.click(getByText('Save'));
    await vi.waitFor(() =>
      expect(mockUpdateUser).toHaveBeenCalledWith('u-maya', { role: 'Support' }),
    );
    expect(mockToast.success).toHaveBeenCalledWith('Role updated');
    await vi.waitFor(() => expect(container.querySelector('[aria-label="Edit role"]')).toBeNull());
    await vi.waitFor(() => expect(mockGetUser).toHaveBeenCalledTimes(2));
  });

  it('clears the role when saved empty and cancels an edit', async () => {
    const { container, getByLabelText, getByText } = render(() => <UserDetail />);
    await vi.waitFor(() => expect(container.textContent).toContain('Engineering'));
    fireEvent.click(getByText('Engineering'));
    fireEvent.click(getByText('Cancel'));
    expect(container.querySelector('[aria-label="Edit role"]')).toBeNull();
    fireEvent.click(getByText('Engineering'));
    fireEvent.input(getByLabelText('Role'), { target: { value: '' } });
    fireEvent.click(getByText('Save'));
    await vi.waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith('u-maya', { role: null }));
  });

  it('reports a failed role save and closes the popover on a second click', async () => {
    mockUpdateUser.mockRejectedValue(new Error('nope'));
    const { container, getByLabelText, getByText } = render(() => <UserDetail />);
    await vi.waitFor(() => expect(container.textContent).toContain('Engineering'));
    const chip = getByText('Engineering');
    fireEvent.click(chip);
    fireEvent.input(getByLabelText('Role'), { target: { value: 'Ops' } });
    fireEvent.click(getByText('Save'));
    await vi.waitFor(() => expect(mockToast.error).toHaveBeenCalled());
    expect(container.querySelector('[aria-label="Edit role"]')).not.toBeNull();
    fireEvent.click(chip);
    expect(container.querySelector('[aria-label="Edit role"]')).toBeNull();
  });

  it('never shows a budget chip, editor or alert, whatever the spend', async () => {
    mockGetUserOverview.mockResolvedValue({ ...overview, cost_30d_usd: 208.4 });
    const { container } = render(() => <UserDetail />);
    await vi.waitFor(() => expect(container.textContent).toContain('Maya Okonkwo'));
    expect(container.textContent).not.toMatch(/budget/i);
    expect(container.querySelector('.budget-alert')).toBeNull();
    expect(container.querySelectorAll('.inline-edit').length).toBe(1);
  });
});

describe('UserDetail — failures and validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserId = 'u-maya';
    mockPathname = '/users/u-maya';
    mockGetUser.mockResolvedValue(maya);
    mockGetUserOverview.mockResolvedValue(overview);
    mockUpdateUser.mockResolvedValue(maya);
  });

  it('shows an error state with retry when the user lookup fails', async () => {
    mockGetUser.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(maya);
    const { container, getByText } = render(() => <UserDetail />);
    await vi.waitFor(() => expect(container.textContent).toContain("Couldn't load this user"));
    expect(container.textContent).toContain('boom');
    expect(container.querySelector('title')?.textContent).toBe('User | Manifest');
    expect(container.textContent).not.toContain('User not found');
    expect(mockSetBreadcrumb).not.toHaveBeenCalled();
    fireEvent.click(getByText('Try again'));
    await vi.waitFor(() => expect(container.textContent).toContain('Maya Okonkwo'));
    expect(mockGetUser).toHaveBeenCalledTimes(2);
  });

  it('hands the overview error to the tabs instead of swallowing it', async () => {
    mockGetUserOverview.mockRejectedValue(new Error('nope'));
    const Probe = () => {
      const ctx = useUserDetail();
      return (
        <span data-testid="probe">
          {String((ctx.overview.error as Error | undefined)?.message)}|
          {String(ctx.overview.loading)}
        </span>
      );
    };
    const { getByTestId, container } = render(() => (
      <UserDetail>
        <Probe />
      </UserDetail>
    ));
    await vi.waitFor(() => expect(getByTestId('probe').textContent).toBe('nope|false'));
    // The shell itself still renders the header.
    expect(container.textContent).toContain('Maya Okonkwo');
  });
});
