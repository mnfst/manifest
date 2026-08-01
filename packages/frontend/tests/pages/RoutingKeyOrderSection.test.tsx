import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, screen, within } from '@solidjs/testing-library';
import RoutingKeyOrderSection from '../../src/pages/RoutingKeyOrderSection.js';
import type { KeyRotationRule } from 'manifest-shared';
import type { RoutingProvider } from '../../src/services/api.js';

// ── API mocks ───────────────────────────────────────────────────────────────
const mockListKeyRules = vi.fn(() => Promise.resolve({ rules: [] }));
const mockSaveKeyRules = vi.fn((_agentName: string, rules: unknown[]) =>
  Promise.resolve({ rules }),
);

vi.mock('../../src/services/api/key-rules.js', () => ({
  listKeyRules: (...args: unknown[]) => mockListKeyRules(...args),
  saveKeyRules: (...args: unknown[]) => mockSaveKeyRules(...args),
}));

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock('../../src/services/toast-store.js', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
    warning: () => undefined,
  },
}));

// ── Fixtures ────────────────────────────────────────────────────────────────

/** 4 active api_key chains for the gemini provider, labels Key 1..Key 4. */
function geminiKeyProviders(): RoutingProvider[] {
  return ['Key 1', 'Key 2', 'Key 3', 'Key 4'].map((label, priority) => ({
    id: `gemini-${priority}`,
    provider: 'gemini',
    auth_type: 'api_key' as const,
    is_active: true,
    has_api_key: true,
    label,
    priority,
    connected_at: '2026-01-01T00:00:00.000Z',
  }));
}

function modelRule(overrides: Partial<KeyRotationRule> = {}): KeyRotationRule {
  return {
    id: 'rule-model-1',
    agentId: 'test-agent',
    model: 'gemini-2.5-pro',
    provider: 'gemini',
    scope: 'model',
    keyOrder: ['Key 1', 'Key 2'],
    ...overrides,
  };
}

function providerRule(overrides: Partial<KeyRotationRule> = {}): KeyRotationRule {
  return {
    id: 'rule-provider-1',
    agentId: 'test-agent',
    model: null,
    provider: 'gemini',
    scope: 'provider',
    keyOrder: ['Key 1', 'Key 2'],
    ...overrides,
  };
}

function renderSection(
  connectedProviders: () => RoutingProvider[] = geminiKeyProviders,
) {
  return render(() => (
    <RoutingKeyOrderSection
      agentName={() => 'test-agent'}
      models={() => []}
      connectedProviders={connectedProviders}
      customProviders={() => []}
    />
  ));
}

async function openAddRuleModal() {
  renderSection();
  await waitFor(() => screen.getByText('No key order rules yet'));
  // Both the section CTA and the empty-state button say "Add rule"; either opens
  // the create modal.
  const addRuleButtons = screen.getAllByRole('button', { name: /add rule/i });
  fireEvent.click(addRuleButtons[0]!);
  await waitFor(() => screen.getByRole('dialog'));
}

/** Add `label` through the add-key control (select or last-key button). */
async function addKeyThroughControl(label: string) {
  const combobox = screen.queryByRole('combobox', { name: /add a key/i }) as
    | HTMLSelectElement
    | null;
  if (combobox && !combobox.disabled) {
    fireEvent.change(combobox, { target: { value: label } });
  } else {
    const button = screen.getByRole('button', { name: new RegExp(`add ${label}`, 'i') });
    fireEvent.click(button);
  }
  await waitFor(() => screen.getByText(label));
}

/** Save through the modal footer and return the PUT body of the first call. */
async function saveFromDialog(): Promise<Array<{
  model: string | null;
  provider: string;
  scope: string;
  keyOrder: string[];
}>> {
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add rule' }));
  await waitFor(() => {
    expect(mockSaveKeyRules).toHaveBeenCalledTimes(1);
  });
  return mockSaveKeyRules.mock.calls[0]![1] as Array<{
    model: string | null;
    provider: string;
    scope: string;
    keyOrder: string[];
  }>;
}

beforeEach(() => {
  mockListKeyRules.mockClear();
  mockSaveKeyRules.mockClear();
  mockToastError.mockClear();
  mockToastSuccess.mockClear();
});

describe('RoutingKeyOrderSection key-order editor', () => {
  it('lets the user add all 4 key labels, including the last remaining one', async () => {
    await openAddRuleModal();

    // Pick the provider and type a model so the key editor is usable.
    fireEvent.change(screen.getByLabelText('Provider'), {
      target: { value: 'gemini' },
    });
    fireEvent.input(screen.getByLabelText('Model'), {
      target: { value: 'gemini-2.5-pro' },
    });

    // Add the first three keys through the "Add a key…" select.
    for (const label of ['Key 1', 'Key 2', 'Key 3']) {
      await addKeyThroughControl(label);
    }

    // Only one label remains. The dead single-option select must be replaced
    // by a clickable "Add Key 4" button (regression for the last-key bug).
    expect(screen.queryByRole('combobox', { name: /add a key/i })).toBeNull();
    const lastKeyButton = screen.getByRole('button', { name: /add key 4/i });
    expect(lastKeyButton).toBeTruthy();
    fireEvent.click(lastKeyButton);

    await waitFor(() => {
      expect(screen.getByText('Key 4')).toBeTruthy();
    });

    // All four keys are now in the order; the editor shows the exhausted state.
    for (const label of ['Key 1', 'Key 2', 'Key 3', 'Key 4']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: /add key/i })).toBeNull();
    const exhausted = screen.getByRole('combobox', { name: /add a key/i }) as HTMLSelectElement;
    expect(exhausted.disabled).toBe(true);
    expect(screen.getByText('No more keys to add')).toBeTruthy();

    // Save the rule — the full ordered list goes out in one PUT, scoped to
    // the default 'model' tier.
    const body = await saveFromDialog();
    expect(body).toHaveLength(1);
    expect(body[0]!.scope).toBe('model');
    expect(body[0]!.model).toBe('gemini-2.5-pro');
    expect(body[0]!.provider).toBe('gemini');
    expect(body[0]!.keyOrder).toEqual(['Key 1', 'Key 2', 'Key 3', 'Key 4']);
  });

  it('adds the last remaining key via the Enter key on the button', async () => {
    await openAddRuleModal();

    fireEvent.change(screen.getByLabelText('Provider'), {
      target: { value: 'gemini' },
    });
    fireEvent.input(screen.getByLabelText('Model'), {
      target: { value: 'gemini-2.5-pro' },
    });

    for (const label of ['Key 1', 'Key 2', 'Key 3']) {
      await addKeyThroughControl(label);
    }

    const lastKeyButton = screen.getByRole('button', { name: /add key 4/i });
    // Enter on the last-key button must add the key (and must NOT submit the
    // rule or close the modal).
    fireEvent.keyDown(lastKeyButton, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Key 4')).toBeTruthy();
    });
    expect(mockSaveKeyRules).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('saves a provider rule with scope provider and model null', async () => {
    await openAddRuleModal();

    // Switch the scope to the provider tier; the model field disappears.
    fireEvent.click(screen.getByRole('radio', { name: /^provider rule/i }));
    fireEvent.change(screen.getByLabelText('Provider'), {
      target: { value: 'gemini' },
    });
    expect(screen.queryByLabelText('Model')).toBeNull();

    await addKeyThroughControl('Key 1');
    await addKeyThroughControl('Key 2');

    const body = await saveFromDialog();
    expect(body).toHaveLength(1);
    expect(body[0]!.scope).toBe('provider');
    expect(body[0]!.model).toBeNull();
    expect(body[0]!.provider).toBe('gemini');
    expect(body[0]!.keyOrder).toEqual(['Key 1', 'Key 2']);
  });

  it('blocks a duplicate model rule in the modal', async () => {
    mockListKeyRules.mockResolvedValue({ rules: [modelRule()] });
    renderSection();
    await waitFor(() => screen.getByText('gemini-2.5-pro'));

    fireEvent.click(screen.getAllByRole('button', { name: /add rule/i })[0]!);
    await waitFor(() => screen.getByRole('dialog'));

    fireEvent.change(screen.getByLabelText('Provider'), {
      target: { value: 'gemini' },
    });
    fireEvent.input(screen.getByLabelText('Model'), {
      target: { value: 'gemini-2.5-pro' },
    });
    await addKeyThroughControl('Key 3');

    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add rule' }));

    await waitFor(() => screen.getByText('A rule for this model already exists'));
    expect(mockSaveKeyRules).not.toHaveBeenCalled();
  });

  it('blocks a duplicate provider rule in the modal', async () => {
    mockListKeyRules.mockResolvedValue({ rules: [providerRule()] });
    renderSection();
    await waitFor(() => screen.getByText('Provider rules'));

    fireEvent.click(screen.getAllByRole('button', { name: /add rule/i })[0]!);
    await waitFor(() => screen.getByRole('dialog'));

    fireEvent.click(screen.getByRole('radio', { name: /^provider rule/i }));
    fireEvent.change(screen.getByLabelText('Provider'), {
      target: { value: 'gemini' },
    });
    await addKeyThroughControl('Key 3');

    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add rule' }));

    await waitFor(() => screen.getByText('A provider rule for this provider already exists'));
    expect(mockSaveKeyRules).not.toHaveBeenCalled();
  });

  it('renders provider rules and model overrides as separate tiers', async () => {
    mockListKeyRules.mockResolvedValue({
      rules: [providerRule(), modelRule()],
    });
    renderSection();

    // Both tier headers are visible.
    await waitFor(() => screen.getByText('Provider rules'));
    expect(screen.getByText('Model overrides')).toBeTruthy();

    // The provider card is titled by the provider display name and says
    // "All models"; the model card is titled by the model identity.
    expect(screen.getByText('Google')).toBeTruthy();
    expect(screen.getByText(/All models · 4 keys/)).toBeTruthy();
    expect(screen.getByText('gemini-2.5-pro')).toBeTruthy();
  });

  it('shows a passive empty note for a tier with no rules', async () => {
    mockListKeyRules.mockResolvedValue({ rules: [providerRule()] });
    renderSection();

    await waitFor(() => screen.getByText('Provider rules'));
    expect(
      screen.getByText(/No model overrides yet — add one to pin keys for a single model/),
    ).toBeTruthy();
  });
});
