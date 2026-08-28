import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

const mockCreateUser = vi.fn();
vi.mock('../../src/services/api/teams.js', () => ({
  createUser: (...args: unknown[]) => mockCreateUser(...args),
}));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock('../../src/services/toast-store.js', () => ({ toast: mockToast }));

import AddUserModal from '../../src/components/AddUserModal';

const created = {
  id: 'u-new',
  name: 'Maya Okonkwo',
  email: null,
  role: null,
  monthly_budget_usd: null,
  archived_at: null,
  created_at: '2026-08-28T00:00:00Z',
};

describe('AddUserModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateUser.mockResolvedValue(created);
  });

  it('renders nothing when closed', () => {
    const { container } = render(() => <AddUserModal open={false} onClose={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('asks for a name, an optional email and an optional role, and nothing about budgets', () => {
    const { getByLabelText, container, getByText } = render(() => (
      <AddUserModal open onClose={() => {}} />
    ));
    expect(getByLabelText('Name')).toBeDefined();
    expect(getByLabelText('Email (optional)')).toBeDefined();
    expect(getByLabelText('Role (optional)')).toBeDefined();
    expect(container.querySelector('input[type="number"]')).toBeNull();
    expect(container.textContent).not.toMatch(/budget/i);
    expect(container.textContent).not.toMatch(/alert/i);
    expect((getByText('Add user', { selector: 'button' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('creates the user with trimmed values, empty fields as null, then closes', async () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    const { getByLabelText, getByText } = render(() => (
      <AddUserModal open onClose={onClose} onCreated={onCreated} />
    ));
    fireEvent.input(getByLabelText('Name'), { target: { value: '  Maya Okonkwo ' } });
    fireEvent.input(getByLabelText('Email (optional)'), { target: { value: '  ' } });
    fireEvent.input(getByLabelText('Role (optional)'), { target: { value: ' Engineering ' } });
    const submit = getByText('Add user', { selector: 'button' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledWith({
        name: 'Maya Okonkwo',
        email: null,
        role: 'Engineering',
      });
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(mockToast.success).toHaveBeenCalledWith('User "Maya Okonkwo" added');
  });

  it('submits on Enter inside a field and closes on Escape', async () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(() => <AddUserModal open onClose={onClose} />);
    fireEvent.input(getByLabelText('Name'), { target: { value: 'Tom' } });
    fireEvent.keyDown(getByLabelText('Name'), { key: 'Enter' });
    await waitFor(() => expect(mockCreateUser).toHaveBeenCalled());
    fireEvent.keyDown(getByLabelText('Name'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on an overlay click, not on a click inside the card', () => {
    const onClose = vi.fn();
    const { container, getByText } = render(() => <AddUserModal open onClose={onClose} />);
    fireEvent.click(container.querySelector('.modal-card')!);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector('.modal-overlay')!);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('ignores a submit while the name is empty or a create is in flight', async () => {
    let resolveCreate!: (v: unknown) => void;
    mockCreateUser.mockReturnValue(new Promise((res) => (resolveCreate = res)));
    const { getByLabelText, getByText, container } = render(() => (
      <AddUserModal open onClose={() => {}} />
    ));
    fireEvent.keyDown(getByLabelText('Name'), { key: 'Enter' });
    expect(mockCreateUser).not.toHaveBeenCalled();
    fireEvent.input(getByLabelText('Name'), { target: { value: 'Tom' } });
    fireEvent.click(getByText('Add user', { selector: 'button' }));
    fireEvent.keyDown(getByLabelText('Name'), { key: 'Enter' });
    expect(mockCreateUser).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.spinner')).not.toBeNull();
    resolveCreate(created);
    await waitFor(() => expect(container.querySelector('.spinner')).toBeNull());
  });

  it('surfaces the reason when the create fails, with a plain fallback', async () => {
    mockCreateUser.mockRejectedValueOnce(
      new Error('This needs the teams backend, which is not deployed yet.'),
    );
    const onClose = vi.fn();
    const { getByLabelText, getByText } = render(() => <AddUserModal open onClose={onClose} />);
    fireEvent.input(getByLabelText('Name'), { target: { value: 'Tom' } });
    fireEvent.click(getByText('Add user', { selector: 'button' }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Couldn't add this user: This needs the teams backend, which is not deployed yet.",
      );
    });
    expect(onClose).not.toHaveBeenCalled();

    mockCreateUser.mockRejectedValueOnce('boom');
    fireEvent.click(getByText('Add user', { selector: 'button' }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenLastCalledWith("Couldn't add this user.");
    });
  });

  it('resets the form when it closes and reopens', async () => {
    const [open, setOpen] = createSignal(true);
    const { getByLabelText } = render(() => (
      <AddUserModal open={open()} onClose={() => setOpen(false)} />
    ));
    fireEvent.input(getByLabelText('Name'), { target: { value: 'Tom' } });
    fireEvent.input(getByLabelText('Role (optional)'), { target: { value: 'Ops' } });
    setOpen(false);
    setOpen(true);
    await waitFor(() => {
      expect((getByLabelText('Name') as HTMLInputElement).value).toBe('');
    });
    expect((getByLabelText('Role (optional)') as HTMLInputElement).value).toBe('');
  });
});
