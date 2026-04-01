import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { DisableRoutingModal } from '../../src/pages/RoutingPanels';

describe('DisableRoutingModal', () => {
  it('renders dialog with role and aria-labelledby when open', () => {
    const { container } = render(() => (
      <DisableRoutingModal
        open={true}
        disabling={() => false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    ));
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
    expect(dialog!.getAttribute('aria-labelledby')).toBe('disable-routing-modal-title');
    expect(container.querySelector('#disable-routing-modal-title')).not.toBeNull();
  });

  it('does not render when closed', () => {
    const { container } = render(() => (
      <DisableRoutingModal
        open={false}
        disabling={() => false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    ));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('calls onCancel when Cancel button clicked', () => {
    const onCancel = vi.fn();
    render(() => (
      <DisableRoutingModal
        open={true}
        disabling={() => false}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    ));
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows title text', () => {
    render(() => (
      <DisableRoutingModal
        open={true}
        disabling={() => false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    ));
    expect(screen.getByText('Disable routing?')).toBeDefined();
  });
});
