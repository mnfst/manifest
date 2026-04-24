import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { RoutingFooter } from '../../src/pages/RoutingPanels';

describe('RoutingFooter', () => {
  it('renders setup instructions but no Disable routing button', () => {
    const onResetAll = vi.fn();
    const onShowInstructions = vi.fn();
    render(() => (
      <RoutingFooter
        hasOverrides={() => false}
        resettingAll={() => false}
        resettingTier={() => null}
        onResetAll={onResetAll}
        onShowInstructions={onShowInstructions}
      />
    ));
    expect(screen.getByRole('button', { name: 'Setup instructions' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /disable routing/i })).toBeNull();
  });

  it('shows the reset-all button when there are overrides', () => {
    render(() => (
      <RoutingFooter
        hasOverrides={() => true}
        resettingAll={() => false}
        resettingTier={() => null}
        onResetAll={vi.fn()}
        onShowInstructions={vi.fn()}
      />
    ));
    expect(screen.getByRole('button', { name: 'Reset all to auto' })).toBeDefined();
  });

  it('fires onShowInstructions when the setup link is clicked', () => {
    const onShowInstructions = vi.fn();
    render(() => (
      <RoutingFooter
        hasOverrides={() => false}
        resettingAll={() => false}
        resettingTier={() => null}
        onResetAll={vi.fn()}
        onShowInstructions={onShowInstructions}
      />
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Setup instructions' }));
    expect(onShowInstructions).toHaveBeenCalled();
  });
});
