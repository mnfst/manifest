import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@solidjs/testing-library';
import type { HeaderTier } from '../../src/services/api/header-tiers';

const createHeaderTierMock = vi.fn();
const getSeenHeadersMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('../../src/services/api/header-tiers.js', () => ({
  createHeaderTier: (...args: unknown[]) => createHeaderTierMock(...args),
  getSeenHeaders: (...args: unknown[]) => getSeenHeadersMock(...args),
}));

vi.mock('../../src/services/toast-store.js', () => ({
  toast: { error: (...args: unknown[]) => toastErrorMock(...args) },
}));

import CreateHeaderTierModal from '../../src/components/CreateHeaderTierModal';

const baseTier: HeaderTier = {
  id: 'ht-1',
  agent_id: 'a1',
  name: 'Existing',
  header_key: 'x-existing',
  header_value: 'yes',
  badge_color: 'indigo',
  sort_order: 0,
  override_model: null,
  override_provider: null,
  override_auth_type: null,
  fallback_models: null,
  created_at: '2026-04-21',
  updated_at: '2026-04-21',
};

function mount(options: { existing?: HeaderTier[]; onClose?: () => void; onCreated?: (t: HeaderTier) => void } = {}) {
  const onClose = options.onClose ?? vi.fn();
  const onCreated = options.onCreated ?? vi.fn();
  const result = render(() => (
    <CreateHeaderTierModal
      agentName="my-agent"
      existingTiers={options.existing ?? []}
      onClose={onClose}
      onCreated={onCreated}
    />
  ));
  return { ...result, onClose, onCreated };
}

describe('CreateHeaderTierModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSeenHeadersMock.mockResolvedValue([
      { key: 'x-manifest-tier', count: 3, top_values: ['premium', 'free'], sdks: ['openai-js'] },
    ]);
  });

  it('shows validation errors when submitted empty', () => {
    const { container, getByText } = mount();
    fireEvent.click(getByText('Create tier'));
    expect(container.textContent).toContain('Name is required');
    expect(container.textContent).toContain('Header key is required');
    expect(container.textContent).toContain('Header value is required');
    expect(createHeaderTierMock).not.toHaveBeenCalled();
  });

  it('rejects a deny-listed header key', () => {
    const { container, getByText, getByPlaceholderText } = mount();
    fireEvent.input(container.querySelector('input[type="text"]')!, { target: { value: 'Test' } });
    // Header key combobox input
    const keyInput = getByPlaceholderText('x-manifest-tier') as HTMLInputElement;
    fireEvent.input(keyInput, { target: { value: 'authorization' } });
    const valueInput = getByPlaceholderText('premium') as HTMLInputElement;
    fireEvent.input(valueInput, { target: { value: 'x' } });
    fireEvent.click(getByText('Create tier'));
    expect(container.textContent).toContain("stripped for security");
    expect(createHeaderTierMock).not.toHaveBeenCalled();
  });

  it('rejects duplicate tier name (case-insensitive)', () => {
    const { container, getByText, getByPlaceholderText } = mount({ existing: [baseTier] });
    const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.input(nameInput, { target: { value: 'EXISTING' } });
    fireEvent.input(getByPlaceholderText('x-manifest-tier'), { target: { value: 'x-new' } });
    fireEvent.input(getByPlaceholderText('premium'), { target: { value: 'v' } });
    fireEvent.click(getByText('Create tier'));
    expect(container.textContent).toContain('A tier with this name already exists');
  });

  it('rejects duplicate (key, value) rule', () => {
    const { container, getByText, getByPlaceholderText } = mount({ existing: [baseTier] });
    const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.input(nameInput, { target: { value: 'New Name' } });
    fireEvent.input(getByPlaceholderText('x-manifest-tier'), { target: { value: 'x-existing' } });
    fireEvent.input(getByPlaceholderText('premium'), { target: { value: 'yes' } });
    fireEvent.click(getByText('Create tier'));
    expect(container.textContent).toContain('already matches this header key and value');
  });

  it('submits a valid form and calls onCreated + onClose on success', async () => {
    const created: HeaderTier = { ...baseTier, id: 'ht-new', name: 'Premium' };
    createHeaderTierMock.mockResolvedValue(created);
    const { getByText, getByPlaceholderText, container, onCreated, onClose } = mount();
    const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.input(nameInput, { target: { value: 'Premium' } });
    fireEvent.input(getByPlaceholderText('x-manifest-tier'), { target: { value: 'x-manifest-tier' } });
    fireEvent.input(getByPlaceholderText('premium'), { target: { value: 'premium' } });
    // pick a non-default color
    const violet = container.querySelector('.header-tier-modal__swatch--violet') as HTMLElement;
    fireEvent.click(violet);
    fireEvent.click(getByText('Create tier'));
    await waitFor(() => expect(createHeaderTierMock).toHaveBeenCalled());
    expect(createHeaderTierMock.mock.calls[0][1]).toMatchObject({
      name: 'Premium',
      header_key: 'x-manifest-tier',
      header_value: 'premium',
      badge_color: 'violet',
    });
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(onClose).toHaveBeenCalled();
  });

  it('toasts an error when the API rejects the create call', async () => {
    createHeaderTierMock.mockRejectedValue(new Error('Name is required'));
    const { getByText, getByPlaceholderText, container } = mount();
    const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.input(nameInput, { target: { value: 'X' } });
    fireEvent.input(getByPlaceholderText('x-manifest-tier'), { target: { value: 'x-a' } });
    fireEvent.input(getByPlaceholderText('premium'), { target: { value: 'a' } });
    fireEvent.click(getByText('Create tier'));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('Name is required'));
  });

  it('closes when the backdrop is clicked', () => {
    const { container, onClose } = mount();
    fireEvent.click(container.querySelector('.header-tier-modal-backdrop')!);
    expect(onClose).toHaveBeenCalled();
  });

  it('close button fires onClose', () => {
    const { container, onClose } = mount();
    fireEvent.click(container.querySelector('.header-tier-modal__close')!);
    expect(onClose).toHaveBeenCalled();
  });
});
