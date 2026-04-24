import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@solidjs/testing-library';
import type { HeaderTier } from '../../src/services/api/header-tiers';

const listHeaderTiersMock = vi.fn();
const deleteHeaderTierMock = vi.fn();
const overrideHeaderTierMock = vi.fn();
const toggleHeaderTierMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('../../src/services/api/header-tiers.js', () => ({
  listHeaderTiers: (...args: unknown[]) => listHeaderTiersMock(...args),
  deleteHeaderTier: (...args: unknown[]) => deleteHeaderTierMock(...args),
  overrideHeaderTier: (...args: unknown[]) => overrideHeaderTierMock(...args),
  toggleHeaderTier: (...args: unknown[]) => toggleHeaderTierMock(...args),
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
    onReset?: () => void;
    onFallbacksUpdate: () => void;
    onEdit?: () => void;
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
      {props.onEdit && (
        <button data-testid={`edit-${props.tier.id}`} onClick={() => props.onEdit!()}>
          edit
        </button>
      )}
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
    onBack?: () => void;
    onDelete?: (id: string) => void;
  }) => (
    <div
      data-testid="mock-modal"
      data-mode={props.editing ? 'edit' : 'create'}
      data-editing-id={props.editing?.id ?? ''}
      data-agent-name={props.agentName}
      data-existing-len={props.existingTiers.length}
      data-has-back={props.onBack ? 'true' : 'false'}
      data-has-delete={props.onDelete ? 'true' : 'false'}
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
            enabled: true,
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
      {props.onBack && (
        <button data-testid="modal-back" onClick={props.onBack}>
          back
        </button>
      )}
      {props.onDelete && (
        <button data-testid="modal-delete" onClick={() => props.onDelete!(props.editing?.id ?? '')}>
          delete
        </button>
      )}
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
    await waitFor(() => expect(container.textContent).toContain('No custom tiers activated'));
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

  /* ── Manage modal ────────────────────────────────── */

  it('opens manage modal when tiers exist and CTA is clicked', async () => {
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    const { container } = mount();
    // Wait for the resource to resolve and show the CTA
    await waitFor(() => expect(container.textContent).toContain('Manage custom routing'));
    fireEvent.click(container.querySelector('.routing-section__cta')!);
    await waitFor(() => {
      expect(container.querySelector('[role="dialog"]')).not.toBeNull();
      expect(container.textContent).toContain('Premium');
      expect(container.textContent).toContain('x-manifest-tier: premium');
    });
  });

  it('closes manage modal on Done click', async () => {
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    const { container, getByText, queryByRole } = mount();
    await waitFor(() => expect(container.textContent).toContain('Manage custom routing'));
    fireEvent.click(container.querySelector('.routing-section__cta')!);
    await waitFor(() => expect(getByText('Done')).toBeDefined());
    fireEvent.click(getByText('Done'));
    await waitFor(() => expect(queryByRole('dialog')).toBeNull());
  });

  it('closes manage modal on Escape', async () => {
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    const { container, queryByRole } = mount();
    await waitFor(() => expect(container.textContent).toContain('Manage custom routing'));
    fireEvent.click(container.querySelector('.routing-section__cta')!);
    await waitFor(() => {
      const overlay = container.querySelector('.modal-overlay');
      expect(overlay).not.toBeNull();
    });
    fireEvent.keyDown(container.querySelector('.modal-overlay')!, { key: 'Escape' });
    await waitFor(() => expect(queryByRole('dialog')).toBeNull());
  });

  it('closes manage modal on overlay click', async () => {
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    const { container, queryByRole } = mount();
    await waitFor(() => expect(container.textContent).toContain('Manage custom routing'));
    fireEvent.click(container.querySelector('.routing-section__cta')!);
    await waitFor(() => {
      expect(container.querySelector('.modal-overlay')).not.toBeNull();
    });
    fireEvent.click(container.querySelector('.modal-overlay')!);
    await waitFor(() => expect(queryByRole('dialog')).toBeNull());
  });

  it('does not close manage modal on dialog card click (stopPropagation)', async () => {
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    const { container, getByRole } = mount();
    await waitFor(() => expect(container.textContent).toContain('Manage custom routing'));
    fireEvent.click(container.querySelector('.routing-section__cta')!);
    await waitFor(() => expect(getByRole('dialog')).toBeDefined());
    fireEvent.click(getByRole('dialog'));
    expect(getByRole('dialog')).toBeDefined();
  });

  it('toggles a tier on/off by clicking the manage modal row', async () => {
    toggleHeaderTierMock.mockResolvedValue({ ...baseTier, enabled: false });
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    const { container } = mount();
    await waitFor(() => expect(container.textContent).toContain('Manage custom routing'));
    fireEvent.click(container.querySelector('.routing-section__cta')!);
    await waitFor(() => expect(container.querySelector('.specificity-modal__row')).not.toBeNull());
    fireEvent.click(container.querySelector('.specificity-modal__row')!);
    await waitFor(() => {
      expect(toggleHeaderTierMock).toHaveBeenCalledWith('my-agent', 'ht-1', false);
    });
  });

  it('toggles a tier via Enter key on manage row', async () => {
    toggleHeaderTierMock.mockResolvedValue({ ...baseTier, enabled: false });
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    const { container } = mount();
    await waitFor(() => expect(container.textContent).toContain('Manage custom routing'));
    fireEvent.click(container.querySelector('.routing-section__cta')!);
    await waitFor(() => expect(container.querySelector('.specificity-modal__row')).not.toBeNull());
    fireEvent.keyDown(container.querySelector('.specificity-modal__row')!, { key: 'Enter' });
    await waitFor(() => {
      expect(toggleHeaderTierMock).toHaveBeenCalledWith('my-agent', 'ht-1', false);
    });
  });

  it('toggles a tier via Space key on manage row', async () => {
    toggleHeaderTierMock.mockResolvedValue({ ...baseTier, enabled: false });
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    const { container } = mount();
    await waitFor(() => expect(container.textContent).toContain('Manage custom routing'));
    fireEvent.click(container.querySelector('.routing-section__cta')!);
    await waitFor(() => expect(container.querySelector('.specificity-modal__row')).not.toBeNull());
    fireEvent.keyDown(container.querySelector('.specificity-modal__row')!, { key: ' ' });
    await waitFor(() => {
      expect(toggleHeaderTierMock).toHaveBeenCalledWith('my-agent', 'ht-1', false);
    });
  });

  it('toasts error when toggle fails', async () => {
    toggleHeaderTierMock.mockRejectedValue(new Error('toggle fail'));
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    const { container } = mount();
    await waitFor(() => expect(container.textContent).toContain('Manage custom routing'));
    fireEvent.click(container.querySelector('.routing-section__cta')!);
    await waitFor(() => expect(container.querySelector('.specificity-modal__row')).not.toBeNull());
    fireEvent.click(container.querySelector('.specificity-modal__row')!);
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('toggle fail'));
  });

  it('toasts generic error when toggle rejects with non-Error', async () => {
    toggleHeaderTierMock.mockRejectedValue('plain');
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    const { container } = mount();
    await waitFor(() => expect(container.textContent).toContain('Manage custom routing'));
    fireEvent.click(container.querySelector('.routing-section__cta')!);
    await waitFor(() => expect(container.querySelector('.specificity-modal__row')).not.toBeNull());
    fireEvent.click(container.querySelector('.specificity-modal__row')!);
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('Failed to toggle tier'));
  });

  it('opens edit modal from the card edit button', async () => {
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    const { getByTestId } = mount();
    await waitFor(() => expect(getByTestId('edit-ht-1')).toBeDefined());
    fireEvent.click(getByTestId('edit-ht-1'));
    await waitFor(() => {
      const modal = getByTestId('mock-modal');
      expect(modal.getAttribute('data-mode')).toBe('edit');
      expect(modal.getAttribute('data-editing-id')).toBe('ht-1');
      expect(modal.getAttribute('data-has-delete')).toBe('true');
      expect(modal.getAttribute('data-has-back')).toBe('false');
    });
  });

  it('delete from edit removes tier and closes modal', async () => {
    deleteHeaderTierMock.mockResolvedValue({});
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    const { getByTestId, queryByTestId } = mount();
    await waitFor(() => expect(getByTestId('edit-ht-1')).toBeDefined());
    fireEvent.click(getByTestId('edit-ht-1'));
    await waitFor(() => getByTestId('modal-delete'));
    fireEvent.click(getByTestId('modal-delete'));
    await waitFor(() => {
      expect(deleteHeaderTierMock).toHaveBeenCalledWith('my-agent', 'ht-1');
      expect(queryByTestId('mock-modal')).toBeNull();
    });
  });

  it('delete handler toasts error on failure', async () => {
    deleteHeaderTierMock.mockRejectedValue(new Error('delete fail'));
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    const { getByTestId } = mount();
    await waitFor(() => expect(getByTestId('edit-ht-1')).toBeDefined());
    fireEvent.click(getByTestId('edit-ht-1'));
    await waitFor(() => getByTestId('modal-delete'));
    fireEvent.click(getByTestId('modal-delete'));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('delete fail'));
  });

  it('create-new-tier button from manage modal opens create modal', async () => {
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    const { container, getByText, getByTestId } = mount();
    await waitFor(() => expect(container.textContent).toContain('Manage custom routing'));
    fireEvent.click(container.querySelector('.routing-section__cta')!);
    await waitFor(() => getByText('Create new tier'));
    fireEvent.click(getByText('Create new tier'));
    await waitFor(() => {
      const modal = getByTestId('mock-modal');
      expect(modal.getAttribute('data-mode')).toBe('create');
      expect(modal.getAttribute('data-has-back')).toBe('false');
    });
  });

  it('shows empty-state "Manage custom routing" button when tiers exist but none are enabled', async () => {
    const disabledTier = { ...baseTier, enabled: false };
    listHeaderTiersMock.mockResolvedValue([disabledTier]);
    const { container } = mount();
    await waitFor(() => {
      expect(container.textContent).toContain('No custom tiers activated');
      expect(container.textContent).toContain('Manage custom routing');
    });
  });

  it('edit modal onSaved from edit mode does not open snippet modal', async () => {
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    const { getByTestId, queryByTestId } = mount();
    await waitFor(() => expect(getByTestId('edit-ht-1')).toBeDefined());
    fireEvent.click(getByTestId('edit-ht-1'));
    await waitFor(() => getByTestId('modal-saved'));
    listHeaderTiersMock.mockResolvedValue([baseTier]);
    fireEvent.click(getByTestId('modal-saved'));
    await waitFor(() => {
      expect(queryByTestId('mock-snippet-modal')).toBeNull();
    });
  });
});
