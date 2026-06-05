import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';

const mockGetGlobalProviders = vi.fn();
const mockConnectGlobalProvider = vi.fn();
const mockDisconnectGlobalProvider = vi.fn();
const mockRefreshGlobalProviderModels = vi.fn();
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('../../src/services/api.js', () => ({
  getGlobalProviders: (...args: unknown[]) => mockGetGlobalProviders(...args),
  connectGlobalProvider: (...args: unknown[]) => mockConnectGlobalProvider(...args),
  disconnectGlobalProvider: (...args: unknown[]) => mockDisconnectGlobalProvider(...args),
  refreshGlobalProviderModels: (...args: unknown[]) => mockRefreshGlobalProviderModels(...args),
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
  ],
}));

vi.mock('../../src/components/ProviderIcon.js', () => ({
  providerIcon: () => null,
}));

vi.mock('../../src/services/provider-utils.js', () => ({
  validateApiKey: () => ({ valid: true }),
  validateSubscriptionKey: () => ({ valid: true }),
}));

vi.mock('../../src/services/formatters.js', () => ({
  formatTimeAgo: () => 'just now',
}));

vi.mock('../../src/services/toast-store.js', () => ({ toast }));

vi.mock('@solidjs/meta', () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

import GlobalProviders from '../../src/pages/GlobalProviders';

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
  });

  it('renders global provider rows', async () => {
    render(() => <GlobalProviders />);

    await screen.findByText('OpenAI');

    expect(screen.getByText('Connections')).toBeDefined();
    expect(screen.getByText('1 active')).toBeDefined();
    expect(screen.getByText('2 models')).toBeDefined();
  });

  it('connects a global API-key provider', async () => {
    render(() => <GlobalProviders />);
    await screen.findByText('OpenAI');

    await fireEvent.input(screen.getByLabelText('Key'), { target: { value: 'sk-new' } });
    await fireEvent.input(screen.getByLabelText('Label'), { target: { value: 'Work' } });
    await fireEvent.click(screen.getByText('Connect'));

    await waitFor(() =>
      expect(mockConnectGlobalProvider).toHaveBeenCalledWith({
        provider: 'openai',
        authType: 'api_key',
        apiKey: 'sk-new',
        label: 'Work',
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('OpenAI connected');
  });

  it('refreshes and disconnects a global provider row', async () => {
    render(() => <GlobalProviders />);
    await screen.findByText('OpenAI');

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
});
