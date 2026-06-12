import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetSearchParams = vi.fn();
let mockSearchParams: Record<string, string | undefined> = {};
const mockGetGlobalProviders = vi.fn();
const mockGetAgents = vi.fn();
const mockGetAgentProviders = vi.fn();
const mockGetCustomProviders = vi.fn();
const mockProviderSelectModal = vi.fn();

const mockNavigate = vi.fn();
vi.mock('@solidjs/router', () => ({
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  useNavigate: () => mockNavigate,
  Navigate: (props: { href: string }) => <div data-testid="navigate" data-href={props.href} />,
}));

// The Local providers page only exists on self-hosted installs; cloud
// redirects to BYOK. Default to self-hosted so the page tests apply.
let mockIsSelfHosted = true;
vi.mock('../../src/services/setup-status.js', () => ({
  checkIsSelfHosted: () => Promise.resolve(mockIsSelfHosted),
}));

vi.mock('@solidjs/meta', () => ({
  Title: (props: { children: unknown }) => <title>{props.children as string}</title>,
}));

vi.mock('../../src/components/ProviderSelectModal.jsx', () => ({
  default: (props: Record<string, unknown>) => {
    mockProviderSelectModal(props);
    return (
      <div role="dialog" aria-label="provider modal">
        <button onClick={() => (props.onUpdate as () => Promise<void>)()}>update</button>
        <button onClick={() => (props.onClose as () => void)()}>close</button>
      </div>
    );
  },
}));

vi.mock('../../src/components/ProviderIcon.jsx', () => ({
  providerIcon: (providerId: string) =>
    providerId === 'openai' ? <span data-testid="provider-icon" /> : null,
}));

vi.mock('../../src/services/providers.js', () => ({
  PROVIDERS: [
    { id: 'openai', name: 'OpenAI', supportsSubscription: true },
    { id: 'anthropic', name: 'Anthropic', supportsSubscription: true },
    { id: 'groq', name: 'Groq' },
    { id: 'ollama', name: 'Ollama', localOnly: true },
  ],
}));

vi.mock('../../src/services/formatters.js', () => ({
  customProviderColor: () => '#654321',
  formatNumber: (value: number) => String(value),
  formatCost: (value: number) => `$${value.toFixed(2)}`,
  formatTimeAgo: () => 'recently',
}));

vi.mock('../../src/services/api/providers.js', () => ({
  getProviders: (...args: unknown[]) => mockGetGlobalProviders(...args),
}));

vi.mock('../../src/services/api.js', () => ({
  getAgents: (...args: unknown[]) => mockGetAgents(...args),
  getProviders: (...args: unknown[]) => mockGetAgentProviders(...args),
  getCustomProviders: (...args: unknown[]) => mockGetCustomProviders(...args),
}));

import Subscriptions from '../../src/pages/providers/Subscriptions';
import Byok from '../../src/pages/providers/Byok';
import LocalProviders from '../../src/pages/providers/Local';

const connection = (id: string, label: string, active = true) => ({
  id,
  label,
  key_prefix: null,
  priority: 0,
  connected_at: '2026-01-01',
  models_fetched_at: null,
  cached_model_count: 3,
  is_active: active,
});

const globalProvidersResponse = {
  providers: [
    {
      provider: 'openai',
      auth_type: 'subscription',
      connection_count: 1,
      connections: [connection('sub-openai', 'ChatGPT')],
      total_models: 3,
      consumption_tokens: 42,
      consumption_messages: 2,
      consumption_cost: 0,
      last_used_at: '2026-06-01T00:00:00Z',
      sparkline_7d: [],
    },
    {
      provider: 'custom:cp-1',
      auth_type: 'api_key',
      connection_count: 1,
      connections: [connection('key-custom', 'Production', false)],
      total_models: 2,
      consumption_tokens: 7,
      consumption_messages: 1,
      consumption_cost: 0,
      last_used_at: null,
      sparkline_7d: [],
    },
    {
      provider: 'ollama',
      auth_type: 'local',
      connection_count: 1,
      connections: [connection('local-ollama', 'Default')],
      total_models: 5,
      consumption_tokens: 9,
      consumption_messages: 1,
      consumption_cost: 0,
      last_used_at: null,
      sparkline_7d: [],
    },
  ],
  model_counts: { openai: 10, groq: 4, ollama: 5 },
};

describe('provider pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = {};
    mockIsSelfHosted = true;
    mockGetGlobalProviders.mockResolvedValue(globalProvidersResponse);
    mockGetAgents.mockResolvedValue({ agents: [{ agent_name: 'demo-agent' }] });
    mockGetAgentProviders.mockResolvedValue([{ id: 'route-provider' }]);
    mockGetCustomProviders.mockResolvedValue([
      {
        id: 'cp-1',
        name: 'Custom Gateway',
        base_url: 'https://example.test/v1',
        api_kind: 'openai',
        has_api_key: true,
        models: [],
        created_at: '2026-01-01',
      },
    ]);
  });

  it('renders the subscriptions page and opens the connect modal', async () => {
    render(() => <Subscriptions />);

    await waitFor(() => {
      expect(screen.getByText('Subscriptions')).toBeDefined();
      expect(screen.getByText('My subscription connections')).toBeDefined();
      expect(screen.getByText('ChatGPT')).toBeDefined();
    });

    fireEvent.click(screen.getAllByText('Connect')[0]!);
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'provider modal' })).toBeDefined();
      expect(mockProviderSelectModal).toHaveBeenCalledWith(
        expect.objectContaining({
          agentName: 'demo-agent',
          providers: [{ id: 'route-provider' }],
        }),
      );
    });
    fireEvent.click(screen.getByText('update'));
    await waitFor(() => {
      expect(mockGetAgentProviders.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    fireEvent.click(screen.getByText('close'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'provider modal' })).toBeNull();
    });
  });

  it('deep-links the connect modal to a specific provider when added from its row', async () => {
    render(() => <Subscriptions />);

    // Each supported-provider row carries its own "Connect" button; clicking it
    // opens straight into that provider's connection form (deep link) rather
    // than the generic picker list. Index 0 is the first supported provider
    // (OpenAI). Wait until the agents resource resolves so the button enables.
    await waitFor(() => {
      expect((screen.getAllByText('Connect')[0] as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(screen.getAllByText('Connect')[0]!);
    await waitFor(() => {
      expect(mockProviderSelectModal).toHaveBeenCalledWith(
        expect.objectContaining({
          providerDeepLink: { providerId: 'openai', authType: 'subscription' },
        }),
      );
    });
  });

  it('renders the BYOK (usage-based) page with custom provider connections', async () => {
    render(() => <Byok />);

    await waitFor(() => {
      expect(screen.getByText('Usage-based')).toBeDefined();
      expect(screen.getByText('My usage-based connections')).toBeDefined();
      expect(screen.getByText('Custom Gateway')).toBeDefined();
      expect(screen.getByText('Inactive')).toBeDefined();
      expect(screen.getByText('Supported usage-based providers')).toBeDefined();
    });
  });

  it('renders the local providers page', async () => {
    render(() => <LocalProviders />);

    await waitFor(() => {
      expect(screen.getByText('Local')).toBeDefined();
      expect(screen.getByText('My local connections')).toBeDefined();
      expect(screen.getAllByText('Ollama').length).toBeGreaterThan(0);
    });
  });

  it('redirects the local providers page to the usage-based page in cloud', async () => {
    mockIsSelfHosted = false;
    const { container } = render(() => <LocalProviders />);

    await waitFor(() => {
      const navigate = container.querySelector('[data-testid="navigate"]');
      expect(navigate).not.toBeNull();
      expect(navigate?.getAttribute('data-href')).toBe('/providers/usage-based');
    });
    // The page content (its connected-connections heading) must not render —
    // cloud short-circuits straight to the redirect.
    expect(container.textContent).not.toContain('My local connections');
  });

  it('auto-opens the modal from add=true and clears the query param', async () => {
    mockSearchParams = { add: 'true' };
    render(() => <LocalProviders />);

    await waitFor(() => {
      expect(mockSetSearchParams).toHaveBeenCalledWith({ add: undefined });
      expect(screen.getByRole('dialog', { name: 'provider modal' })).toBeDefined();
    });
  });

  it('disables Add buttons when no agent exists for the modal context', async () => {
    mockGetAgents.mockResolvedValue({ agents: [] });
    render(() => <Byok />);

    await waitFor(() => {
      const addButton = screen.getAllByText('Connect')[0] as HTMLButtonElement;
      expect(addButton.disabled).toBe(true);
    });
  });

  it('renders supported providers when API calls fail', async () => {
    mockGetGlobalProviders.mockRejectedValue(new Error('providers failed'));
    mockGetAgents.mockRejectedValue(new Error('agents failed'));
    mockGetAgentProviders.mockRejectedValue(new Error('agent providers failed'));
    mockGetCustomProviders.mockRejectedValue(new Error('custom providers failed'));

    render(() => <Subscriptions />);

    await waitFor(() => {
      expect(screen.getByText('Supported subscription providers')).toBeDefined();
      expect(screen.getByText('OpenAI')).toBeDefined();
      expect((screen.getAllByText('Connect')[0] as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it('opens the modal with empty lists when modal context fetches fail', async () => {
    mockSearchParams = { add: 'true' };
    mockGetAgentProviders.mockRejectedValue(new Error('agent providers failed'));
    mockGetCustomProviders.mockRejectedValue(new Error('custom providers failed'));

    render(() => <Byok />);

    await waitFor(() => {
      expect(mockProviderSelectModal).toHaveBeenCalledWith(
        expect.objectContaining({
          agentName: 'demo-agent',
          providers: [],
          customProviders: [],
        }),
      );
    });
  });
});
