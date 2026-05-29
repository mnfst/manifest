import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@solidjs/testing-library';
import DeleteConfirmModal from '../../src/components/DeleteConfirmModal';

describe('DeleteConfirmModal', () => {
  it('disables confirm until the target name is typed exactly', () => {
    const onConfirm = vi.fn();
    render(() => (
      <DeleteConfirmModal
        targetName="Premium"
        title="Delete Premium"
        description="Permanent delete."
        confirmLabel="Delete tier"
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    ));
    const submit = screen.getByTestId('delete-confirm-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.input(screen.getByTestId('delete-confirm-input'), { target: { value: 'Premium' } });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(() => (
      <DeleteConfirmModal
        targetName="Premium"
        title="Delete Premium"
        description="Permanent delete."
        confirmLabel="Delete tier"
        onClose={onClose}
        onConfirm={vi.fn()}
      />
    ));
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('blocks close and confirm while deleting', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(() => (
      <DeleteConfirmModal
        targetName="Premium"
        title="Delete Premium"
        description="Permanent delete."
        confirmLabel="Delete tier"
        deleting
        onClose={onClose}
        onConfirm={onConfirm}
      />
    ));
    fireEvent.input(screen.getByTestId('delete-confirm-input'), { target: { value: 'Premium' } });
    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(screen.getByTestId('delete-confirm-submit'));
    expect(onClose).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
