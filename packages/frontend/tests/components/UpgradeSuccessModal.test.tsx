import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import UpgradeSuccessModal from '../../src/components/UpgradeSuccessModal';

describe('UpgradeSuccessModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(() => <UpgradeSuccessModal open={false} onClose={vi.fn()} />);

    expect(container.textContent).toBe('');
  });

  it('renders Pro benefits and closes from the backdrop or done button', () => {
    const onClose = vi.fn();
    const { container } = render(() => <UpgradeSuccessModal open onClose={onClose} />);

    expect(screen.getByText("You're on the Pro plan")).toBeDefined();
    expect(screen.getByText('Unlimited routed requests')).toBeDefined();
    expect(screen.getByText('365 days dashboard retention')).toBeDefined();

    fireEvent.click(container.querySelector('.upgrade-success-modal')!);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(container.querySelector('.modal-backdrop')!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
