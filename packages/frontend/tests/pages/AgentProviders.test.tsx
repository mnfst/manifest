import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';

const apiMocks = vi.hoisted(() => ({
  fetchJson: vi.fn(),
  getAgentProviderAccess: vi.fn(),
  getAgentProviderDisableImpact: vi.fn(),
  enableAgentProviderAccess: vi.fn(),
  disableAgentProviderAccess: vi.fn(),
  getCustomProviders: vi.fn(),
}));

vi.mock('@solidjs/router', () => ({
  useParams: () => ({ agentName: 'demo-agent' }),
}));

vi.mock('../../src/services/api.js', () => ({
  fetchJson: (...args: unknown[]) => apiMocks.fetchJson(...args),
  getAgentProviderAccess: (...args: unknown[]) => apiMocks.getAgentProviderAccess(...args),
  getAgentProviderDisableImpact: (...args: unknown[]) =>
    apiMocks.getAgentProviderDisableImpact(...args),
  enableAgentProviderAccess: (...args: unknown[]) => apiMocks.enableAgentProviderAccess(...args),
  disableAgentProviderAccess: (...args: unknown[]) => apiMocks.disableAgentProviderAccess(...args),
  getCustomProviders: (...args: unknown[]) => apiMocks.getCustomProviders(...args),
}));

vi.mock('../../src/components/ProviderIcon.jsx', () => ({
  providerIcon: (provider: string) =>
    provider.startsWith('custom:') ? null : <span data-provider-icon={provider} />,
}));

vi.mock('../../src/services/providers.js', () => ({
  PROVIDERS: [
    { id: 'openai', name: 'OpenAI' },
    { id: 'anthropic', name: 'Anthropic' },
  ],
}));

vi.mock('../../src/services/formatters.js', () => ({
  customProviderColor: () => 'rgb(0, 0, 0)',
}));

import AgentProviders from '../../src/pages/AgentProviders';

const providersResponse = {
  providers: [
    {
      provider: 'openai',
      auth_type: 'api_key',
      connection_count: 1,
      total_models: 12,
      connections: [
        {
          id: 'up-openai',
          label: 'Default',
          cached_model_count: 10,
          is_active: true,
        },
      ],
    },
    {
      provider: 'anthropic',
      auth_type: 'subscription',
      connection_count: 1,
      total_models: 5,
      connections: [
        {
          id: 'up-anthropic',
          label: 'Work',
          cached_model_count: 5,
          is_active: true,
        },
      ],
    },
    {
      provider: 'custom:cp-1',
      auth_type: 'api_key',
      connection_count: 1,
      total_models: 3,
      connections: [
        {
          id: 'up-custom',
          label: 'Custom Key',
          cached_model_count: 0,
          is_active: true,
        },
      ],
    },
  ],
};

describe('AgentProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.fetchJson.mockResolvedValue(providersResponse);
    apiMocks.getAgentProviderAccess.mockResolvedValue({ enabled: ['up-openai'] });
    apiMocks.getAgentProviderDisableImpact.mockResolvedValue({ affected_tiers: [] });
    apiMocks.enableAgentProviderAccess.mockResolvedValue({ ok: true });
    apiMocks.disableAgentProviderAccess.mockResolvedValue({ ok: true });
    apiMocks.getCustomProviders.mockResolvedValue([{ id: 'cp-1', name: 'Custom Provider' }]);
  });

  it('renders provider connections and marks enabled access rows on', async () => {
    render(() => <AgentProviders />);

    await waitFor(() => {
      expect(screen.getByText('OpenAI')).toBeDefined();
      expect(screen.getByText('Anthropic')).toBeDefined();
      expect(screen.getByText('Custom Provider')).toBeDefined();
    });

    const enabledSwitch = screen.getByLabelText('Disable OpenAI Default');
    const disabledSwitch = screen.getByLabelText('Enable Anthropic Work');
    expect(enabledSwitch.classList.contains('routing-switch--on')).toBe(true);
    expect(disabledSwitch.classList.contains('routing-switch--on')).toBe(false);
    expect(screen.getAllByText('API Key')).toHaveLength(2);
    expect(screen.getByText('Subscription')).toBeDefined();
  });

  it('enables a provider access row from an off switch', async () => {
    apiMocks.getAgentProviderAccess.mockResolvedValue({ enabled: [] });

    render(() => <AgentProviders />);

    await waitFor(() => {
      expect(screen.getByLabelText('Enable OpenAI Default')).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText('Enable OpenAI Default'));

    await waitFor(() => {
      expect(apiMocks.enableAgentProviderAccess).toHaveBeenCalledWith('demo-agent', 'up-openai');
    });
  });

  it('confirms disable and shows affected routing assignments', async () => {
    apiMocks.getAgentProviderDisableImpact.mockResolvedValue({
      affected_tiers: [{ tier: 'Simple', model: 'gpt-5', position: 'primary' }],
    });

    render(() => <AgentProviders />);

    await waitFor(() => {
      expect(screen.getByLabelText('Disable OpenAI Default')).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText('Disable OpenAI Default'));

    await waitFor(() => {
      expect(screen.getByText('Disable provider')).toBeDefined();
      expect(screen.getByText('gpt-5')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Disable' }));

    await waitFor(() => {
      expect(apiMocks.disableAgentProviderAccess).toHaveBeenCalledWith('demo-agent', 'up-openai');
    });
  });

  it('supports keyboard dismissal and confirmation in the disable modal', async () => {
    render(() => <AgentProviders />);

    await waitFor(() => {
      expect(screen.getByLabelText('Disable OpenAI Default')).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText('Disable OpenAI Default'));
    await waitFor(() => expect(screen.getByText('Disable provider')).toBeDefined());
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('Disable provider')).toBeNull());

    fireEvent.click(screen.getByLabelText('Disable OpenAI Default'));
    await waitFor(() => expect(screen.getByText('Disable provider')).toBeDefined());
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' });

    await waitFor(() => {
      expect(apiMocks.disableAgentProviderAccess).toHaveBeenCalledWith('demo-agent', 'up-openai');
    });
  });

  it('falls back to empty state when provider access requests fail', async () => {
    apiMocks.fetchJson.mockRejectedValue(new Error('providers failed'));
    apiMocks.getAgentProviderAccess.mockRejectedValue(new Error('access failed'));
    apiMocks.getCustomProviders.mockRejectedValue(new Error('custom providers failed'));

    render(() => <AgentProviders />);

    await waitFor(() => {
      expect(screen.getByText('No providers connected')).toBeDefined();
    });
  });

  it('shows an empty state when no global providers are connected', async () => {
    apiMocks.fetchJson.mockResolvedValue({ providers: [] });

    render(() => <AgentProviders />);

    await waitFor(() => {
      expect(screen.getByText('No providers connected')).toBeDefined();
    });
  });
});
