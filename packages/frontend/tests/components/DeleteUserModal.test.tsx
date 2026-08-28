import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

vi.mock('@solidjs/router', () => ({
  A: (props: any) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
}));

const mockDeleteUser = vi.fn();
vi.mock('../../src/services/api/teams.js', () => ({
  deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
}));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('../../src/services/toast-store.js', () => ({ toast: mockToast }));

import DeleteUserModal from '../../src/components/DeleteUserModal';

const user = {
  id: 'u-1',
  name: 'Maya Okonkwo',
  email: null,
  role: null,
  monthly_budget_usd: null,
  archived_at: null,
  created_at: '2026-08-01T00:00:00Z',
};

describe('DeleteUserModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteUser.mockResolvedValue(undefined);
  });

  it('renders nothing when closed', () => {
    const { container } = render(() => (
      <DeleteUserModal
        open={false}
        user={user}
        agentCount={0}
        onClose={() => {}}
        onDeleted={() => {}}
      />
    ));
    expect(container.querySelector('.modal-card')).toBeNull();
  });

  it('deletes straight away when the user owns no agents', async () => {
    const onDeleted = vi.fn();
    const { container, getByText } = render(() => (
      <DeleteUserModal
        open={true}
        user={user}
        agentCount={0}
        onClose={() => {}}
        onDeleted={onDeleted}
      />
    ));
    expect(container.textContent).toContain('owns no agents');
    expect(container.querySelector('.choice-list')).toBeNull();
    const confirm = getByText('Delete user') as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    await vi.waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(mockDeleteUser).toHaveBeenCalledWith('u-1', { agents: 'unassign' });
    expect(mockToast.success).toHaveBeenCalledWith('User "Maya Okonkwo" deleted');
  });

  it('defaults to leaving agents unowned and offers deleting them instead', async () => {
    const onDeleted = vi.fn();
    const { container, getByText, getByLabelText } = render(() => (
      <DeleteUserModal
        open={true}
        user={user}
        agentCount={3}
        onClose={() => {}}
        onDeleted={onDeleted}
      />
    ));
    expect(container.textContent).toContain('still owns 3 agents');
    expect(container.textContent).not.toContain('reassign');
    const unassign = container.querySelector('input[value="unassign"]') as HTMLInputElement;
    const del = container.querySelector('input[value="delete"]') as HTMLInputElement;
    expect(unassign.checked).toBe(true);
    expect(container.querySelector('a')!.getAttribute('href')).toBe('/agents?owners=u-1');
    expect(getByLabelText('What happens to their agents')).toBeTruthy();

    fireEvent.change(del, { target: { checked: true } });
    expect(container.querySelectorAll('.choice-list__item--on').length).toBe(1);
    fireEvent.change(unassign, { target: { checked: true } });
    fireEvent.change(del, { target: { checked: true } });
    fireEvent.click(getByText('Delete user'));
    await vi.waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(mockDeleteUser).toHaveBeenCalledWith('u-1', { agents: 'delete' });
  });

  it('pluralises a single agent', () => {
    const { container } = render(() => (
      <DeleteUserModal
        open={true}
        user={user}
        agentCount={1}
        onClose={() => {}}
        onDeleted={() => {}}
      />
    ));
    expect(container.textContent).toContain('still owns 1 agent.');
  });

  it('waits for the agent count before allowing the delete', () => {
    const [count, setCount] = createSignal<number | null>(null);
    const { container, getByText } = render(() => (
      <DeleteUserModal
        open={true}
        user={user}
        agentCount={count()}
        onClose={() => {}}
        onDeleted={() => {}}
      />
    ));
    expect(container.textContent).toContain('Checking their agents…');
    expect(container.querySelector('.choice-list')).toBeNull();
    const confirm = getByText('Delete user') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(mockDeleteUser).not.toHaveBeenCalled();
    setCount(2);
    expect(container.textContent).toContain('still owns 2 agents');
    expect(confirm.disabled).toBe(false);
  });

  it('keeps the chosen action when the count changes while open, and resets on reopen', () => {
    const [count, setCount] = createSignal<number | null>(3);
    const [open, setOpen] = createSignal(true);
    const { container } = render(() => (
      <DeleteUserModal
        open={open()}
        user={user}
        agentCount={count()}
        onClose={() => {}}
        onDeleted={() => {}}
      />
    ));
    const del = () => container.querySelector('input[value="delete"]') as HTMLInputElement;
    fireEvent.change(del(), { target: { checked: true } });
    expect(del().checked).toBe(true);
    setCount(4);
    expect(container.textContent).toContain('still owns 4 agents');
    expect(del().checked).toBe(true);
    setOpen(false);
    setOpen(true);
    expect(del().checked).toBe(false);
    expect((container.querySelector('input[value="unassign"]') as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it('keeps the button disabled during an in-flight delete even if the count changes', async () => {
    let resolveDelete!: () => void;
    mockDeleteUser.mockReturnValue(new Promise<void>((res) => (resolveDelete = res)));
    const [count, setCount] = createSignal<number | null>(0);
    const onDeleted = vi.fn();
    const { getByText } = render(() => (
      <DeleteUserModal
        open={true}
        user={user}
        agentCount={count()}
        onClose={() => {}}
        onDeleted={onDeleted}
      />
    ));
    const confirm = () => getByText('Cancel').nextElementSibling as HTMLButtonElement;
    fireEvent.click(confirm());
    expect(confirm().disabled).toBe(true);
    setCount(1);
    expect(confirm().disabled).toBe(true);
    fireEvent.click(confirm());
    expect(mockDeleteUser).toHaveBeenCalledTimes(1);
    resolveDelete();
    await vi.waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });

  it('reports a failed delete', async () => {
    mockDeleteUser.mockRejectedValue(new Error('nope'));
    const onDeleted = vi.fn();
    const { getByText } = render(() => (
      <DeleteUserModal
        open={true}
        user={user}
        agentCount={0}
        onClose={() => {}}
        onDeleted={onDeleted}
      />
    ));
    fireEvent.click(getByText('Delete user'));
    await vi.waitFor(() => expect(mockToast.error).toHaveBeenCalled());
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('closes on Cancel, Escape and overlay click, not on inner clicks', () => {
    const onClose = vi.fn();
    const { container, getByText } = render(() => (
      <DeleteUserModal
        open={true}
        user={user}
        agentCount={0}
        onClose={onClose}
        onDeleted={() => {}}
      />
    ));
    fireEvent.click(getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(container.querySelector('.modal-overlay')!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(container.querySelector('.modal-overlay')!, { key: 'a' });
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(container.querySelector('.modal-card')!);
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(container.querySelector('.modal-overlay')!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
