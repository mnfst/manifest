import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

const mockNavigate = vi.fn();
vi.mock('@solidjs/router', () => ({
  useNavigate: () => mockNavigate,
}));

const mockUpdateUser = vi.fn();
const mockArchiveUser = vi.fn();
const mockUnarchiveUser = vi.fn();
vi.mock('../../src/services/api/teams.js', () => ({
  updateUser: (...args: unknown[]) => mockUpdateUser(...args),
  archiveUser: (...args: unknown[]) => mockArchiveUser(...args),
  unarchiveUser: (...args: unknown[]) => mockUnarchiveUser(...args),
}));

vi.mock('../../src/components/DeleteUserModal.jsx', () => ({
  default: (props: any) => (
    <div
      data-testid="delete-user-modal"
      data-open={String(props.open)}
      data-count={props.agentCount}
      data-user={props.user.name}
    >
      <button onClick={() => props.onDeleted()}>deleted</button>
      <button onClick={() => props.onClose()}>close-delete</button>
    </div>
  ),
}));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('../../src/services/toast-store.js', () => ({ toast: mockToast }));

const [mockUser, setMockUser] = createSignal<any>(undefined);
const [mockOverview, setMockOverview] = createSignal<any>(undefined);
const mockRefetchUser = vi.fn();
vi.mock('../../src/pages/UserDetail.jsx', () => ({
  useUserDetail: () => ({
    userId: () => 'u-maya',
    user: mockUser,
    overview: mockOverview,
    refetchUser: mockRefetchUser,
    refetchOverview: vi.fn(),
  }),
}));

import UserSettings from '../../src/pages/UserSettings';

const maya = {
  id: 'u-maya',
  name: 'Maya Okonkwo',
  email: 'maya@x.com',
  role: 'Engineering',
  monthly_budget_usd: 200,
  archived_at: null,
  created_at: '2026-08-01T00:00:00Z',
};

describe('UserSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(maya);
    setMockOverview({ agents: [{ archived_at: null }, { archived_at: '2026-08-01' }] });
    mockUpdateUser.mockResolvedValue(maya);
    mockArchiveUser.mockResolvedValue(maya);
    mockUnarchiveUser.mockResolvedValue(maya);
  });

  it('renders nothing until the user loads', () => {
    setMockUser(undefined);
    const { container } = render(() => <UserSettings />);
    expect(container.querySelector('.settings-card')).toBeNull();
  });

  it('prefills the profile and saves it', async () => {
    const { getByLabelText, getByText } = render(() => <UserSettings />);
    expect((getByLabelText('Name') as HTMLInputElement).value).toBe('Maya Okonkwo');
    expect((getByLabelText('Email') as HTMLInputElement).value).toBe('maya@x.com');
    expect((getByLabelText('Role') as HTMLInputElement).value).toBe('Engineering');
    expect((getByLabelText('Monthly budget') as HTMLInputElement).value).toBe('200');
    fireEvent.input(getByLabelText('Name'), { target: { value: ' Maya O. ' } });
    fireEvent.input(getByLabelText('Email'), { target: { value: '' } });
    fireEvent.input(getByLabelText('Role'), { target: { value: '' } });
    fireEvent.input(getByLabelText('Monthly budget'), { target: { value: '' } });
    fireEvent.click(getByText('Save'));
    await vi.waitFor(() =>
      expect(mockUpdateUser).toHaveBeenCalledWith('u-maya', {
        name: 'Maya O.',
        email: null,
        role: null,
        monthly_budget_usd: null,
      }),
    );
    expect(mockToast.success).toHaveBeenCalledWith('User updated');
    expect(mockRefetchUser).toHaveBeenCalled();
  });

  it('prefills empty optional fields for a sparse user', () => {
    setMockUser({ ...maya, email: null, role: null, monthly_budget_usd: null });
    const { getByLabelText } = render(() => <UserSettings />);
    expect((getByLabelText('Email') as HTMLInputElement).value).toBe('');
    expect((getByLabelText('Monthly budget') as HTMLInputElement).value).toBe('');
  });

  it('blocks saving with an empty name or an invalid budget', () => {
    const { getByLabelText, getByText, container } = render(() => <UserSettings />);
    fireEvent.input(getByLabelText('Monthly budget'), { target: { value: '-3' } });
    expect(container.textContent).toContain('Enter a positive amount');
    expect((getByText('Save') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(getByText('Save'));
    expect(mockUpdateUser).not.toHaveBeenCalled();
    fireEvent.input(getByLabelText('Monthly budget'), { target: { value: '5' } });
    fireEvent.input(getByLabelText('Name'), { target: { value: '   ' } });
    expect((getByText('Save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('reports a failed save', async () => {
    mockUpdateUser.mockRejectedValue(new Error('nope'));
    const { getByText } = render(() => <UserSettings />);
    fireEvent.click(getByText('Save'));
    await vi.waitFor(() => expect(mockToast.error).toHaveBeenCalled());
  });

  it('archives and restores the user', async () => {
    const { getByText, container } = render(() => <UserSettings />);
    expect(container.textContent).toContain('Archive this user');
    fireEvent.click(getByText('Archive', { selector: 'button' }));
    await vi.waitFor(() => expect(mockArchiveUser).toHaveBeenCalledWith('u-maya'));
    expect(mockToast.success).toHaveBeenCalledWith('Maya Okonkwo archived');
    expect(mockRefetchUser).toHaveBeenCalled();

    setMockUser({ ...maya, archived_at: '2026-08-10T00:00:00Z' });
    await vi.waitFor(() => expect(container.textContent).toContain('This user is archived'));
    fireEvent.click(getByText('Restore'));
    await vi.waitFor(() => expect(mockUnarchiveUser).toHaveBeenCalledWith('u-maya'));
    expect(mockToast.success).toHaveBeenCalledWith('Maya Okonkwo restored');
  });

  it('reports a failed archive', async () => {
    mockArchiveUser.mockRejectedValue(new Error('nope'));
    const { getByText } = render(() => <UserSettings />);
    fireEvent.click(getByText('Archive', { selector: 'button' }));
    await vi.waitFor(() => expect(mockToast.error).toHaveBeenCalled());
  });

  it('opens the delete modal with the live agent count and navigates after deletion', () => {
    const { getByText, getByTestId } = render(() => <UserSettings />);
    const modal = getByTestId('delete-user-modal');
    expect(modal.getAttribute('data-open')).toBe('false');
    expect(modal.getAttribute('data-count')).toBe('1');
    fireEvent.click(getByText('Delete user'));
    expect(modal.getAttribute('data-open')).toBe('true');
    fireEvent.click(getByText('close-delete'));
    expect(modal.getAttribute('data-open')).toBe('false');
    fireEvent.click(getByText('Delete user'));
    fireEvent.click(getByText('deleted'));
    expect(mockNavigate).toHaveBeenCalledWith('/users', { replace: true });
    expect(modal.getAttribute('data-open')).toBe('false');
  });

  it('passes a zero agent count when the overview has not loaded', () => {
    setMockOverview(undefined);
    const { getByTestId } = render(() => <UserSettings />);
    expect(getByTestId('delete-user-modal').getAttribute('data-count')).toBe('0');
  });
});
