import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@solidjs/testing-library';
import type { HeaderTier } from '../../src/services/api/header-tiers';

const createHeaderTierMock = vi.fn();
const updateHeaderTierMock = vi.fn();
const getSeenHeadersMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('../../src/services/api/header-tiers.js', () => ({
  createHeaderTier: (...args: unknown[]) => createHeaderTierMock(...args),
  updateHeaderTier: (...args: unknown[]) => updateHeaderTierMock(...args),
  getSeenHeaders: (...args: unknown[]) => getSeenHeadersMock(...args),
}));

// Mock HeaderComboBox to render every suggestion's label and sublabel so the
// modal's keySuggestions/valueSuggestions accessors are exercised end-to-end.
vi.mock('../../src/components/HeaderComboBox.js', () => ({
  default: (props: {
    id?: string;
    value: string;
    onInput: (v: string) => void;
    suggestions: { label: string; value: string; group?: string; sublabel?: string }[];
    placeholder?: string;
    invalid?: boolean;
    errorMessage?: string;
    disabled?: boolean;
    freeFormHint?: string;
  }) => (
    <div
      data-testid={`combo-${props.id ?? 'x'}`}
      data-disabled={props.disabled ? 'true' : 'false'}
      data-hint={props.freeFormHint ?? ''}
    >
      <input
        type="text"
        placeholder={props.placeholder}
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
      />
      {props.invalid && props.errorMessage ? (
        <div class="combo-error">{props.errorMessage}</div>
      ) : null}
      <ul>
        {props.suggestions.map((s) => (
          <li data-group={s.group ?? ''} data-sublabel={s.sublabel ?? ''}>
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  ),
}));

vi.mock('../../src/services/toast-store.js', () => ({
  toast: { error: (...args: unknown[]) => toastErrorMock(...args) },
}));

import HeaderTierModal from '../../src/components/HeaderTierModal';

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

interface MountOptions {
  existing?: HeaderTier[];
  editing?: HeaderTier;
  onClose?: () => void;
  onSaved?: (t: HeaderTier) => void;
  onBack?: () => void;
  onDelete?: (id: string) => void;
}

function mount(options: MountOptions = {}) {
  const onClose = options.onClose ?? vi.fn();
  const onSaved = options.onSaved ?? vi.fn();
  const result = render(() => (
    <HeaderTierModal
      agentName="my-agent"
      existingTiers={options.existing ?? []}
      editing={options.editing}
      onClose={onClose}
      onSaved={onSaved}
      onBack={options.onBack}
      onDelete={options.onDelete}
    />
  ));
  return { ...result, onClose, onSaved };
}

describe('HeaderTierModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSeenHeadersMock.mockResolvedValue([
      { key: 'x-manifest-tier', count: 3, top_values: ['premium', 'free'], sdks: ['openai-js'] },
    ]);
  });

  describe('create mode', () => {
    it('uses the create title and submit label', () => {
      const { getByText } = mount();
      expect(getByText('Create custom tier')).toBeDefined();
      expect(getByText('Create tier')).toBeDefined();
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
      fireEvent.input(getByPlaceholderText('x-manifest-tier'), { target: { value: 'authorization' } });
      fireEvent.input(getByPlaceholderText('premium'), { target: { value: 'x' } });
      fireEvent.click(getByText('Create tier'));
      expect(container.textContent).toContain('stripped for security');
      expect(createHeaderTierMock).not.toHaveBeenCalled();
    });

    it('rejects a header key with invalid characters', () => {
      const { container, getByText, getByPlaceholderText } = mount();
      fireEvent.input(container.querySelector('input[type="text"]')!, { target: { value: 'Test' } });
      fireEvent.input(getByPlaceholderText('x-manifest-tier'), { target: { value: 'X_BAD' } });
      fireEvent.input(getByPlaceholderText('premium'), { target: { value: 'v' } });
      fireEvent.click(getByText('Create tier'));
      expect(container.textContent).toContain(
        'Header keys can only contain lowercase letters, digits, and hyphens',
      );
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

    it('submits a valid form and calls onSaved + onClose on success', async () => {
      const created: HeaderTier = { ...baseTier, id: 'ht-new', name: 'Premium' };
      createHeaderTierMock.mockResolvedValue(created);
      const { getByText, getByPlaceholderText, container, onSaved, onClose } = mount();
      const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
      fireEvent.input(nameInput, { target: { value: 'Premium' } });
      fireEvent.input(getByPlaceholderText('x-manifest-tier'), { target: { value: 'x-manifest-tier' } });
      fireEvent.input(getByPlaceholderText('premium'), { target: { value: 'premium' } });
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
      expect(updateHeaderTierMock).not.toHaveBeenCalled();
      expect(onSaved).toHaveBeenCalledWith(created);
      expect(onClose).toHaveBeenCalled();
    });

    it('toasts a create-specific error when the API rejects', async () => {
      createHeaderTierMock.mockRejectedValue(new Error('boom'));
      const { getByText, getByPlaceholderText, container } = mount();
      const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
      fireEvent.input(nameInput, { target: { value: 'X' } });
      fireEvent.input(getByPlaceholderText('x-manifest-tier'), { target: { value: 'x-a' } });
      fireEvent.input(getByPlaceholderText('premium'), { target: { value: 'a' } });
      fireEvent.click(getByText('Create tier'));
      await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('boom'));
    });

    it('falls back to a generic create error message when the rejection has no message', async () => {
      createHeaderTierMock.mockRejectedValue('plain string');
      const { getByText, getByPlaceholderText, container } = mount();
      const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
      fireEvent.input(nameInput, { target: { value: 'X' } });
      fireEvent.input(getByPlaceholderText('x-manifest-tier'), { target: { value: 'x-a' } });
      fireEvent.input(getByPlaceholderText('premium'), { target: { value: 'a' } });
      fireEvent.click(getByText('Create tier'));
      await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('Failed to create tier'));
    });

    it('rejects names longer than 32 characters', () => {
      const { container, getByText, getByPlaceholderText } = mount();
      const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
      fireEvent.input(nameInput, { target: { value: 'a'.repeat(33) } });
      fireEvent.input(getByPlaceholderText('x-manifest-tier'), { target: { value: 'x-a' } });
      fireEvent.input(getByPlaceholderText('premium'), { target: { value: 'a' } });
      fireEvent.click(getByText('Create tier'));
      expect(container.textContent).toContain('Name must be 32 characters or fewer');
      expect(createHeaderTierMock).not.toHaveBeenCalled();
    });

    it('rejects header values longer than 128 characters', () => {
      const { container, getByText, getByPlaceholderText } = mount();
      const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
      fireEvent.input(nameInput, { target: { value: 'Name' } });
      fireEvent.input(getByPlaceholderText('x-manifest-tier'), { target: { value: 'x-a' } });
      fireEvent.input(getByPlaceholderText('premium'), { target: { value: 'v'.repeat(129) } });
      fireEvent.click(getByText('Create tier'));
      expect(container.textContent).toContain('Header value must be 128 characters or fewer');
      expect(createHeaderTierMock).not.toHaveBeenCalled();
    });

    it('rejects header values containing quotes or backslashes (would break SDK snippets)', () => {
      for (const bad of ['has"quote', "has'quote", 'has\\backslash']) {
        const { container, getByText, getByPlaceholderText, unmount } = mount();
        const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
        fireEvent.input(nameInput, { target: { value: 'Name' } });
        fireEvent.input(getByPlaceholderText('x-manifest-tier'), { target: { value: 'x-a' } });
        fireEvent.input(getByPlaceholderText('premium'), { target: { value: bad } });
        fireEvent.click(getByText('Create tier'));
        expect(container.textContent).toContain('cannot contain quotes or backslashes');
        expect(createHeaderTierMock).not.toHaveBeenCalled();
        unmount();
      }
    });

    it('shows a "Creating…" label while the create request is in flight', async () => {
      let resolve!: (t: HeaderTier) => void;
      createHeaderTierMock.mockReturnValue(
        new Promise<HeaderTier>((r) => {
          resolve = r;
        }),
      );
      const { getByText, getByPlaceholderText, container } = mount();
      const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
      fireEvent.input(nameInput, { target: { value: 'Name' } });
      fireEvent.input(getByPlaceholderText('x-manifest-tier'), { target: { value: 'x-a' } });
      fireEvent.input(getByPlaceholderText('premium'), { target: { value: 'a' } });
      fireEvent.click(getByText('Create tier'));
      await waitFor(() => expect(getByText('Creating…')).toBeDefined());
      const submitBtn = getByText('Creating…') as HTMLButtonElement;
      expect(submitBtn.hasAttribute('disabled')).toBe(true);
      resolve({ ...baseTier, id: 'ht-new' });
      await waitFor(() => expect(createHeaderTierMock).toHaveBeenCalled());
    });
  });

  describe('edit mode', () => {
    it('uses the edit title and submit label', () => {
      const { getByText } = mount({ editing: baseTier });
      expect(getByText('Edit custom tier')).toBeDefined();
      expect(getByText('Save changes')).toBeDefined();
    });

    it('prefills the form fields from the tier', () => {
      const { container } = mount({ editing: { ...baseTier, badge_color: 'rose' } });
      expect((container.querySelector('input[type="text"]') as HTMLInputElement).value).toBe(
        'Existing',
      );
      expect(
        (container.querySelector('input[placeholder="x-manifest-tier"]') as HTMLInputElement).value,
      ).toBe('x-existing');
      expect(
        (container.querySelector('input[placeholder="premium"]') as HTMLInputElement).value,
      ).toBe('yes');
      expect(
        container.querySelector('.header-tier-modal__swatch--rose')!.getAttribute('aria-checked'),
      ).toBe('true');
    });

    it('excludes the edited tier from uniqueness checks', () => {
      const { container, getByText } = mount({
        existing: [baseTier],
        editing: baseTier,
      });
      // Resubmitting unchanged should not flag the tier as duplicating itself.
      fireEvent.click(getByText('Save changes'));
      expect(container.textContent).not.toContain('already exists');
      expect(container.textContent).not.toContain('already matches');
    });

    it('still flags duplicates against other tiers', () => {
      const sibling: HeaderTier = { ...baseTier, id: 'ht-2', name: 'Other', header_value: 'no' };
      const { container, getByText } = mount({
        existing: [baseTier, sibling],
        editing: baseTier,
      });
      const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
      fireEvent.input(nameInput, { target: { value: 'Other' } });
      fireEvent.click(getByText('Save changes'));
      expect(container.textContent).toContain('A tier with this name already exists');
    });

    it('calls updateHeaderTier on submit and forwards the saved tier to onSaved', async () => {
      const saved: HeaderTier = { ...baseTier, name: 'Renamed' };
      updateHeaderTierMock.mockResolvedValue(saved);
      const { container, getByText, onSaved, onClose } = mount({ editing: baseTier });
      const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
      fireEvent.input(nameInput, { target: { value: 'Renamed' } });
      fireEvent.click(getByText('Save changes'));
      await waitFor(() => expect(updateHeaderTierMock).toHaveBeenCalled());
      expect(updateHeaderTierMock.mock.calls[0]).toEqual([
        'my-agent',
        'ht-1',
        {
          name: 'Renamed',
          header_key: 'x-existing',
          header_value: 'yes',
          badge_color: 'indigo',
        },
      ]);
      expect(createHeaderTierMock).not.toHaveBeenCalled();
      expect(onSaved).toHaveBeenCalledWith(saved);
      expect(onClose).toHaveBeenCalled();
    });

    it('toasts an edit-specific error when the API rejects', async () => {
      updateHeaderTierMock.mockRejectedValue(new Error('nope'));
      const { container, getByText } = mount({ editing: baseTier });
      const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
      fireEvent.input(nameInput, { target: { value: 'X' } });
      fireEvent.click(getByText('Save changes'));
      await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('nope'));
    });

    it('falls back to a generic update error message when the rejection has no message', async () => {
      updateHeaderTierMock.mockRejectedValue('plain string');
      const { container, getByText } = mount({ editing: baseTier });
      const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
      fireEvent.input(nameInput, { target: { value: 'X' } });
      fireEvent.click(getByText('Save changes'));
      await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('Failed to update tier'));
    });

    it('shows a "Saving…" label while the update request is in flight', async () => {
      let resolve!: (t: HeaderTier) => void;
      updateHeaderTierMock.mockReturnValue(
        new Promise<HeaderTier>((r) => {
          resolve = r;
        }),
      );
      const { getByText } = mount({ editing: baseTier });
      fireEvent.click(getByText('Save changes'));
      await waitFor(() => expect(getByText('Saving…')).toBeDefined());
      const submitBtn = getByText('Saving…') as HTMLButtonElement;
      expect(submitBtn.hasAttribute('disabled')).toBe(true);
      resolve(baseTier);
      await waitFor(() => expect(updateHeaderTierMock).toHaveBeenCalled());
    });
  });

  describe('chrome', () => {
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

    it('still renders when the seen-headers fetch rejects', async () => {
      getSeenHeadersMock.mockRejectedValueOnce(new Error('seen-fail'));
      const { getByText } = mount();
      await waitFor(() => expect(getByText('Create custom tier')).toBeDefined());
    });

    it('renders seen-header suggestions with top values formatted as "N× · v1 · v2"', async () => {
      getSeenHeadersMock.mockResolvedValueOnce([
        { key: 'x-tier', count: 7, top_values: ['gold', 'silver'], sdks: ['sdk-a'] },
      ]);
      const { container } = mount();
      await waitFor(() => {
        const li = container.querySelector('li[data-sublabel]');
        expect(li?.getAttribute('data-sublabel')).toBe('7× · gold · silver');
        expect(li?.getAttribute('data-group')).toBe('sdk-a');
      });
    });

    it('renders seen-header suggestions with "N× seen" sublabel when no top values are present', async () => {
      getSeenHeadersMock.mockResolvedValueOnce([
        { key: 'x-empty', count: 4, top_values: [], sdks: ['sdk-b'] },
      ]);
      const { container } = mount();
      await waitFor(() => {
        const li = container.querySelector('li[data-sublabel]');
        expect(li?.getAttribute('data-sublabel')).toBe('4× seen');
      });
    });

    it('renders back button when onBack is provided', () => {
      const onBack = vi.fn();
      const { container } = mount({ editing: baseTier, onBack });
      const backBtn = container.querySelector('[aria-label="Back"]');
      expect(backBtn).not.toBeNull();
      fireEvent.click(backBtn!);
      expect(onBack).toHaveBeenCalled();
    });

    it('renders delete button when onDelete and editing are provided', () => {
      const onDelete = vi.fn();
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
      const { getByText } = mount({ editing: baseTier, onDelete });
      fireEvent.click(getByText('Delete tier'));
      expect(onDelete).toHaveBeenCalledWith('ht-1');
      vi.unstubAllGlobals();
    });

    it('does not call onDelete when confirm is cancelled', () => {
      const onDelete = vi.fn();
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
      const { getByText } = mount({ editing: baseTier, onDelete });
      fireEvent.click(getByText('Delete tier'));
      expect(onDelete).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });
  });
});
