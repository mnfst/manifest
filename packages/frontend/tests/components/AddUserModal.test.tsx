import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

const mockCreateUser = vi.fn();
vi.mock('../../src/services/api/teams.js', () => ({
  createUser: (...args: unknown[]) => mockCreateUser(...args),
}));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('../../src/services/toast-store.js', () => ({ toast: mockToast }));

import AddUserModal from '../../src/components/AddUserModal';

const user = {
  id: 'u-1',
  name: 'Maya Okonkwo',
  email: null,
  role: null,
  monthly_budget_usd: 200,
  archived_at: null,
  created_at: '2026-08-01T00:00:00Z',
};

describe('AddUserModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateUser.mockResolvedValue(user);
  });

  it('renders nothing when closed', () => {
    const { container } = render(() => <AddUserModal open={false} onClose={() => {}} />);
    expect(container.querySelector('.modal-card')).toBeNull();
  });

  it('keeps the submit disabled until a name is typed', () => {
    const { getByLabelText, getByText } = render(() => (
      <AddUserModal open={true} onClose={() => {}} />
    ));
    const submit = getByText('Add user', { selector: 'button' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.input(getByLabelText('Name'), { target: { value: 'Maya' } });
    expect(submit.disabled).toBe(false);
  });

  it('flags an invalid budget and blocks the submit', () => {
    const { getByLabelText, getByText, container } = render(() => (
      <AddUserModal open={true} onClose={() => {}} />
    ));
    fireEvent.input(getByLabelText('Name'), { target: { value: 'Maya' } });
    fireEvent.input(getByLabelText('Monthly budget in USD (optional)'), {
      target: { value: '-5' },
    });
    expect(container.textContent).toContain('Enter a positive amount');
    expect((getByText('Add user', { selector: 'button' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.input(getByLabelText('Monthly budget in USD (optional)'), {
      target: { value: '200' },
    });
    expect(container.textContent).not.toContain('Enter a positive amount');
    expect(container.textContent).toContain('Nothing is blocked');
  });

  it('creates the user with trimmed fields and reports back', async () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    const { getByLabelText, getByText } = render(() => (
      <AddUserModal open={true} onClose={onClose} onCreated={onCreated} />
    ));
    fireEvent.input(getByLabelText('Name'), { target: { value: '  Maya Okonkwo ' } });
    fireEvent.input(getByLabelText('Email (optional)'), { target: { value: ' maya@x.com ' } });
    fireEvent.input(getByLabelText('Role (optional)'), { target: { value: 'Engineering' } });
    fireEvent.input(getByLabelText('Monthly budget in USD (optional)'), {
      target: { value: '200' },
    });
    fireEvent.click(getByText('Add user', { selector: 'button' }));
    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith(user));
    expect(mockCreateUser).toHaveBeenCalledWith({
      name: 'Maya Okonkwo',
      email: 'maya@x.com',
      role: 'Engineering',
      monthly_budget_usd: 200,
    });
    expect(mockToast.success).toHaveBeenCalledWith('User "Maya Okonkwo" added');
    expect(onClose).toHaveBeenCalled();
  });

  it('sends nulls for empty optional fields and submits on Enter', async () => {
    const { getByLabelText } = render(() => <AddUserModal open={true} onClose={() => {}} />);
    const name = getByLabelText('Name');
    fireEvent.input(name, { target: { value: 'Tom' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    await vi.waitFor(() =>
      expect(mockCreateUser).toHaveBeenCalledWith({
        name: 'Tom',
        email: null,
        role: null,
        monthly_budget_usd: null,
      }),
    );
  });

  it('ignores Enter before the form is valid', () => {
    const { getByLabelText } = render(() => <AddUserModal open={true} onClose={() => {}} />);
    fireEvent.keyDown(getByLabelText('Name'), { key: 'Enter' });
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('shows an error toast when the create fails', async () => {
    mockCreateUser.mockRejectedValue(new Error('nope'));
    const onClose = vi.fn();
    const { getByLabelText, getByText } = render(() => (
      <AddUserModal open={true} onClose={onClose} />
    ));
    fireEvent.input(getByLabelText('Name'), { target: { value: 'Tom' } });
    fireEvent.click(getByText('Add user', { selector: 'button' }));
    await vi.waitFor(() => expect(mockToast.error).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape, overlay click and Cancel, but not on inner clicks', () => {
    const onClose = vi.fn();
    const { container, getByLabelText, getByText } = render(() => (
      <AddUserModal open={true} onClose={onClose} />
    ));
    fireEvent.keyDown(getByLabelText('Name'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(container.querySelector('.modal-card')!);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(container.querySelector('.modal-overlay')!);
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('resets the form when reopened', () => {
    const [open, setOpen] = createSignal(true);
    const { getByLabelText } = render(() => <AddUserModal open={open()} onClose={() => {}} />);
    fireEvent.input(getByLabelText('Name'), { target: { value: 'Tom' } });
    setOpen(false);
    setOpen(true);
    expect((getByLabelText('Name') as HTMLInputElement).value).toBe('');
  });
});
