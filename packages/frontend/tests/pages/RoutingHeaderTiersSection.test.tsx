import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@solidjs/testing-library';
import type { HeaderTier } from '../../src/services/api/header-tiers';

const listHeaderTiersMock = vi.fn();
const deleteHeaderTierMock = vi.fn();
const overrideHeaderTierMock = vi.fn();
const resetHeaderTierMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('../../src/services/api/header-tiers.js', () => ({
  listHeaderTiers: (...args: unknown[]) => listHeaderTiersMock(...args),
  deleteHeaderTier: (...args: unknown[]) => deleteHeaderTierMock(...args),
  overrideHeaderTier: (...args: unknown[]) => overrideHeaderTierMock(...args),
  resetHeaderTier: (...args: unknown[]) => resetHeaderTierMock(...args),
}));

vi.mock('../../src/services/toast-store.js', () => ({
  toast: { error: (...args: unknown[]) => toastErrorMock(...args) },
}));

vi.mock('../../src/components/HeaderTierCard.js', () => ({
  default: (props: {
    agentName: string;
    tier: HeaderTier;
    models: unknown[];
    customProviders: unknown[];
    connectedProviders: unknown[];
    onOverride: (m: string, p: string) => void;
    onFallbacksUpdate: () => void;
  }) => (
    <div
      data-testid={`card-${props.tier.id}`}
      data-agent-name={props.agentName}
      data-models-len={props.models.length}
      data-custom-len={props.customProviders.length}
      data-connected-len={props.connectedProviders.length}
    >
      <span>{props.tier.name}</span>
      <button data-testid={`override-${props.tier.id}`} onClick={() => props.onOverride('gpt-4o', 'OpenAI')}>
        override
      </button>
    </div>
  ),
}));

vi.mock('../../src/components/HeaderTierSnippetModal.js', () => ({
  default: (props: { tier: HeaderTier; agentName: string; onClose: () => void }) => (
    <div
      data-testid="mock-snippet-modal"
      data-tier-id={props.tier.id}
      data-agent-name={props.agentName}
    >
      <button data-testid="mock-snippet-close" onClick={props.onClose}>
        close
      </button>
    </div>
  ),
}));

vi.mock('../../src/components/HeaderTierModal.js', () => ({
  default: (props: {
    agentName: string;
    existingTiers: HeaderTier[];
    editing?: HeaderTier;
    onClose: () => void;
    onSaved: (t: HeaderTier) => void;
  }) => (
    <div
      data-testid="mock-modal"
      data-mode={props.editing ? 'edit' : 'create'}
      data-editing-id={props.editing?.id ?? ''}
      data-agent-name={props.agentName}
      data-existing-len={props.existingTiers.length}
    >
      <button
        data-testid="modal-saved"
        onClick={() =>
          props.onSaved({
            id: props.editing?.id ?? 'ht-new',
            agent_id: 'a1',
            name: 'New',
            header_key: 'x',
            header_value: 'y',
            badge_color: 'indigo',
            sort_order: 0,
            override_model: null,
            override_provider: null,
            override_auth_type: null,
            fallback_models: null,
            created_at: '',
            updated_at: '',
          })
        }
      >
        saved
      </button>
      <button data-testid="modal-close" onClick={props.onClose}>
        close
      </button>
    </div>
  ),
}));

import RoutingHeaderTiersSection from '../../src/pages/RoutingHeaderTiersSection';

const baseTier: HeaderTier = {
  id: 'ht-1',
  agent_id: 'a1',
  name: 'Premium',
  header_key: 'x-manifest-tier',
  header_value: 'premium',
  badge_color: 'violet',
  sort_order: 0,
  enabled: true,
  override_model: 'gpt-4o',
  override_provider: 'openai',
  override_auth_type: null,
  fallback_models: null,
  created_at: '',
  updated_at: '',
};

function mount() {
  return render(() => (
    <RoutingHeaderTiersSection
      agentName={() => 'my-agent'}
      models={() => []}
      customProviders={() => []}
      connectedProviders={() => []}
    />
  ));
}

describe('RoutingHeaderTiersSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the empty state when no tiers exist', async () => {
    listHeaderTiersMock.mockResolvedValue([]);
    const { container } = mount();
    await waitFor(() => expect(container.textContent).toContain('No custom tier yet'));
  });

  it('renders a card per tier when tiers load', async () => {
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    const { getByTestId } = mount();
    await waitFor(() => expect(getByTestId('card-ht-1')).toBeDefined());
  });

  it('shows a toast when the list fetch fails', async () => {
    listHeaderTiersMock.mockRejectedValue(new Error('boom'));
    mount();
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('boom'));
  });

  it('opens the modal in create mode when the CTA is clicked', async () => {
    listHeaderTiersMock.mockResolvedValue([]);
    const { getAllByText, getByTestId, queryByTestId } = mount();
    await waitFor(() => getAllByText('Create custom tier'));
    fireEvent.click(getAllByText('Create custom tier')[0]);
    const modal = getByTestId('mock-modal');
    expect(modal.getAttribute('data-mode')).toBe('create');
    expect(modal.getAttribute('data-editing-id')).toBe('');
    fireEvent.click(getByTestId('modal-close'));
    expect(queryByTestId('mock-modal')).toBeNull();
  });

  it('renders cards for enabled tiers', async () => {
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    const { getByTestId } = mount();
    await waitFor(() => expect(getByTestId('card-ht-1')).toBeDefined());
  });

  it('refetches tiers after the modal saves', async () => {
    listHeaderTiersMock.mockResolvedValue([]);
    const { getAllByText, getByTestId } = mount();
    await waitFor(() => getAllByText('Create custom tier'));
    fireEvent.click(getAllByText('Create custom tier')[0]);
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    fireEvent.click(getByTestId('modal-saved'));
    await waitFor(() => expect(listHeaderTiersMock).toHaveBeenCalledTimes(2));
  });

  it('auto-opens the SDK snippet modal after a fresh tier is created', async () => {
    listHeaderTiersMock.mockResolvedValue([]);
    const { getAllByText, getByTestId, queryByTestId } = mount();
    await waitFor(() => getAllByText('Create custom tier'));
    fireEvent.click(getAllByText('Create custom tier')[0]);
    fireEvent.click(getByTestId('modal-saved'));
    await waitFor(() => expect(getByTestId('mock-snippet-modal')).toBeDefined());
    fireEvent.click(getByTestId('mock-snippet-close'));
    expect(queryByTestId('mock-snippet-modal')).toBeNull();
  });

  it('override handler calls the API and refetches', async () => {
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    overrideHeaderTierMock.mockResolvedValue({});
    const { getByTestId } = mount();
    await waitFor(() => getByTestId('card-ht-1'));

    fireEvent.click(getByTestId('override-ht-1'));
    await waitFor(() =>
      expect(overrideHeaderTierMock).toHaveBeenCalledWith('my-agent', 'ht-1', 'gpt-4o', 'OpenAI', undefined),
    );
  });

  it('toasts errors from override handler', async () => {
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    overrideHeaderTierMock.mockRejectedValue(new Error('override fail'));
    const { getByTestId } = mount();
    await waitFor(() => getByTestId('card-ht-1'));

    fireEvent.click(getByTestId('override-ht-1'));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('override fail'));
  });

  it('falls back to a generic load message when the list rejects with a non-Error value', async () => {
    listHeaderTiersMock.mockRejectedValue('plain string');
    mount();
    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to load custom tiers'),
    );
  });

  it('falls back to generic messages when override rejects with non-Error values', async () => {
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    overrideHeaderTierMock.mockRejectedValue('plain string');
    const { getByTestId } = mount();
    await waitFor(() => getByTestId('card-ht-1'));

    fireEvent.click(getByTestId('override-ht-1'));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('Failed to update tier'));
  });
});
