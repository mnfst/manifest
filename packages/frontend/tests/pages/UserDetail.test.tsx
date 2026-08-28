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
  monthly_budget_usd: 200,
  archived_at: null,
  created_at: '2026-08-01T00:00:00Z',
};

const overview = {
  cost_month_usd: 100,
  cost_trend_pct: 5,
  budget_usd: 200,
  requests: 10,
  tokens: 100,
  cost_series: [],
  agents: [],
};

const Child = () => {
  const ctx = useUserDetail();
  return (
    <div data-testid="child">
      {ctx.userId()}|{ctx.user()?.name}|{String(ctx.overview()?.cost_month_usd)}
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
    expect(container.textContent).toContain('Budget $200 / month');
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

  it('shows placeholders for a user without role or budget, and the archived badge', async () => {
    mockGetUser.mockResolvedValue({
      ...maya,
      role: null,
      monthly_budget_usd: null,
      archived_at: '2026-08-10T00:00:00Z',
    });
    mockGetUserOverview.mockRejectedValue(new Error('boom'));
    const { container } = render(() => <UserDetail />);
    await vi.waitFor(() => expect(container.textContent).toContain('Add a role'));
    expect(container.textContent).toContain('No budget');
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

  it('edits the budget in place and validates it', async () => {
    const { container, getByLabelText, getByText } = render(() => <UserDetail />);
    await vi.waitFor(() => expect(container.textContent).toContain('Budget $200 / month'));
    const chip = getByText('Budget $200 / month');
    fireEvent.click(chip);
    expect((getByLabelText('Monthly budget in USD') as HTMLInputElement).value).toBe('200');
    expect(container.textContent).toContain('recomputes the meter from the first');
    fireEvent.input(getByLabelText('Monthly budget in USD'), { target: { value: '-1' } });
    expect(container.textContent).toContain('Enter a positive amount');
    expect((getByText('Save') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(getByText('Save'));
    expect(mockUpdateUser).not.toHaveBeenCalled();
    fireEvent.input(getByLabelText('Monthly budget in USD'), { target: { value: '250' } });
    fireEvent.click(getByText('Save'));
    await vi.waitFor(() =>
      expect(mockUpdateUser).toHaveBeenCalledWith('u-maya', { monthly_budget_usd: 250 }),
    );
    expect(mockToast.success).toHaveBeenCalledWith('Budget updated');
    fireEvent.click(chip);
    fireEvent.click(chip);
    expect(container.querySelector('[aria-label="Edit budget"]')).toBeNull();
  });

  it('saves an empty budget as null and reports a failed save', async () => {
    mockGetUser.mockResolvedValue({ ...maya, monthly_budget_usd: null });
    mockUpdateUser.mockRejectedValue(new Error('nope'));
    const { container, getByLabelText, getByText } = render(() => <UserDetail />);
    await vi.waitFor(() => expect(container.textContent).toContain('No budget'));
    fireEvent.click(getByText('No budget'));
    expect((getByLabelText('Monthly budget in USD') as HTMLInputElement).value).toBe('');
    fireEvent.click(getByText('Save'));
    await vi.waitFor(() =>
      expect(mockUpdateUser).toHaveBeenCalledWith('u-maya', { monthly_budget_usd: null }),
    );
    await vi.waitFor(() => expect(mockToast.error).toHaveBeenCalled());
  });

  it('raises a warning banner near the budget and a red one over it', async () => {
    mockGetUserOverview.mockResolvedValue({ ...overview, cost_month_usd: 186.2 });
    const { container } = render(() => <UserDetail />);
    await vi.waitFor(() => expect(container.querySelector('.budget-alert')).toBeTruthy());
    expect(container.textContent).toContain('close to their budget');
    expect(container.textContent).toContain('$13.80 left');
    expect(container.querySelector('.budget-alert--over')).toBeNull();
  });

  it('shows the over-budget banner', async () => {
    mockGetUserOverview.mockResolvedValue({ ...overview, cost_month_usd: 208.4 });
    const { container } = render(() => <UserDetail />);
    await vi.waitFor(() => expect(container.querySelector('.budget-alert--over')).toBeTruthy());
    expect(container.textContent).toContain('over budget by $8.40');
    expect(container.textContent).toContain('nothing is blocked');
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
    // The shell itself still renders the header; no budget alert without a spend.
    expect(container.textContent).toContain('Maya Okonkwo');
    expect(container.querySelector('.budget-alert')).toBeNull();
  });

  it('rejects a zero budget in the inline edit', async () => {
    const { container, getByLabelText, getByText } = render(() => <UserDetail />);
    await vi.waitFor(() => expect(container.textContent).toContain('Budget $200 / month'));
    fireEvent.click(getByText('Budget $200 / month'));
    fireEvent.input(getByLabelText('Monthly budget in USD'), { target: { value: '0' } });
    expect(container.textContent).toContain(
      'Enter a positive amount, or leave empty for no budget',
    );
    expect((getByText('Save') as HTMLButtonElement).disabled).toBe(true);
  });
});
