import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@solidjs/testing-library';

const mockGetGlobalProviders = vi.fn();
const mockConnectGlobalProvider = vi.fn();
const mockDisconnectGlobalProvider = vi.fn();
const mockRefreshGlobalProviderModels = vi.fn();
const apiFallback = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const validateApiKeyMock = vi.hoisted(() => vi.fn());
const validateSubscriptionKeyMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/api.js', () => ({
  connectProvider: (...args: unknown[]) => apiFallback(...args),
  getGlobalProviders: (...args: unknown[]) => mockGetGlobalProviders(...args),
  connectGlobalProvider: (...args: unknown[]) => mockConnectGlobalProvider(...args),
  disconnectProvider: (...args: unknown[]) => apiFallback(...args),
  disconnectGlobalProvider: (...args: unknown[]) => mockDisconnectGlobalProvider(...args),
  refreshProviderModels: (...args: unknown[]) => apiFallback(...args),
  refreshGlobalProviderModels: (...args: unknown[]) => mockRefreshGlobalProviderModels(...args),
  renameProviderKey: (...args: unknown[]) => apiFallback(...args),
  renameGlobalProviderKey: (...args: unknown[]) => apiFallback(...args),
  reorderProviderKeys: (...args: unknown[]) => apiFallback(...args),
  reorderGlobalProviderKeys: (...args: unknown[]) => apiFallback(...args),
  revokeOpenaiOAuth: (...args: unknown[]) => apiFallback(...args),
  createCustomProvider: (...args: unknown[]) => apiFallback(...args),
  updateCustomProvider: (...args: unknown[]) => apiFallback(...args),
  deleteCustomProvider: (...args: unknown[]) => apiFallback(...args),
  probeCustomProvider: (...args: unknown[]) => apiFallback(...args),
  getPopupOauthApi: (...args: unknown[]) => apiFallback(...args),
  getDeviceCodeApi: (...args: unknown[]) => apiFallback(...args),
  startAnthropicOAuth: (...args: unknown[]) => apiFallback(...args),
  submitAnthropicOAuth: (...args: unknown[]) => apiFallback(...args),
  revokeAnthropicOAuth: (...args: unknown[]) => apiFallback(...args),
  getAnthropicOAuthPending: (...args: unknown[]) => apiFallback(...args),
  copilotDeviceCode: (...args: unknown[]) => apiFallback(...args),
  copilotPollToken: (...args: unknown[]) => apiFallback(...args),
}));

vi.mock('../../src/services/providers.js', () => ({
  PROVIDERS: [
    {
      id: 'openai',
      name: 'OpenAI',
      color: '#111',
      initial: 'O',
      subtitle: '',
      models: [],
      keyPrefix: 'sk-',
      minKeyLength: 3,
      keyPlaceholder: 'sk-test',
      supportsSubscription: true,
      subscriptionLabel: 'ChatGPT Plus/Pro/Team',
      subscriptionAuthMode: 'popup_oauth',
    },
    {
      id: 'minimax',
      name: 'MiniMax',
      color: '#222',
      initial: 'M',
      subtitle: '',
      models: [],
      keyPrefix: 'sk-',
      minKeyLength: 3,
      keyPlaceholder: 'sk-test',
      supportsSubscription: true,
      subscriptionAuthMode: 'token',
      subscriptionKeyPlaceholder: 'sk-cp-test',
      subscriptionEndpointRegions: [{ value: 'global', label: 'Global' }],
    },
    {
      id: 'ollama',
      name: 'Ollama',
      color: '#333',
      initial: 'O',
      subtitle: '',
      models: [],
      keyPrefix: '',
      minKeyLength: 0,
      keyPlaceholder: '',
      localOnly: true,
      noKeyRequired: true,
    },
  ],
}));

vi.mock('../../src/components/ProviderIcon.js', () => ({
  providerIcon: () => null,
}));

vi.mock('../../src/services/provider-utils.js', () => ({
  validateApiKey: (...args: unknown[]) => validateApiKeyMock(...args),
  validateSubscriptionKey: (...args: unknown[]) => validateSubscriptionKeyMock(...args),
}));

vi.mock('../../src/services/formatters.js', () => ({
  formatTimeAgo: () => 'just now',
}));

vi.mock('../../src/services/toast-store.js', () => ({ toast }));

vi.mock('../../src/services/setup-status.js', () => ({
  checkIsSelfHosted: vi.fn().mockResolvedValue(true),
  checkLocalLlmHost: vi.fn().mockResolvedValue('localhost'),
}));

vi.mock('@solidjs/meta', () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

import GlobalProviderByok from '../../src/pages/providers/Byok';
import GlobalProviderLocal from '../../src/pages/providers/Local';
import GlobalProviderSubscriptions from '../../src/pages/providers/Subscriptions';

const providerLibraryRow = (providerName: string) => {
  const cell = screen.getAllByText(providerName).find((element) => element.closest('tr'));
  expect(cell).toBeDefined();
  return cell!.closest('tr')!;
};

describe('GlobalProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGlobalProviders.mockResolvedValue([
      {
        id: 'p1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
        has_api_key: true,
        key_prefix: 'sk-test',
        label: 'Default',
        priority: 0,
        connected_at: '2026-01-01T00:00:00.000Z',
        models_fetched_at: '2026-01-01T00:00:00.000Z',
        cached_model_count: 2,
      },
    ]);
    mockConnectGlobalProvider.mockResolvedValue({ id: 'p2' });
    mockRefreshGlobalProviderModels.mockResolvedValue({
      ok: true,
      model_count: 3,
      last_fetched_at: '2026-01-01T00:00:00.000Z',
      error: null,
    });
    mockDisconnectGlobalProvider.mockResolvedValue({ ok: true, notifications: [] });
    validateApiKeyMock.mockReturnValue({ valid: true });
    validateSubscriptionKeyMock.mockReturnValue({ valid: true });
  });

  it('renders global provider rows', async () => {
    render(() => <GlobalProviderByok />);

    await screen.findByText('My API Keys');

    expect(screen.getByText('Bring Your Own Key')).toBeDefined();
    expect(screen.getByText('1 active / 1 total')).toBeDefined();
    expect(screen.getByText('Default')).toBeDefined();
    expect(screen.getByText('sk-test********')).toBeDefined();
    expect(screen.getByText('Active')).toBeDefined();
    expect(screen.getByText('Supported API key providers')).toBeDefined();
  });

  it('renders an empty state when no global providers exist', async () => {
    mockGetGlobalProviders.mockResolvedValueOnce([]);
    render(() => <GlobalProviderByok />);

    await screen.findByText('No API keys connected');

    expect(screen.getByText('0 active / 0 total')).toBeDefined();
  });

  it('connects a global API-key provider', async () => {
    render(() => <GlobalProviderByok />);
    await screen.findByText('My API Keys');

    await fireEvent.click(
      within(providerLibraryRow('MiniMax')).getByRole('button', { name: 'Add API key' }),
    );

    await fireEvent.input(await screen.findByLabelText('MiniMax API key'), {
      target: { value: 'sk-new' },
    });
    await fireEvent.click(screen.getByText('Connect'));

    await waitFor(() =>
      expect(mockConnectGlobalProvider).toHaveBeenCalledWith({
        provider: 'minimax',
        authType: 'api_key',
        apiKey: 'sk-new',
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('MiniMax connected');
  });

  it('opens the selected provider setup form from the provider library', async () => {
    render(() => <GlobalProviderByok />);
    await screen.findByText('My API Keys');

    await fireEvent.click(
      within(providerLibraryRow('MiniMax')).getByRole('button', { name: 'Add API key' }),
    );

    expect(await screen.findByRole('dialog')).toBeDefined();
    expect(screen.getByText('Connect providers')).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText('MiniMax API key')),
    );
  });

  it('stops before connect when API-key validation fails', async () => {
    validateApiKeyMock.mockReturnValueOnce({ valid: false, error: 'Bad key' });
    render(() => <GlobalProviderByok />);
    await screen.findByText('My API Keys');

    await fireEvent.click(
      within(providerLibraryRow('MiniMax')).getByRole('button', { name: 'Add API key' }),
    );
    await fireEvent.input(await screen.findByLabelText('MiniMax API key'), {
      target: { value: 'bad' },
    });
    await fireEvent.click(screen.getByText('Connect'));

    expect(screen.getByText('Bad key')).toBeDefined();
    expect(mockConnectGlobalProvider).not.toHaveBeenCalled();
  });

  it('connects a subscription provider with the default region', async () => {
    render(() => <GlobalProviderSubscriptions />);
    await screen.findByText('Subscriptions');

    await fireEvent.click(
      within(providerLibraryRow('MiniMax')).getByRole('button', { name: 'Add subscription' }),
    );
    await fireEvent.input(await screen.findByLabelText('MiniMax setup token'), {
      target: { value: 'sk-cp-new' },
    });
    await fireEvent.click(screen.getByText('Connect'));

    await waitFor(() =>
      expect(mockConnectGlobalProvider).toHaveBeenCalledWith({
        provider: 'minimax',
        authType: 'subscription',
        apiKey: 'sk-cp-new',
        region: 'global',
      }),
    );
  });

  it('keeps OpenAI visible in global subscriptions', async () => {
    render(() => <GlobalProviderSubscriptions />);
    await screen.findByText('Supported subscriptions');

    expect(providerLibraryRow('OpenAI')).toBeDefined();
  });

  it('stops before connect when subscription credential validation fails', async () => {
    validateSubscriptionKeyMock.mockReturnValueOnce({
      valid: false,
      error: 'Invalid subscription credential',
    });
    render(() => <GlobalProviderSubscriptions />);
    await screen.findByText('Subscriptions');

    await fireEvent.click(
      within(providerLibraryRow('MiniMax')).getByRole('button', { name: 'Add subscription' }),
    );
    await fireEvent.input(await screen.findByLabelText('MiniMax setup token'), {
      target: { value: 'bad' },
    });
    await fireEvent.click(screen.getByText('Connect'));

    expect(screen.getByText('Invalid subscription credential')).toBeDefined();
    expect(mockConnectGlobalProvider).not.toHaveBeenCalled();
  });

  it('clears saving state when connect rejects', async () => {
    mockConnectGlobalProvider.mockRejectedValueOnce(new Error('network'));
    render(() => <GlobalProviderByok />);
    await screen.findByText('My API Keys');

    await fireEvent.click(
      within(providerLibraryRow('MiniMax')).getByRole('button', { name: 'Add API key' }),
    );
    await fireEvent.input(await screen.findByLabelText('MiniMax API key'), {
      target: { value: 'sk-new' },
    });
    await fireEvent.click(screen.getByText('Connect'));

    await waitFor(() =>
      expect((screen.getByText('Connect') as HTMLButtonElement).disabled).toBe(false),
    );
  });

  it('refreshes and disconnects a global provider row', async () => {
    render(() => <GlobalProviderByok />);
    await screen.findByText('My API Keys');

    await fireEvent.click(screen.getByText('Refresh'));
    await waitFor(() =>
      expect(mockRefreshGlobalProviderModels).toHaveBeenCalledWith('openai', 'api_key'),
    );
    await waitFor(() =>
      expect((screen.getByText('Disconnect') as HTMLButtonElement).disabled).toBe(false),
    );

    await fireEvent.click(screen.getByText('Disconnect'));
    await waitFor(() =>
      expect(mockDisconnectGlobalProvider).toHaveBeenCalledWith('openai', 'api_key', 'Default'),
    );
  });

  it('shows a refresh error and clears the busy state', async () => {
    mockRefreshGlobalProviderModels.mockResolvedValueOnce({
      ok: false,
      model_count: 0,
      last_fetched_at: null,
      error: 'Provider timed out',
    });
    render(() => <GlobalProviderByok />);
    await screen.findByText('My API Keys');

    await fireEvent.click(screen.getByText('Refresh'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Provider timed out'));
    await waitFor(() =>
      expect((screen.getByText('Refresh') as HTMLButtonElement).disabled).toBe(false),
    );
  });

  it('clears row busy state when refresh or disconnect rejects', async () => {
    mockRefreshGlobalProviderModels.mockRejectedValueOnce(new Error('network'));
    mockDisconnectGlobalProvider.mockRejectedValueOnce(new Error('network'));
    render(() => <GlobalProviderByok />);
    await screen.findByText('My API Keys');

    await fireEvent.click(screen.getByText('Refresh'));
    await waitFor(() =>
      expect((screen.getByText('Refresh') as HTMLButtonElement).disabled).toBe(false),
    );

    await fireEvent.click(screen.getByText('Disconnect'));
    await waitFor(() =>
      expect((screen.getByText('Disconnect') as HTMLButtonElement).disabled).toBe(false),
    );
  });

  it('connects a local provider without a credential', async () => {
    render(() => <GlobalProviderLocal />);
    await screen.findByText('Local Providers');

    await fireEvent.click(
      within(providerLibraryRow('Ollama')).getByRole('button', { name: 'Connect' }),
    );
    await fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Connect' }),
    );

    await waitFor(() =>
      expect(mockConnectGlobalProvider).toHaveBeenCalledWith({
        provider: 'ollama',
        authType: 'local',
      }),
    );
  });
});
