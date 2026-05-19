import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@solidjs/testing-library';

import ModelParamsDialog from '../../src/components/ModelParamsDialog';

const q = (sel: string) => document.querySelector(sel);

describe('ModelParamsDialog', () => {
  // Dialog now reads which controls to render from
  // `PROVIDER_PARAM_SPECS[provider]` in manifest-shared. DeepSeek's spec
  // declares a single `thinking` toggle with default `enabled`, so these
  // tests use `provider: 'deepseek'` instead of passing `providerDefault`
  // directly — the dialog is fully driven by the spec.
  const baseProps = {
    open: true,
    slotLabel: 'deepseek-v4-flash',
    current: null as null | { thinking?: { type: 'enabled' | 'disabled' } },
    provider: 'deepseek',
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => vi.clearAllMocks());

  it('renders nothing when closed', () => {
    render(() => <ModelParamsDialog {...baseProps} open={false} />);
    expect(q('.modal-overlay')).toBeNull();
  });

  it('starts on the provider default when no override is configured', () => {
    render(() => <ModelParamsDialog {...baseProps} />);
    const toggle = q('.model-params__toggle') as HTMLButtonElement;
    // DeepSeek's natural default for `thinking` is `enabled`, per the spec.
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(q('.provider-toggle__switch--on')).not.toBeNull();
  });

  it('reflects the configured override when present', () => {
    render(() => (
      <ModelParamsDialog {...baseProps} current={{ thinking: { type: 'disabled' } }} />
    ));
    const toggle = q('.model-params__toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(q('.provider-toggle__switch--on')).toBeNull();
  });

  it("renders the spec's natural default in the hint text", () => {
    render(() => <ModelParamsDialog {...baseProps} />);
    // DeepSeek's spec default is `enabled`.
    expect(q('.model-params__label-hint')!.textContent).toContain('enabled');
  });

  it("renders the spec's label as the row title", () => {
    render(() => <ModelParamsDialog {...baseProps} />);
    expect(q('.model-params__label-title')!.textContent).toContain('Thinking mode');
  });

  it('saves null when every chosen value matches the provider default', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(() => (
      <ModelParamsDialog
        {...baseProps}
        onSave={onSave}
        current={{ thinking: { type: 'disabled' } }}
      />
    ));

    fireEvent.click(q('.model-params__toggle') as HTMLButtonElement); // disabled → enabled
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
  });

  it('saves an explicit override when at least one value differs from the provider default', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(() => (
      <ModelParamsDialog {...baseProps} onSave={onSave} onClose={onClose} />
    ));

    fireEvent.click(q('.model-params__toggle') as HTMLButtonElement); // enabled → disabled
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ thinking: { type: 'disabled' } }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('renders nothing for providers with no spec entries', () => {
    render(() => <ModelParamsDialog {...baseProps} provider="openai" />);
    // The dialog still mounts (open=true), but no rows render — the For
    // over zero spec entries collapses to nothing. Saving with no rows
    // produces the empty payload → null.
    expect(q('.model-params__row')).toBeNull();
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
