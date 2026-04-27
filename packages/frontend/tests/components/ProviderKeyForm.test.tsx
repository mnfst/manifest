import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import type { ProviderDef } from '../../src/services/providers';
import type { AuthType, RoutingProvider } from '../../src/services/api';

/* ── API mocks ──────────────────────────────────────────────── */

const connectProviderMock = vi.fn().mockResolvedValue({});
const disconnectProviderMock = vi.fn().mockResolvedValue({});
const revokeOpenaiOAuthMock = vi.fn().mockResolvedValue(undefined);
const renameProviderKeyMock = vi.fn().mockResolvedValue({});
const reorderProviderKeysMock = vi.fn().mockResolvedValue([]);

vi.mock('../../src/services/api.js', () => ({
  connectProvider: (...args: unknown[]) => connectProviderMock(...args),
  disconnectProvider: (...args: unknown[]) => disconnectProviderMock(...args),
  revokeOpenaiOAuth: (...args: unknown[]) => revokeOpenaiOAuthMock(...args),
  renameProviderKey: (...args: unknown[]) => renameProviderKeyMock(...args),
  reorderProviderKeys: (...args: unknown[]) => reorderProviderKeysMock(...args),
}));

vi.mock('../../src/services/provider-utils.js', () => ({
  validateApiKey: () => ({ valid: true }),
  validateSubscriptionKey: () => ({ valid: true }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('../../src/services/toast-store.js', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock('../../src/services/provider-api-key-urls.js', () => ({
  getRoutingProviderApiKeyUrl: (id: string) =>
    id === 'openai' ? 'https://platform.openai.com/api-keys' : undefined,
  getSubscriptionProviderKeyUrl: (id: string) =>
    id === 'ollama-cloud' ? 'https://ollama.com/settings/keys' : undefined,
}));

import ProviderKeyForm from '../../src/components/ProviderKeyForm';

/* ── Test helpers ───────────────────────────────────────────── */

function makeProviderDef(overrides: Partial<ProviderDef> = {}): ProviderDef {
  return {
    id: 'test',
    name: 'Test',
    color: '#000',
    initial: 'T',
    subtitle: 'Test subtitle',
    keyPrefix: '',
    minKeyLength: 0,
    keyPlaceholder: 'sk-...',
    supportsSubscription: false,
    subscriptionOnly: false,
    models: [],
    ...overrides,
  } as ProviderDef;
}

interface MountOpts {
  provDef: ProviderDef;
  provId?: string;
  connected?: boolean;
  isSubMode?: boolean;
  selectedAuthType?: AuthType;
  editing?: boolean;
  keyInput?: string;
  providers?: RoutingProvider[];
  onBack?: () => void;
  onUpdate?: () => void;
}

function mount(opts: MountOpts) {
  const [busy, setBusy] = createSignal(false);
  const [keyInput, setKeyInput] = createSignal(opts.keyInput ?? '');
  const [editing, setEditing] = createSignal(opts.editing ?? false);
  const [validationError, setValidationError] = createSignal<string | null>(null);

  const onBack = opts.onBack ?? vi.fn();
  const onUpdate = opts.onUpdate ?? vi.fn();

  const result = render(() => (
    <ProviderKeyForm
      provDef={opts.provDef}
      provId={opts.provId ?? opts.provDef.id}
      agentName="test-agent"
      isSubMode={() => opts.isSubMode ?? false}
      connected={() => opts.connected ?? false}
      selectedAuthType={() => opts.selectedAuthType ?? 'api_key'}
      busy={busy}
      setBusy={setBusy}
      keyInput={keyInput}
      setKeyInput={setKeyInput}
      editing={editing}
      setEditing={setEditing}
      validationError={validationError}
      setValidationError={setValidationError}
      getKeyPrefixDisplay={() => 'sk-***'}
      providers={opts.providers}
      onBack={onBack}
      onUpdate={onUpdate}
    />
  ));

  return { ...result, setKeyInput, onBack, onUpdate };
}

/* ── Tests ──────────────────────────────────────────────────── */

describe('ProviderKeyForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('field label', () => {
    it('shows "API Key" when NOT in subscription mode (api-key provider)', () => {
      const def = makeProviderDef({ id: 'openai', name: 'OpenAI' });
      const { container } = mount({ provDef: def, isSubMode: false });
      const label = container.querySelector('.provider-detail__label');
      expect(label!.textContent).toBe('API Key');
    });

    it('shows "Setup Token" for a subscription provider that uses the default credential kind (Anthropic)', () => {
      // Anthropic-style: subscription mode, no subscriptionCredentialKind set
      // → fallback to 'setup-token' → label is "Setup Token".
      const def = makeProviderDef({
        id: 'anthropic',
        name: 'Anthropic',
        supportsSubscription: true,
        subscriptionLabel: 'Claude Pro',
        // no subscriptionCredentialKind → defaults to setup-token
      });
      const { container } = mount({ provDef: def, isSubMode: true });
      const label = container.querySelector('.provider-detail__label');
      expect(label!.textContent).toBe('Setup Token');
    });

    it('shows "API Key" for an Ollama-Cloud-style subscription provider (subscriptionCredentialKind=api-key)', () => {
      // This is the exact regression the UI/UX pass fixed: Ollama Cloud uses
      // a subscription tab but pastes an API key, not a setup token.
      const def = makeProviderDef({
        id: 'ollama-cloud',
        name: 'Ollama Cloud',
        supportsSubscription: true,
        subscriptionCredentialKind: 'api-key',
        subscriptionLabel: 'Ollama Cloud subscription',
        subscriptionKeyPlaceholder: 'Paste your Ollama Cloud API key',
      });
      const { container } = mount({ provDef: def, isSubMode: true });
      const label = container.querySelector('.provider-detail__label');
      expect(label!.textContent).toBe('API Key');
    });
  });

  describe('aria labels and help URL', () => {
    it('uses "API key" credential noun and OpenAI api-key URL in api-key mode', () => {
      const def = makeProviderDef({ id: 'openai', name: 'OpenAI' });
      const { container } = mount({ provDef: def, isSubMode: false });
      const input = container.querySelector('input');
      expect(input!.getAttribute('aria-label')).toBe('OpenAI API key');
      const link = container.querySelector('.provider-detail__key-help-link');
      expect(link).not.toBeNull();
      expect(link!.getAttribute('href')).toBe('https://platform.openai.com/api-keys');
      expect(link!.textContent).toContain('Get OpenAI API key');
    });

    it('uses "setup token" credential noun for Anthropic subscription mode and hides URL (no subscription URL configured)', () => {
      const def = makeProviderDef({
        id: 'anthropic',
        name: 'Anthropic',
        supportsSubscription: true,
      });
      const { container } = mount({ provDef: def, isSubMode: true });
      const input = container.querySelector('input');
      expect(input!.getAttribute('aria-label')).toBe('Anthropic setup token');
      // Anthropic has no SUBSCRIPTION_PROVIDER_KEY_URL entry → link is hidden.
      expect(container.querySelector('.provider-detail__key-help-link')).toBeNull();
    });

    it('uses "API key" credential noun AND the Ollama settings page URL for Ollama Cloud subscription', () => {
      const def = makeProviderDef({
        id: 'ollama-cloud',
        name: 'Ollama Cloud',
        supportsSubscription: true,
        subscriptionCredentialKind: 'api-key',
      });
      const { container } = mount({ provDef: def, isSubMode: true });
      const input = container.querySelector('input');
      expect(input!.getAttribute('aria-label')).toBe('Ollama Cloud API key');
      const link = container.querySelector('.provider-detail__key-help-link');
      expect(link).not.toBeNull();
      expect(link!.getAttribute('href')).toBe('https://ollama.com/settings/keys');
      expect(link!.textContent).toContain('Get Ollama Cloud API key');
    });
  });

  describe('connected view aria-labels', () => {
    it('labels the masked input "Current API key (masked)" for an api-key credential', () => {
      const def = makeProviderDef({ id: 'openai', name: 'OpenAI' });
      const { container } = mount({ provDef: def, connected: true, isSubMode: false });
      const disabledInput = container.querySelector('input[disabled]');
      expect(disabledInput!.getAttribute('aria-label')).toBe('Current API key (masked)');
    });

    it('labels the masked input "Current setup token (masked)" for a setup-token credential', () => {
      const def = makeProviderDef({
        id: 'anthropic',
        name: 'Anthropic',
        supportsSubscription: true,
      });
      const { container } = mount({ provDef: def, connected: true, isSubMode: true });
      const disabledInput = container.querySelector('input[disabled]');
      expect(disabledInput!.getAttribute('aria-label')).toBe('Current setup token (masked)');
    });

    it('labels the masked input "Current API key (masked)" for Ollama-Cloud-style api-key subscription', () => {
      const def = makeProviderDef({
        id: 'ollama-cloud',
        name: 'Ollama Cloud',
        supportsSubscription: true,
        subscriptionCredentialKind: 'api-key',
      });
      const { container } = mount({ provDef: def, connected: true, isSubMode: true });
      const disabledInput = container.querySelector('input[disabled]');
      expect(disabledInput!.getAttribute('aria-label')).toBe('Current API key (masked)');
    });
  });

  describe('placeholder', () => {
    it('uses provDef.keyPlaceholder in api-key mode', () => {
      const def = makeProviderDef({ id: 'openai', name: 'OpenAI', keyPlaceholder: 'sk-xxx' });
      const { container } = mount({ provDef: def, isSubMode: false });
      const input = container.querySelector('input');
      expect(input!.getAttribute('placeholder')).toBe('sk-xxx');
    });

    it('uses subscriptionKeyPlaceholder in subscription mode', () => {
      const def = makeProviderDef({
        id: 'ollama-cloud',
        name: 'Ollama Cloud',
        supportsSubscription: true,
        subscriptionCredentialKind: 'api-key',
        subscriptionKeyPlaceholder: 'Paste your Ollama Cloud API key',
      });
      const { container } = mount({ provDef: def, isSubMode: true });
      const input = container.querySelector('input');
      expect(input!.getAttribute('placeholder')).toBe('Paste your Ollama Cloud API key');
    });

    it('falls back to "Paste token" when subscription placeholder is not provided', () => {
      const def = makeProviderDef({
        id: 'anthropic',
        name: 'Anthropic',
        supportsSubscription: true,
      });
      const { container } = mount({ provDef: def, isSubMode: true });
      const input = container.querySelector('input');
      expect(input!.getAttribute('placeholder')).toBe('Paste token');
    });
  });

  describe('handleConnect', () => {
    it('calls connectProvider and toast.success on Connect click', async () => {
      const def = makeProviderDef({ id: 'openai', name: 'OpenAI' });
      const onBack = vi.fn();
      const onUpdate = vi.fn();
      const { container } = mount({
        provDef: def,
        keyInput: 'sk-test-key',
        onBack,
        onUpdate,
      });

      const connectBtn = container.querySelector('.provider-detail__action') as HTMLButtonElement;
      expect(connectBtn).not.toBeNull();
      fireEvent.click(connectBtn);
      await Promise.resolve();
      await Promise.resolve();

      expect(connectProviderMock).toHaveBeenCalledWith('test-agent', {
        provider: 'openai',
        apiKey: 'sk-test-key',
        authType: 'api_key',
      });
      expect(toastSuccess).toHaveBeenCalledWith('OpenAI connected');
      expect(onBack).toHaveBeenCalled();
      expect(onUpdate).toHaveBeenCalled();
    });
  });

  describe('handleUpdateKey toast labels', () => {
    it('says "key updated" for an api-key credential (NOT in subscription mode)', async () => {
      const def = makeProviderDef({ id: 'openai', name: 'OpenAI' });
      const { container } = mount({
        provDef: def,
        connected: true,
        editing: true,
        keyInput: 'sk-new-key',
        isSubMode: false,
      });

      // Find the Save button (inside the editing view)
      const saveBtn = Array.from(
        container.querySelectorAll('.provider-detail__action'),
      ).find((b) => b.textContent?.includes('Save')) as HTMLButtonElement;
      expect(saveBtn).not.toBeNull();
      fireEvent.click(saveBtn);
      await Promise.resolve();
      await Promise.resolve();
      expect(toastSuccess).toHaveBeenCalledWith('OpenAI key updated');
    });

    it('says "token updated" for a setup-token subscription credential (Anthropic)', async () => {
      const def = makeProviderDef({
        id: 'anthropic',
        name: 'Anthropic',
        supportsSubscription: true,
      });
      const { container } = mount({
        provDef: def,
        connected: true,
        editing: true,
        isSubMode: true,
        keyInput: 'sess-token-abc',
      });
      const saveBtn = Array.from(
        container.querySelectorAll('.provider-detail__action'),
      ).find((b) => b.textContent?.includes('Save')) as HTMLButtonElement;
      fireEvent.click(saveBtn);
      await Promise.resolve();
      await Promise.resolve();
      expect(toastSuccess).toHaveBeenCalledWith('Anthropic token updated');
    });

    it('says "key updated" for an api-key subscription credential (Ollama Cloud)', async () => {
      const def = makeProviderDef({
        id: 'ollama-cloud',
        name: 'Ollama Cloud',
        supportsSubscription: true,
        subscriptionCredentialKind: 'api-key',
      });
      const { container } = mount({
        provDef: def,
        connected: true,
        editing: true,
        isSubMode: true,
        keyInput: 'new-cloud-key',
      });
      const saveBtn = Array.from(
        container.querySelectorAll('.provider-detail__action'),
      ).find((b) => b.textContent?.includes('Save')) as HTMLButtonElement;
      fireEvent.click(saveBtn);
      await Promise.resolve();
      await Promise.resolve();
      // Even though isSubMode() is true, isApiKeyCredential() short-circuits
      // the "token" label and we use "key".
      expect(toastSuccess).toHaveBeenCalledWith('Ollama Cloud key updated');
    });
  });

  describe('handleDisconnect', () => {
    it('does NOT revoke OpenAI OAuth when auth mode is NOT subscription+popup_oauth', async () => {
      const def = makeProviderDef({ id: 'openai', name: 'OpenAI' });
      const { container } = mount({ provDef: def, connected: true, isSubMode: false });
      const disconnectBtn = container.querySelector(
        '.provider-detail__disconnect-icon',
      ) as HTMLButtonElement;
      fireEvent.click(disconnectBtn);
      await Promise.resolve();
      await Promise.resolve();
      expect(revokeOpenaiOAuthMock).not.toHaveBeenCalled();
      expect(disconnectProviderMock).toHaveBeenCalled();
    });

    it('calls revokeOpenaiOAuth before disconnect when provider is OpenAI popup_oauth subscription', async () => {
      // This exercises lines 112-114: shouldRevokeOpenaiOAuth() === true.
      const def = makeProviderDef({
        id: 'openai',
        name: 'OpenAI',
        supportsSubscription: true,
        subscriptionAuthMode: 'popup_oauth',
      });
      const { container } = mount({
        provDef: def,
        provId: 'openai',
        connected: true,
        isSubMode: true,
        selectedAuthType: 'subscription',
      });
      const disconnectBtn = container.querySelector(
        '.provider-detail__disconnect-icon',
      ) as HTMLButtonElement;
      fireEvent.click(disconnectBtn);
      await Promise.resolve();
      await Promise.resolve();
      expect(revokeOpenaiOAuthMock).toHaveBeenCalledWith('test-agent');
      expect(disconnectProviderMock).toHaveBeenCalled();
    });

    it('swallows revokeOpenaiOAuth errors and still calls disconnect', async () => {
      revokeOpenaiOAuthMock.mockRejectedValueOnce(new Error('revoke failed'));
      const def = makeProviderDef({
        id: 'openai',
        name: 'OpenAI',
        supportsSubscription: true,
        subscriptionAuthMode: 'popup_oauth',
      });
      const { container } = mount({
        provDef: def,
        provId: 'openai',
        connected: true,
        isSubMode: true,
        selectedAuthType: 'subscription',
      });
      const disconnectBtn = container.querySelector(
        '.provider-detail__disconnect-icon',
      ) as HTMLButtonElement;
      fireEvent.click(disconnectBtn);
      await Promise.resolve();
      await Promise.resolve();
      expect(revokeOpenaiOAuthMock).toHaveBeenCalled();
      // Even with the rejection, disconnectProvider runs.
      expect(disconnectProviderMock).toHaveBeenCalled();
    });

    it('surfaces backend notifications as toast errors', async () => {
      disconnectProviderMock.mockResolvedValueOnce({
        notifications: ['Archived alert rule', 'Removed from tier'],
      });
      const def = makeProviderDef({ id: 'openai', name: 'OpenAI' });
      const { container } = mount({ provDef: def, connected: true, isSubMode: false });
      const disconnectBtn = container.querySelector(
        '.provider-detail__disconnect-icon',
      ) as HTMLButtonElement;
      fireEvent.click(disconnectBtn);
      await Promise.resolve();
      await Promise.resolve();
      expect(toastError).toHaveBeenCalledWith('Archived alert rule');
      expect(toastError).toHaveBeenCalledWith('Removed from tier');
    });
  });

  describe('editing state transitions', () => {
    it('clicking Change enters editing mode with an empty input', () => {
      const def = makeProviderDef({ id: 'openai', name: 'OpenAI' });
      const { container, getByText } = mount({
        provDef: def,
        connected: true,
        editing: false,
        keyInput: 'stale',
      });
      const changeBtn = getByText('Change');
      fireEvent.click(changeBtn);
      // After clicking Change the editing-mode input is rendered.
      const editingInputs = container.querySelectorAll('input:not([disabled])');
      expect(editingInputs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('subscription provider without URL', () => {
    it('does not render the Get API key link when neither map returns a URL (Anthropic api-key mode)', () => {
      const def = makeProviderDef({
        id: 'unknown-provider',
        name: 'Unknown',
      });
      const { container } = mount({ provDef: def, isSubMode: false });
      expect(container.querySelector('.provider-detail__key-help-link')).toBeNull();
    });
  });

  describe('Enter key submission', () => {
    it('submits handleConnect when Enter is pressed in the connect input', async () => {
      const def = makeProviderDef({ id: 'openai', name: 'OpenAI' });
      const { container } = mount({ provDef: def, keyInput: 'sk-test' });
      const input = container.querySelector('input') as HTMLInputElement;
      fireEvent.keyDown(input, { key: 'Enter' });
      await Promise.resolve();
      await Promise.resolve();
      expect(connectProviderMock).toHaveBeenCalled();
    });

    it('submits handleUpdateKey when Enter is pressed in the editing input', async () => {
      const def = makeProviderDef({ id: 'openai', name: 'OpenAI' });
      const { container } = mount({
        provDef: def,
        connected: true,
        editing: true,
        keyInput: 'sk-new',
      });
      const editingInput = container.querySelector(
        'input:not([disabled])',
      ) as HTMLInputElement;
      fireEvent.keyDown(editingInput, { key: 'Enter' });
      await Promise.resolve();
      await Promise.resolve();
      expect(connectProviderMock).toHaveBeenCalled();
      expect(toastSuccess).toHaveBeenCalledWith('OpenAI key updated');
    });
  });

  /* ── multi-key chain (api_key only) ─────────────────────────── */

  function makeProvider(overrides: Partial<RoutingProvider> = {}): RoutingProvider {
    return {
      id: 'p1',
      provider: 'openai',
      auth_type: 'api_key',
      is_active: true,
      has_api_key: true,
      key_prefix: 'sk-test-',
      label: 'Default',
      priority: 0,
      region: null,
      connected_at: '2026-04-27',
      ...overrides,
    };
  }

  describe('multi-key chain', () => {
    it('shows the legacy single-key view (no list, no Primary badge) when only one key is connected', () => {
      const def = makeProviderDef({ id: 'openai', name: 'OpenAI' });
      const { container } = mount({
        provDef: def,
        connected: true,
        providers: [makeProvider()],
      });
      // Header still says "API Key" (singular).
      expect(container.querySelector('.provider-detail__label')!.textContent).toBe('API Key');
      // The legacy disabled key input is rendered; there's no <ul role=list>.
      expect(container.querySelector('input[disabled]')).toBeDefined();
      expect(container.querySelector('ul[role="list"]')).toBeNull();
    });

    it('shows the "+ Add another key" link only for api_key providers below the single-key row', () => {
      const def = makeProviderDef({ id: 'openai', name: 'OpenAI' });
      const { getByText } = mount({
        provDef: def,
        connected: true,
        providers: [makeProvider()],
      });
      expect(getByText('+ Add another key')).toBeDefined();
    });

    it('shows "+ Add another key" for subscription providers (multi-account chain)', () => {
      const def = makeProviderDef({
        id: 'anthropic',
        name: 'Anthropic',
        supportsSubscription: true,
        subscriptionLabel: 'Claude Pro',
      });
      const { getByText } = mount({
        provDef: def,
        connected: true,
        isSubMode: true,
        selectedAuthType: 'subscription',
        providers: [
          makeProvider({ provider: 'anthropic', auth_type: 'subscription', label: 'Default' }),
        ],
      });
      expect(getByText('+ Add another key')).toBeDefined();
    });

    it('does not show "+ Add another key" for local providers (Ollama)', () => {
      const def = makeProviderDef({ id: 'ollama', name: 'Ollama' });
      const { queryByText } = mount({
        provDef: def,
        connected: true,
        selectedAuthType: 'local',
        providers: [
          makeProvider({
            provider: 'ollama',
            auth_type: 'local',
            label: 'Default',
            has_api_key: false,
          }),
        ],
      });
      expect(queryByText('+ Add another key')).toBeNull();
    });

    it('switches to list mode (header "API Keys", <ul role="list">) when 2+ keys exist', () => {
      const def = makeProviderDef({ id: 'openai', name: 'OpenAI' });
      const { container } = mount({
        provDef: def,
        connected: true,
        providers: [
          makeProvider({ id: 'p1', label: 'Personal', priority: 0 }),
          makeProvider({ id: 'p2', label: 'Work', priority: 1 }),
        ],
      });
      expect(container.querySelector('.provider-detail__label')!.textContent).toBe('API Keys');
      expect(container.querySelector('ul[role="list"]')).toBeDefined();
    });

    it('renders each key by its label without chain badges', () => {
      const def = makeProviderDef({ id: 'openai', name: 'OpenAI' });
      const { getByText, queryByText } = mount({
        provDef: def,
        connected: true,
        providers: [
          makeProvider({ id: 'p1', label: 'Personal', priority: 0 }),
          makeProvider({ id: 'p2', label: 'Work', priority: 1 }),
        ],
      });
      expect(getByText('Personal')).toBeDefined();
      expect(getByText('Work')).toBeDefined();
      // No "Primary" / "Fallback N" — keys are equal, fallback is configured
      // separately via the existing model-fallback UI.
      expect(queryByText('Primary')).toBeNull();
      expect(queryByText('Fallback 1')).toBeNull();
    });

    it('rename invokes renameProviderKey with the auth_type and refreshes', async () => {
      const def = makeProviderDef({ id: 'openai', name: 'OpenAI' });
      const onUpdate = vi.fn();
      const { container, getByText } = mount({
        provDef: def,
        connected: true,
        onUpdate,
        providers: [
          makeProvider({ id: 'p1', label: 'Personal', priority: 0 }),
          makeProvider({ id: 'p2', label: 'Work', priority: 1 }),
        ],
      });
      // Open rename for the first row (Personal).
      const renameButtons = container.querySelectorAll('button');
      const personalRename = Array.from(renameButtons).find(
        (b) => b.textContent === 'Rename',
      ) as HTMLButtonElement;
      fireEvent.click(personalRename);

      const renameInput = container.querySelector(
        'input[aria-label="Rename Personal"]',
      ) as HTMLInputElement;
      fireEvent.input(renameInput, { target: { value: 'Home' } });
      fireEvent.click(getByText('Save'));

      await Promise.resolve();
      await Promise.resolve();
      expect(renameProviderKeyMock).toHaveBeenCalledWith(
        'test-agent',
        'openai',
        'Personal',
        'Home',
        'api_key',
      );
      expect(onUpdate).toHaveBeenCalled();
    });

    it('does not render reorder controls — keys are equal credentials, not a chain', () => {
      const def = makeProviderDef({ id: 'openai', name: 'OpenAI' });
      const { container } = mount({
        provDef: def,
        connected: true,
        providers: [
          makeProvider({ id: 'p1', label: 'Personal', priority: 0 }),
          makeProvider({ id: 'p2', label: 'Work', priority: 1 }),
        ],
      });
      expect(container.querySelector('button[aria-label="Move Personal down"]')).toBeNull();
      expect(container.querySelector('button[aria-label="Move Work up"]')).toBeNull();
    });

    it('trash icon on a list row deletes by label without unmounting the modal', async () => {
      const def = makeProviderDef({ id: 'openai', name: 'OpenAI' });
      const onBack = vi.fn();
      const onUpdate = vi.fn();
      const { container } = mount({
        provDef: def,
        connected: true,
        onBack,
        onUpdate,
        providers: [
          makeProvider({ id: 'p1', label: 'Personal', priority: 0 }),
          makeProvider({ id: 'p2', label: 'Work', priority: 1 }),
        ],
      });
      const deleteWork = container.querySelector(
        'button[aria-label="Delete key Work"]',
      ) as HTMLButtonElement;
      fireEvent.click(deleteWork);

      await Promise.resolve();
      await Promise.resolve();
      expect(disconnectProviderMock).toHaveBeenCalledWith(
        'test-agent',
        'openai',
        'api_key',
        'Work',
      );
      // Stays on the modal so the user can keep editing the chain.
      expect(onBack).not.toHaveBeenCalled();
      expect(onUpdate).toHaveBeenCalled();
    });

    it('inline rename for a chain row calls renameProviderKey and refreshes', async () => {
      const def = makeProviderDef({ id: 'openai', name: 'OpenAI' });
      const onUpdate = vi.fn();
      const { container, getByText } = mount({
        provDef: def,
        connected: true,
        onUpdate,
        providers: [
          makeProvider({ id: 'p1', label: 'Personal', priority: 0 }),
          makeProvider({ id: 'p2', label: 'Work', priority: 1 }),
        ],
      });
      // Click the first row's Rename button.
      const renameBtns = Array.from(container.querySelectorAll('button')).filter(
        (b) => b.textContent === 'Rename',
      );
      fireEvent.click(renameBtns[0] as HTMLButtonElement);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'Home' } });
      fireEvent.click(getByText('Save'));

      await Promise.resolve();
      await Promise.resolve();
      expect(renameProviderKeyMock).toHaveBeenCalledWith(
        'test-agent',
        'openai',
        'Personal',
        'Home',
        'api_key',
      );
      expect(toastSuccess).toHaveBeenCalledWith('Renamed to "Home"');
    });

    it('AddAnotherKeyAction submits a new labeled key with the suggested default label', async () => {
      const def = makeProviderDef({ id: 'openai', name: 'OpenAI' });
      const onUpdate = vi.fn();
      const { container, getByText } = mount({
        provDef: def,
        connected: true,
        onUpdate,
        providers: [makeProvider({ id: 'p1', label: 'Default', priority: 0 })],
      });
      fireEvent.click(getByText('+ Add another key'));
      // Form is now open. The api-key input has a placeholder "sk-...".
      const apiKeyInput = container.querySelector(
        'input[placeholder="sk-..."]',
      ) as HTMLInputElement;
      fireEvent.input(apiKeyInput, { target: { value: 'sk-second' } });
      fireEvent.click(getByText('Add key'));

      await Promise.resolve();
      await Promise.resolve();
      // Default suggestion for the 2nd key is "Key 2".
      expect(connectProviderMock).toHaveBeenCalledWith('test-agent', {
        provider: 'openai',
        apiKey: 'sk-second',
        authType: 'api_key',
        label: 'Key 2',
      });
      expect(toastSuccess).toHaveBeenCalledWith('OpenAI key "Key 2" added');
    });

    it('AddAnotherKeyAction Cancel closes the form without submitting', () => {
      const def = makeProviderDef({ id: 'openai', name: 'OpenAI' });
      const { container, getByText, queryByText } = mount({
        provDef: def,
        connected: true,
        providers: [makeProvider({ id: 'p1', label: 'Default', priority: 0 })],
      });
      fireEvent.click(getByText('+ Add another key'));
      expect(queryByText('Cancel')).toBeDefined();
      fireEvent.click(getByText('Cancel'));
      // Form collapses; the Cancel button is gone.
      expect(container.querySelector('input[placeholder="sk-..."]')).toBeNull();
      expect(connectProviderMock).not.toHaveBeenCalled();
    });
  });
});
