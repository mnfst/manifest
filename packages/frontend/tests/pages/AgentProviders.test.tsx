import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetGlobalProviders = vi.fn();
const mockGetEnabledProviders = vi.fn();
const mockGetAgentProviderDisableImpact = vi.fn();
const mockEnableEnabledProviders = vi.fn();
const mockDisableEnabledProviders = vi.fn();
const mockGetCustomProviders = vi.fn();

vi.mock('@solidjs/router', () => ({
  useParams: () => ({ agentName: 'demo-agent' }),
  // The empty-state fallback (NoConnectionsPrompt) renders <A> links to the
  // provider pages, so the router mock must expose A alongside useParams.
  A: (props: any) => props.children,
}));

// NoConnectionsPrompt (the empty-state fallback) gates a "Local" card on the
// self-hosted check. Stub it so the prompt renders without a real fetch; the
// value doesn't affect the assertions (they only look for "No providers
// connected").
vi.mock('../../src/services/setup-status.js', () => ({
  checkIsSelfHosted: () => Promise.resolve(false),
}));

vi.mock('../../src/services/api/providers.js', () => ({
  getProviders: (...args: unknown[]) => mockGetGlobalProviders(...args),
}));

vi.mock('../../src/services/api.js', () => ({
  getEnabledProviders: (...args: unknown[]) => mockGetEnabledProviders(...args),
  getAgentProviderDisableImpact: (...args: unknown[]) => mockGetAgentProviderDisableImpact(...args),
  enableProviderForAgent: (...args: unknown[]) => mockEnableEnabledProviders(...args),
  disableProviderForAgent: (...args: unknown[]) => mockDisableEnabledProviders(...args),
  getCustomProviders: (...args: unknown[]) => mockGetCustomProviders(...args),
}));

vi.mock('../../src/components/ProviderIcon.jsx', () => ({
  providerIcon: (providerId: string) =>
    providerId === 'openai' ? <span data-testid="provider-icon" /> : null,
}));

vi.mock('../../src/services/providers.js', () => ({
  PROVIDERS: [
    { id: 'openai', name: 'OpenAI' },
    { id: 'anthropic', name: 'Anthropic' },
  ],
}));

vi.mock('../../src/services/formatters.js', () => ({
  customProviderColor: () => '#123456',
}));

const mockToastError = vi.fn();
vi.mock('../../src/services/toast-store.js', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockGetAgentModelAccess = vi.fn();
vi.mock('../../src/services/api/teams.js', () => ({
  getAgentModelAccess: (...args: unknown[]) => mockGetAgentModelAccess(...args),
}));

// The modal has its own test; here it only reports what it was opened with
// and lets a test drive onSaved.
const mockModalProps = vi.fn();
vi.mock('../../src/components/ModelAccessModal.jsx', () => ({
  default: (props: any) => {
    mockModalProps(props);
    return (
      <div data-testid="model-access-modal">
        {props.access.provider}
        <button
          type="button"
          onClick={() =>
            props.onSaved({ ...props.access, all_models: false, enabled_count: 1, total_count: 2 })
          }
        >
          save-stub
        </button>
        <button type="button" onClick={props.onClose}>
          close-stub
        </button>
      </div>
    );
  },
}));

import AgentProviders from '../../src/pages/AgentProviders';

const providersResponse = {
  providers: [
    {
      provider: 'openai',
      auth_type: 'api_key',
      connection_count: 1,
      total_models: 2,
      consumption_tokens: 0,
      consumption_messages: 0,
      consumption_cost: 0,
      last_used_at: null,
      sparkline_7d: [],
      connections: [
        {
          id: 'up-openai',
          label: 'Work',
          key_prefix: 'sk-',
          priority: 0,
          connected_at: '2026-01-01',
          models_fetched_at: null,
          cached_model_count: 2,
          is_active: true,
        },
      ],
    },
    {
      provider: 'anthropic',
      auth_type: 'subscription',
      connection_count: 1,
      total_models: 1,
      consumption_tokens: 0,
      consumption_messages: 0,
      consumption_cost: 0,
      last_used_at: null,
      sparkline_7d: [],
      connections: [
        {
          id: 'up-anthropic',
          label: 'Max',
          key_prefix: null,
          priority: 0,
          connected_at: '2026-01-01',
          models_fetched_at: null,
          cached_model_count: 1,
          is_active: true,
        },
      ],
    },
    {
      provider: 'custom:cp-1',
      auth_type: 'api_key',
      connection_count: 1,
      total_models: 4,
      consumption_tokens: 0,
      consumption_messages: 0,
      consumption_cost: 0,
      last_used_at: null,
      sparkline_7d: [],
      connections: [
        {
          id: 'up-custom',
          label: 'Gateway',
          key_prefix: null,
          priority: 0,
          connected_at: '2026-01-01',
          models_fetched_at: null,
          cached_model_count: 4,
          is_active: true,
        },
      ],
    },
  ],
  model_counts: {},
};

describe('AgentProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGlobalProviders.mockResolvedValue(providersResponse);
    mockGetEnabledProviders.mockResolvedValue({ enabled: ['up-openai'] });
    mockGetAgentProviderDisableImpact.mockResolvedValue({
      affected_tiers: [{ tier: 'default', model: 'gpt-4o', position: 'primary' }],
    });
    mockEnableEnabledProviders.mockResolvedValue({ ok: true });
    mockDisableEnabledProviders.mockResolvedValue({ ok: true });
    mockGetAgentModelAccess.mockResolvedValue([
      {
        user_provider_id: 'up-openai',
        provider: 'openai',
        auth_type: 'api_key',
        label: 'Work',
        provider_enabled: true,
        all_models: false,
        models: [
          { id: 'gpt-4o', name: 'GPT-4o', enabled: true, in_routing: true },
          { id: 'gpt-4o-mini', name: 'GPT-4o mini', enabled: false, in_routing: false },
        ],
        enabled_count: 1,
        total_count: 2,
      },
    ]);
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

  it('renders connected global providers with enable toggles', async () => {
    render(() => <AgentProviders />);

    await waitFor(() => {
      expect(screen.getByText('OpenAI')).toBeDefined();
      expect(screen.getByText('Anthropic')).toBeDefined();
      expect(screen.getByText('Custom Gateway')).toBeDefined();
    });

    expect(screen.getAllByText('API key').length).toBeGreaterThan(0);
    expect(screen.getByText('Subscription')).toBeDefined();
    expect(screen.getByLabelText('Disable OpenAI Work')).toBeDefined();
    expect(screen.getByLabelText('Enable Anthropic Max')).toBeDefined();
  });

  it('keeps a long connection name within its cell without removing the models column', async () => {
    const longLabel = 'from MyTrainer LLM Judges and Evaluation Platform';
    mockGetGlobalProviders.mockResolvedValue({
      ...providersResponse,
      providers: providersResponse.providers.map((provider) =>
        provider.provider === 'openai'
          ? {
              ...provider,
              connections: [{ ...provider.connections[0], label: longLabel }],
            }
          : provider,
      ),
    });

    render(() => <AgentProviders />);

    await waitFor(() => {
      expect(screen.getByTitle(longLabel)).toBeDefined();
    });

    expect(screen.getByTitle(longLabel).style.textOverflow).toBe('ellipsis');
    expect(screen.getByRole('columnheader', { name: 'Models' })).toBeDefined();
    expect(screen.getByText('1 of 2')).toBeDefined();
  });

  it('enables a provider with PUT', async () => {
    render(() => <AgentProviders />);

    await waitFor(() => {
      expect(screen.getByLabelText('Enable Anthropic Max')).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText('Enable Anthropic Max'));

    await waitFor(() => {
      expect(mockEnableEnabledProviders).toHaveBeenCalledWith('demo-agent', 'up-anthropic');
    });
  });

  it('blocks disabling with an error toast when the provider has routed models', async () => {
    render(() => <AgentProviders />);

    await waitFor(() => {
      expect(screen.getByLabelText('Disable OpenAI Work')).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText('Disable OpenAI Work'));

    await waitFor(() => {
      expect(mockGetAgentProviderDisableImpact).toHaveBeenCalledWith('demo-agent', 'up-openai');
      expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining("Can't disable OpenAI"));
    });
    expect(mockDisableEnabledProviders).not.toHaveBeenCalled();
  });

  it('disables directly with DELETE when no models are routed', async () => {
    mockGetAgentProviderDisableImpact.mockResolvedValue({ affected_tiers: [] });
    render(() => <AgentProviders />);

    await waitFor(() => {
      expect(screen.getByLabelText('Disable OpenAI Work')).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText('Disable OpenAI Work'));

    await waitFor(() => {
      expect(mockDisableEnabledProviders).toHaveBeenCalledWith('demo-agent', 'up-openai');
    });
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('renders an empty state when no active providers exist', async () => {
    mockGetGlobalProviders.mockResolvedValue({ providers: [], model_counts: {} });
    render(() => <AgentProviders />);

    await waitFor(() => {
      expect(screen.getByText('No providers connected')).toBeDefined();
    });
  });

  it('falls back to an empty state when initial API calls fail', async () => {
    mockGetGlobalProviders.mockRejectedValue(new Error('providers failed'));
    mockGetEnabledProviders.mockRejectedValue(new Error('access failed'));
    mockGetCustomProviders.mockRejectedValue(new Error('custom failed'));

    render(() => <AgentProviders />);

    await waitFor(() => {
      expect(screen.getByText('No providers connected')).toBeDefined();
    });
  });

  it('shows an error toast and aborts when the impact check fails', async () => {
    mockGetAgentProviderDisableImpact.mockRejectedValue(new Error('impact failed'));
    render(() => <AgentProviders />);

    await waitFor(() => {
      expect(screen.getByLabelText('Disable OpenAI Work')).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText('Disable OpenAI Work'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining("Couldn't check"));
    });
    expect(mockDisableEnabledProviders).not.toHaveBeenCalled();
  });

  it('clears busy state when enable or disable calls fail', async () => {
    mockEnableEnabledProviders.mockRejectedValueOnce(new Error('enable failed'));
    mockGetAgentProviderDisableImpact.mockResolvedValue({ affected_tiers: [] });
    mockDisableEnabledProviders.mockRejectedValueOnce(new Error('disable failed'));
    render(() => <AgentProviders />);

    await waitFor(() => {
      expect(screen.getByLabelText('Enable Anthropic Max')).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText('Enable Anthropic Max'));
    await waitFor(() => {
      expect((screen.getByLabelText('Enable Anthropic Max') as HTMLButtonElement).disabled).toBe(
        false,
      );
    });

    fireEvent.click(screen.getByLabelText('Disable OpenAI Work'));
    await waitFor(() => {
      expect(mockDisableEnabledProviders).toHaveBeenCalledWith('demo-agent', 'up-openai');
    });
    await waitFor(() => {
      expect((screen.getByLabelText('Disable OpenAI Work') as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
  });
});

describe('AgentProviders — models', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGlobalProviders.mockResolvedValue(providersResponse);
    mockGetEnabledProviders.mockResolvedValue({ enabled: ['up-openai', 'up-custom'] });
    mockGetCustomProviders.mockResolvedValue([]);
    mockGetAgentModelAccess.mockResolvedValue([
      {
        user_provider_id: 'up-openai',
        provider: 'openai',
        auth_type: 'api_key',
        label: 'Work',
        provider_enabled: true,
        all_models: false,
        models: [
          { id: 'gpt-4o', name: 'GPT-4o', enabled: true, in_routing: true },
          { id: 'gpt-4o-mini', name: 'GPT-4o mini', enabled: false, in_routing: false },
        ],
        enabled_count: 1,
        total_count: 2,
      },
      {
        user_provider_id: 'up-custom',
        provider: 'custom:cp-1',
        auth_type: 'api_key',
        label: 'Gateway',
        provider_enabled: true,
        all_models: true,
        models: [{ id: 'm', name: 'M', enabled: true, in_routing: false }],
        enabled_count: 1,
        total_count: 1,
      },
    ]);
  });

  it('labels the Models column: "x of y" for a partial selection, "All n" for the master switch, "Off" when the provider is off', async () => {
    render(() => <AgentProviders />);
    await waitFor(() => {
      expect(screen.getByText('1 of 2')).toBeDefined();
    });
    expect(screen.getByText('All 1')).toBeDefined();
    expect(screen.getByText('Off')).toBeDefined();
    expect(screen.getByRole('columnheader', { name: 'Provider' })).toBeDefined();
    // The Models button is disabled while the provider is off.
    expect((screen.getByLabelText('Models for Anthropic Max') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByLabelText('Models for OpenAI Work') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('falls back to the connection count ("All n") or "-" when model access has not loaded', async () => {
    mockGetAgentModelAccess.mockResolvedValue([]);
    render(() => <AgentProviders />);
    await waitFor(() => {
      expect(screen.getByText('All 2')).toBeDefined();
    });
    mockGetGlobalProviders.mockResolvedValue({
      ...providersResponse,
      providers: [
        {
          ...providersResponse.providers[0],
          total_models: 0,
          connections: [
            { ...providersResponse.providers[0]!.connections[0], cached_model_count: 0 },
          ],
        },
      ],
    });
    const second = render(() => <AgentProviders />);
    await waitFor(() => {
      expect(second.container.textContent).toContain('-');
    });
  });

  it('disables the model switches and offers a retry when model access fails to load', async () => {
    mockGetAgentModelAccess.mockRejectedValueOnce(new Error('nope'));
    render(() => <AgentProviders />);
    await waitFor(() => {
      expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
    });
    expect((screen.getByLabelText('Models for OpenAI Work') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByRole('alert').textContent).toContain("Model access couldn't be loaded");
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => {
      expect(screen.getByText('1 of 2')).toBeDefined();
    });
    expect((screen.getByLabelText('Models for OpenAI Work') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('opens the model list for a provider and merges the saved access back into the row', async () => {
    render(() => <AgentProviders />);
    await waitFor(() => {
      expect(screen.getByText('1 of 2')).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText('Models for OpenAI Work'));
    await waitFor(() => {
      expect(screen.getByTestId('model-access-modal')).toBeDefined();
    });
    expect(mockModalProps).toHaveBeenCalledWith(
      expect.objectContaining({ agentName: 'demo-agent', open: true }),
    );
    expect(mockModalProps.mock.calls[0]![0].access.user_provider_id).toBe('up-openai');

    fireEvent.click(screen.getByText('save-stub'));
    fireEvent.click(screen.getByText('close-stub'));
    await waitFor(() => {
      expect(screen.queryByTestId('model-access-modal')).toBeNull();
    });
  });

  it('opens an empty model list for a provider that has no access record yet', async () => {
    mockGetAgentModelAccess.mockResolvedValue([]);
    render(() => <AgentProviders />);
    await waitFor(() => {
      expect(screen.getByLabelText('Models for OpenAI Work')).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText('Models for OpenAI Work'));
    await waitFor(() => {
      expect(screen.getByTestId('model-access-modal')).toBeDefined();
    });
    const access = mockModalProps.mock.calls[0]![0].access;
    expect(access).toMatchObject({
      user_provider_id: 'up-openai',
      provider: 'openai',
      all_models: true,
      models: [],
      total_count: 0,
    });
    // Saving from the empty record adds the row rather than replacing one.
    fireEvent.click(screen.getByText('save-stub'));
    await waitFor(() => {
      expect(screen.getByText('1 of 2')).toBeDefined();
    });
  });
});

describe('AgentProviders — model access loading', () => {
  it('keeps the Models buttons disabled until model access has loaded', async () => {
    vi.clearAllMocks();
    mockGetGlobalProviders.mockResolvedValue(providersResponse);
    mockGetEnabledProviders.mockResolvedValue({ enabled: ['up-openai'] });
    mockGetCustomProviders.mockResolvedValue([]);
    let resolveAccess!: (v: unknown) => void;
    mockGetAgentModelAccess.mockReturnValue(new Promise((res) => (resolveAccess = res)));
    render(() => <AgentProviders />);
    await waitFor(() => {
      expect(screen.getByLabelText('Models for OpenAI Work')).toBeDefined();
    });
    expect((screen.getByLabelText('Models for OpenAI Work') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText('…')).toBeDefined();
    resolveAccess([]);
    await waitFor(() => {
      expect((screen.getByLabelText('Models for OpenAI Work') as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
  });
});
