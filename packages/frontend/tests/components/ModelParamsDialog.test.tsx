import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@solidjs/testing-library';

import ModelParamsDialog from '../../src/components/ModelParamsDialog';

const q = (sel: string) => document.querySelector(sel);

describe('ModelParamsDialog', () => {
  const baseProps = {
    open: true,
    slotLabel: 'standard tier',
    current: null as null | { thinking?: { type: 'enabled' | 'disabled' } },
    providerDefault: 'enabled' as 'enabled' | 'disabled',
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => vi.clearAllMocks());

  it('renders nothing when closed', () => {
    render(() => <ModelParamsDialog {...baseProps} open={false} />);
    expect(q('.modal-overlay')).toBeNull();
  });

  it('starts on the provider default when no override is configured', () => {
    render(() => <ModelParamsDialog {...baseProps} providerDefault="enabled" />);
    const toggle = q('.model-params__toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(q('.provider-toggle__switch--on')).not.toBeNull();
  });

  it('reflects the configured override when present', () => {
    render(() => (
      <ModelParamsDialog
        {...baseProps}
        providerDefault="enabled"
        current={{ thinking: { type: 'disabled' } }}
      />
    ));
    const toggle = q('.model-params__toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(q('.provider-toggle__switch--on')).toBeNull();
  });

  it('shows the provider default in the hint text', () => {
    render(() => <ModelParamsDialog {...baseProps} providerDefault="enabled" />);
    expect(q('.model-params__label-hint')!.textContent).toContain('enabled');
  });

  it('saves null when the user lands on the provider default', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(() => (
      <ModelParamsDialog
        {...baseProps}
        onSave={onSave}
        providerDefault="enabled"
        current={{ thinking: { type: 'disabled' } }}
      />
    ));

    fireEvent.click(q('.model-params__toggle') as HTMLButtonElement); // disabled → enabled
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
  });

  it('saves an explicit override when the user lands on the non-default state', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(() => (
      <ModelParamsDialog
        {...baseProps}
        onSave={onSave}
        onClose={onClose}
        providerDefault="enabled"
      />
    ));

    fireEvent.click(q('.model-params__toggle') as HTMLButtonElement); // enabled → disabled
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ thinking: { type: 'disabled' } }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('cancel button closes without persisting', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(() => (
      <ModelParamsDialog {...baseProps} onSave={onSave} onClose={onClose} />
    ));

    fireEvent.click(screen.getByText('Cancel'));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape key closes the dialog', () => {
    const onClose = vi.fn();
    render(() => <ModelParamsDialog {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(q('.modal-card')!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking the overlay closes the dialog', () => {
    const onClose = vi.fn();
    render(() => <ModelParamsDialog {...baseProps} onClose={onClose} />);
    fireEvent.click(q('.modal-overlay')!);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close mid-save when the user re-clicks the overlay', async () => {
    let resolveSave: (() => void) | undefined;
    const onSave = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const onClose = vi.fn();
    render(() => <ModelParamsDialog {...baseProps} onSave={onSave} onClose={onClose} />);

    fireEvent.click(screen.getByText('Save'));
    fireEvent.click(q('.modal-overlay')!);
    expect(onClose).not.toHaveBeenCalled();
    resolveSave!();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
