import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@solidjs/testing-library';
import KeyPickerModal from '../../src/components/KeyPickerModal';
import type { RoutingProvider } from '../../src/services/api';

function k(overrides: Partial<RoutingProvider> = {}): RoutingProvider {
  return {
    id: 'p1',
    provider: 'google',
    auth_type: 'api_key',
    is_active: true,
    has_api_key: true,
    key_prefix: 'AIzaSyBm',
    label: 'Default',
    priority: 0,
    region: null,
    connected_at: '2026-04-27',
    ...overrides,
  };
}

describe('KeyPickerModal', () => {
  it('renders the provider + model name and one row per key', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(() => (
      <KeyPickerModal
        providerName="Google"
        modelName="Gemini 2.5 Pro"
        keys={[k({ label: 'Personal' }), k({ label: 'Work', id: 'p2' })]}
        onPick={onPick}
        onClose={onClose}
      />
    ));
    expect(screen.getByText('Which Google key?')).toBeDefined();
    const model = screen.getByText('Gemini 2.5 Pro');
    expect(model.tagName).toBe('STRONG');
    expect(model.parentElement?.textContent).toBe('Picking a key for Gemini 2.5 Pro');
    expect(screen.getByText('Personal')).toBeDefined();
    expect(screen.getByText('Work')).toBeDefined();
  });

  it('calls onPick with the chosen label when a row is clicked', () => {
    const onPick = vi.fn();
    render(() => (
      <KeyPickerModal
        providerName="Google"
        modelName="Gemini 2.5 Pro"
        keys={[k({ label: 'Personal' }), k({ label: 'Work', id: 'p2' })]}
        onPick={onPick}
        onClose={vi.fn()}
      />
    ));
    fireEvent.click(screen.getByText('Work'));
    expect(onPick).toHaveBeenCalledWith('Work');
  });

  it('shows the masked key prefix beside each label', () => {
    render(() => (
      <KeyPickerModal
        providerName="Google"
        modelName="Gemini 2.5 Pro"
        keys={[k({ label: 'Personal', key_prefix: 'AIzaSyBm' })]}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />
    ));
    // prefix + 8 dots
    expect(screen.getByText(/AIzaSyBm•+/)).toBeDefined();
  });

  it('falls back to a generic mask when key_prefix is null', () => {
    render(() => (
      <KeyPickerModal
        providerName="Google"
        modelName="Gemini 2.5 Pro"
        keys={[k({ label: 'Personal', key_prefix: null })]}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />
    ));
    expect(screen.getByText(/^•+$/)).toBeDefined();
  });

  it('closes on overlay click', () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <KeyPickerModal
        providerName="Google"
        modelName="m"
        keys={[k()]}
        onPick={vi.fn()}
        onClose={onClose}
      />
    ));
    const overlay = container.querySelector('.modal-overlay') as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(() => (
      <KeyPickerModal
        providerName="Google"
        modelName="m"
        keys={[k()]}
        onPick={vi.fn()}
        onClose={onClose}
      />
    ));
    fireEvent.click(screen.getByText('Default'));
    // Default's click triggers onPick, not onClose.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes via the × close button', () => {
    const onClose = vi.fn();
    render(() => (
      <KeyPickerModal
        providerName="Google"
        modelName="m"
        keys={[k()]}
        onPick={vi.fn()}
        onClose={onClose}
      />
    ));
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});
