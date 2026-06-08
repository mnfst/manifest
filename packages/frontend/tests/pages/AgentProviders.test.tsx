import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetGlobalProviders = vi.fn();
const mockGetAgentProviderAccess = vi.fn();
const mockGetAgentProviderDisableImpact = vi.fn();
const mockEnableAgentProviderAccess = vi.fn();
const mockDisableAgentProviderAccess = vi.fn();
const mockGetCustomProviders = vi.fn();

vi.mock('@solidjs/router', () => ({
  useParams: () => ({ agentName: 'demo-agent' }),
}));

vi.mock('../../src/services/api/providers.js', () => ({
  getProviders: (...args: unknown[]) => mockGetGlobalProviders(...args),
}));

vi.mock('../../src/services/api.js', () => ({
  getAgentProviderAccess: (...args: unknown[]) => mockGetAgentProviderAccess(...args),
  getAgentProviderDisableImpact: (...args: unknown[]) =>
    mockGetAgentProviderDisableImpact(...args),
  enableAgentProviderAccess: (...args: unknown[]) => mockEnableAgentProviderAccess(...args),
  disableAgentProviderAccess: (...args: unknown[]) => mockDisableAgentProviderAccess(...args),
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
    mockGetAgentProviderAccess.mockResolvedValue({ enabled: ['up-openai'] });
    mockGetAgentProviderDisableImpact.mockResolvedValue({
      affected_tiers: [{ tier: 'default', model: 'gpt-4o', position: 'primary' }],
    });
    mockEnableAgentProviderAccess.mockResolvedValue({ ok: true });
    mockDisableAgentProviderAccess.mockResolvedValue({ ok: true });
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

  it('renders connected global providers with grant toggles', async () => {
    render(() => <AgentProviders />);

    await waitFor(() => {
      expect(screen.getByText('OpenAI')).toBeDefined();
      expect(screen.getByText('Anthropic')).toBeDefined();
      expect(screen.getByText('Custom Gateway')).toBeDefined();
    });

    expect(screen.getAllByText('API Key').length).toBeGreaterThan(0);
    expect(screen.getByText('Subscription')).toBeDefined();
    expect(screen.getByLabelText('Disable OpenAI Work')).toBeDefined();
    expect(screen.getByLabelText('Enable Anthropic Max')).toBeDefined();
  });

  it('enables a provider grant with PUT', async () => {
    render(() => <AgentProviders />);

    await waitFor(() => {
      expect(screen.getByLabelText('Enable Anthropic Max')).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText('Enable Anthropic Max'));

    await waitFor(() => {
      expect(mockEnableAgentProviderAccess).toHaveBeenCalledWith('demo-agent', 'up-anthropic');
    });
  });

  it('shows disable impact before disabling with DELETE', async () => {
    render(() => <AgentProviders />);

    await waitFor(() => {
      expect(screen.getByLabelText('Disable OpenAI Work')).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText('Disable OpenAI Work'));

    await waitFor(() => {
      expect(mockGetAgentProviderDisableImpact).toHaveBeenCalledWith('demo-agent', 'up-openai');
      expect(screen.getByText('Disable provider')).toBeDefined();
      expect(screen.getByText('gpt-4o')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Disable'));
    await waitFor(() => {
      expect(mockDisableAgentProviderAccess).toHaveBeenCalledWith('demo-agent', 'up-openai');
    });
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
    mockGetAgentProviderAccess.mockRejectedValue(new Error('access failed'));
    mockGetCustomProviders.mockRejectedValue(new Error('custom failed'));

    render(() => <AgentProviders />);

    await waitFor(() => {
      expect(screen.getByText('No providers connected')).toBeDefined();
    });
  });

  it('still opens the disable dialog when impact lookup fails', async () => {
    mockGetAgentProviderDisableImpact.mockRejectedValue(new Error('impact failed'));
    render(() => <AgentProviders />);

    await waitFor(() => {
      expect(screen.getByLabelText('Disable OpenAI Work')).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText('Disable OpenAI Work'));

    await waitFor(() => {
      expect(screen.getByText('Disable provider')).toBeDefined();
    });
    expect(screen.queryByText('The following routing assignments will be removed:')).toBeNull();
  });

  it('closes the disable dialog with Escape and confirms with Enter', async () => {
    render(() => <AgentProviders />);

    await waitFor(() => {
      expect(screen.getByLabelText('Disable OpenAI Work')).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText('Disable OpenAI Work'));
    await waitFor(() => {
      expect(screen.getByText('Disable provider')).toBeDefined();
    });

    const overlay = screen.getByText('Disable provider').closest('.modal-overlay')!;
    fireEvent.keyDown(overlay, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText('Disable provider')).toBeNull();
    });

    fireEvent.click(screen.getByLabelText('Disable OpenAI Work'));
    await waitFor(() => {
      expect(screen.getByText('Disable provider')).toBeDefined();
    });
    fireEvent.keyDown(screen.getByText('Disable provider').closest('.modal-overlay')!, {
      key: 'Enter',
    });
    await waitFor(() => {
      expect(mockDisableAgentProviderAccess).toHaveBeenCalledWith('demo-agent', 'up-openai');
    });
  });

  it('clears busy state when enable or disable calls fail', async () => {
    mockEnableAgentProviderAccess.mockRejectedValueOnce(new Error('enable failed'));
    mockDisableAgentProviderAccess.mockRejectedValueOnce(new Error('disable failed'));
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
      expect(screen.getByText('Disable provider')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Disable'));
    await waitFor(() => {
      expect(screen.queryByText('Disable provider')).toBeNull();
    });
  });
});
