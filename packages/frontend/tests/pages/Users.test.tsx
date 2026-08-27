import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

let mockSearchParams: Record<string, string | undefined> = {};
const mockSetSearchParams = vi.fn((next: Record<string, string | undefined>) => {
  mockSearchParams = { ...mockSearchParams, ...next };
});

vi.mock('@solidjs/router', () => ({
  useSearchParams: () => [
    {
      get q() {
        return mockSearchParams.q;
      },
      get sort() {
        return mockSearchParams.sort;
      },
      get dir() {
        return mockSearchParams.dir;
      },
      get archived() {
        return mockSearchParams.archived;
      },
    },
    mockSetSearchParams,
  ],
  A: (props: any) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
}));

vi.mock('@solidjs/meta', () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: (props: any) => <meta name={props.name ?? ''} content={props.content ?? ''} />,
}));

const mockGetUsers = vi.fn();
vi.mock('../../src/services/api/teams.js', () => ({
  getUsers: (...args: unknown[]) => mockGetUsers(...args),
}));

vi.mock('../../src/components/AddUserModal.jsx', () => ({
  default: (props: any) => (
    <div data-testid="add-user-modal" data-open={String(props.open)}>
      <button onClick={() => props.onCreated?.({ id: 'u-new' })}>created</button>
      <button onClick={() => props.onClose()}>close-modal</button>
    </div>
  ),
}));

import Users from '../../src/pages/Users';

const maya = {
  id: 'u-maya',
  name: 'Maya Okonkwo',
  email: null,
  role: 'Engineering',
  monthly_budget_usd: 200,
  archived_at: null,
  created_at: '2026-08-01T00:00:00Z',
  agent_count: 4,
  spend_month_usd: 186.2,
  last_active_at: null,
};
const sara = {
  ...maya,
  id: 'u-sara',
  name: 'Sara Lindqvist',
  role: null,
  monthly_budget_usd: null,
  archived_at: '2026-08-10T00:00:00Z',
  agent_count: 1,
  spend_month_usd: 58.4,
};

const response = {
  users: [maya, sara],
  total: 2,
  spend_month_usd_total: 244.6,
  budget_month_usd_total: 200,
};

describe('Users page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = {};
    mockGetUsers.mockResolvedValue(response);
  });

  it('shows a skeleton while loading', () => {
    mockGetUsers.mockReturnValue(new Promise(() => {}));
    const { container } = render(() => <Users />);
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    expect(container.textContent).toContain('People in your company');
  });

  it('shows the error state and retries', async () => {
    mockGetUsers.mockRejectedValueOnce(new Error('boom'));
    const { container, getByText } = render(() => <Users />);
    await vi.waitFor(() => expect(container.textContent).toContain('boom'));
    fireEvent.click(getByText('Try again'));
    await vi.waitFor(() => expect(container.textContent).toContain('Maya Okonkwo'));
  });

  it('renders the day-one empty state with a link to Agents', async () => {
    mockGetUsers.mockResolvedValue({ ...response, users: [], total: 0 });
    const { container, getByText, getByTestId } = render(() => <Users />);
    await vi.waitFor(() => expect(container.textContent).toContain('No users yet'));
    expect(container.textContent).toContain('every existing agent has no owner');
    expect(getByText('Go to Agents').getAttribute('href')).toBe('/agents');
    fireEvent.click(container.querySelector('.empty-state button')!);
    expect(getByTestId('add-user-modal').getAttribute('data-open')).toBe('true');
  });

  it('lists users with role, budget, archive badge and meter', async () => {
    const { container } = render(() => <Users />);
    await vi.waitFor(() => expect(container.textContent).toContain('Sara Lindqvist'));
    expect(container.textContent).toContain('2 users');
    expect(container.textContent).toContain('$244.60 spent this month of $200.00 budgeted');
    expect(container.textContent).toContain('Engineering');
    expect(container.textContent).toContain('$200');
    expect(container.textContent).toContain('—');
    expect(container.textContent).toContain('Archived');
    expect(container.textContent).toContain('$13.80 left');
    expect(container.textContent).toContain('No budget');
    expect(container.querySelector('a[href="/users/u-maya"]')).toBeTruthy();
  });

  it('pluralises a single user', async () => {
    mockGetUsers.mockResolvedValue({ ...response, users: [maya], total: 1 });
    const { container } = render(() => <Users />);
    await vi.waitFor(() => expect(container.textContent).toContain('1 user ·'));
  });

  it('searches and toggles archived, persisting both in the URL', async () => {
    const { container, getByLabelText } = render(() => <Users />);
    await vi.waitFor(() => expect(container.textContent).toContain('Maya Okonkwo'));
    fireEvent.input(getByLabelText('Search users'), { target: { value: 'sara' } });
    expect(mockSetSearchParams).toHaveBeenCalledWith({ q: 'sara' }, { replace: true });
    await vi.waitFor(() =>
      expect(mockGetUsers).toHaveBeenLastCalledWith({
        search: 'sara',
        include_archived: false,
        sort: undefined,
        dir: undefined,
      }),
    );
    fireEvent.change(getByLabelText('Include archived'), { target: { checked: true } });
    expect(mockSetSearchParams).toHaveBeenCalledWith({ archived: '1' }, { replace: true });
    await vi.waitFor(() =>
      expect(mockGetUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ include_archived: true }),
      ),
    );
  });

  it('shows the filtered-empty state and clears filters', async () => {
    mockSearchParams = { q: 'zzz', archived: '1' };
    mockGetUsers.mockResolvedValue({ ...response, users: [], total: 0 });
    const { container, getByText } = render(() => <Users />);
    await vi.waitFor(() => expect(container.textContent).toContain('No users match'));
    fireEvent.click(getByText('Clear filters'));
    expect(mockSetSearchParams).toHaveBeenCalledWith({ q: undefined }, { replace: true });
    expect(mockSetSearchParams).toHaveBeenCalledWith({ archived: undefined }, { replace: true });
  });

  it('sorts by spend and by budget left, flipping direction on a second click', async () => {
    const { container, getByText } = render(() => <Users />);
    await vi.waitFor(() => expect(container.textContent).toContain('Maya Okonkwo'));
    fireEvent.click(getByText('Spend'));
    expect(mockSetSearchParams).toHaveBeenCalledWith(
      { sort: 'spend', dir: 'desc' },
      { replace: true },
    );
    await vi.waitFor(() =>
      expect(mockGetUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'spend', dir: 'desc' }),
      ),
    );
    fireEvent.click(getByText('Spend'));
    expect(mockSetSearchParams).toHaveBeenCalledWith(
      { sort: 'spend', dir: 'asc' },
      { replace: true },
    );
    fireEvent.click(getByText('Left this month'));
    expect(mockSetSearchParams).toHaveBeenCalledWith(
      { sort: 'budget_left', dir: 'asc' },
      { replace: true },
    );
    expect(container.querySelector('th[aria-sort="ascending"]')).toBeTruthy();
  });

  it('seeds sort and direction from the URL', async () => {
    mockSearchParams = { sort: 'budget_left', dir: 'desc' };
    render(() => <Users />);
    await vi.waitFor(() =>
      expect(mockGetUsers).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'budget_left', dir: 'desc' }),
      ),
    );
  });

  it('ignores an unknown sort in the URL', async () => {
    mockSearchParams = { sort: 'bogus' };
    render(() => <Users />);
    await vi.waitFor(() =>
      expect(mockGetUsers).toHaveBeenCalledWith(expect.objectContaining({ sort: undefined })),
    );
  });

  it('opens the add modal from the header and refetches after a create', async () => {
    const { container, getByText, getByTestId } = render(() => <Users />);
    await vi.waitFor(() => expect(container.textContent).toContain('Maya Okonkwo'));
    fireEvent.click(getByText('Add user', { selector: '.page-header button' }));
    expect(getByTestId('add-user-modal').getAttribute('data-open')).toBe('true');
    fireEvent.click(getByText('created'));
    await vi.waitFor(() => expect(mockGetUsers).toHaveBeenCalledTimes(2));
    fireEvent.click(getByText('close-modal'));
    expect(getByTestId('add-user-modal').getAttribute('data-open')).toBe('false');
  });
});
