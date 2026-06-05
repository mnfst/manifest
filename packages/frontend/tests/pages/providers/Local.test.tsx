import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';

// ── Router / meta mocks ──────────────────────────────────────────────────────
const mockSetSearchParams = vi.fn();
vi.mock('@solidjs/router', () => ({
  useSearchParams: () => [{ add: undefined }, mockSetSearchParams],
}));

vi.mock('@solidjs/meta', () => ({
  Title: (props: any) => <title>{props.children}</title>,
}));

// ── Services mocks ───────────────────────────────────────────────────────────
const mockFetchJson = vi.fn();
vi.mock('../../../src/services/api/core.js', () => ({
  fetchJson: (...args: unknown[]) => mockFetchJson(...args),
  BASE_URL: '/api/v1',
}));

const mockGetAgents = vi.fn();
vi.mock('../../../src/services/api.js', () => ({
  getAgents: (...args: unknown[]) => mockGetAgents(...args),
}));

const mockGetAgentProviders = vi.fn();
vi.mock('../../../src/services/api/routing.js', () => ({
  getProviders: (...args: unknown[]) => mockGetAgentProviders(...args),
}));

// ── Component mocks ──────────────────────────────────────────────────────────
vi.mock('../../../src/components/ProviderIcon.jsx', () => ({
  providerIcon: (id: string, size: number) => (
    <svg data-provider={id} width={size} height={size} />
  ),
}));

let capturedModalProps: any = null;

vi.mock('../../../src/components/ProviderSelectModal.jsx', () => ({
  default: (props: any) => {
    capturedModalProps = props;
    return (
      <div data-testid="provider-modal" data-initial-tab={props.initialTab}>
        <button onClick={props.onClose}>Close Modal</button>
        <button onClick={() => props.onUpdate()}>Trigger Update</button>
      </div>
    );
  },
}));

vi.mock('../../../src/styles/routing.css', () => ({}));

// ── Provider registry mock ───────────────────────────────────────────────────
vi.mock('../../../src/services/providers.js', () => ({
  PROVIDERS: [
    {
      id: 'anthropic',
      name: 'Anthropic',
      supportsSubscription: true,
      subscriptionOnly: false,
      localOnly: false,
      color: '#000',
      initial: 'A',
    },
    {
      id: 'ollama',
      name: 'Ollama',
      supportsSubscription: false,
      subscriptionOnly: false,
      localOnly: true,
      color: '#000',
      initial: 'Ol',
    },
    {
      id: 'lmstudio',
      name: 'LM Studio',
      supportsSubscription: false,
      subscriptionOnly: false,
      localOnly: true,
      color: '#000',
      initial: 'LM',
    },
  ],
}));

// ── Test data ────────────────────────────────────────────────────────────────
const makeProvidersResponse = (providers: any[] = []) => ({
  providers,
  model_counts: { ollama: 8, lmstudio: 4 },
});

const localConn = {
  id: 'conn-1',
  label: 'Local',
  key_prefix: null,
  cached_model_count: 8,
  is_active: true,
};

const twoLocalProviders = makeProvidersResponse([
  {
    provider: 'ollama',
    auth_type: 'local',
    connection_count: 1,
    connections: [localConn],
    total_models: 8,
  },
  {
    provider: 'lmstudio',
    auth_type: 'local',
    connection_count: 1,
    connections: [{ ...localConn, id: 'conn-2', cached_model_count: 4 }],
    total_models: 4,
  },
]);

import LocalProviders from '../../../src/pages/providers/Local';

describe('Local Providers page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedModalProps = null;
    mockGetAgents.mockResolvedValue({ agents: [{ agent_name: 'my-agent' }] });
    mockGetAgentProviders.mockResolvedValue([]);
  });

  // ── Connected table ──────────────────────────────────────────────────────
  it('renders connected local providers with provider name and model count', async () => {
    mockFetchJson.mockResolvedValue(twoLocalProviders);

    render(() => <LocalProviders />);

    await waitFor(() => {
      expect(screen.getByText('My Local Providers')).toBeDefined();
    });

    expect(screen.getAllByText('Ollama').length).toBeGreaterThan(0);
    expect(screen.getAllByText('LM Studio').length).toBeGreaterThan(0);
    // total_models values from twoLocalProviders (shown in connected table)
    const cells8 = screen.getAllByText('8');
    expect(cells8.length).toBeGreaterThan(0);
    const cells4 = screen.getAllByText('4');
    expect(cells4.length).toBeGreaterThan(0);
  });

  it('shows Active status badge for active local connections', async () => {
    mockFetchJson.mockResolvedValue(twoLocalProviders);

    render(() => <LocalProviders />);

    await waitFor(() => {
      expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    });
  });

  it('shows Inactive badge when first connection is inactive but another is active', async () => {
    // Local's connectedProviders includes providers with any active connection.
    // If connections[0] is inactive but connections[1] is active, the provider appears
    // in the connected table, and connections[0].is_active === false triggers Inactive.
    const mixedConnections = makeProvidersResponse([
      {
        provider: 'ollama',
        auth_type: 'local',
        connection_count: 2,
        connections: [
          { ...localConn, id: 'conn-inactive', is_active: false }, // first = inactive
          { ...localConn, id: 'conn-active', is_active: true }, // second = active
        ],
        total_models: 8,
      },
    ]);
    mockFetchJson.mockResolvedValue(mixedConnections);

    render(() => <LocalProviders />);

    await waitFor(() => {
      expect(screen.getByText('My Local Providers')).toBeDefined();
    });

    // connections[0].is_active === false → Inactive badge
    expect(screen.getByText('Inactive')).toBeDefined();
  });

  it('hides the connected table when no local connections are active', async () => {
    mockFetchJson.mockResolvedValue(makeProvidersResponse([]));

    render(() => <LocalProviders />);

    await waitFor(() => {
      expect(mockFetchJson).toHaveBeenCalled();
    });

    expect(screen.queryByText('My Local Providers')).toBeNull();
  });

  // ── Supported providers table ────────────────────────────────────────────
  it('renders Supported providers section with only localOnly providers', async () => {
    mockFetchJson.mockResolvedValue(makeProvidersResponse([]));

    render(() => <LocalProviders />);

    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });

    expect(screen.getByText('Ollama')).toBeDefined();
    expect(screen.getByText('LM Studio')).toBeDefined();
    // Non-local provider should not appear
    expect(screen.queryByText('Anthropic')).toBeNull();
  });

  it('Connect button opens modal with initialTab=local', async () => {
    mockFetchJson.mockResolvedValue(makeProvidersResponse([]));

    render(() => <LocalProviders />);

    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });

    const connectBtns = screen.getAllByText('Connect');
    fireEvent.click(connectBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('provider-modal')).toBeDefined();
    });

    expect(capturedModalProps?.initialTab).toBe('local');
  });

  it('header "Add local provider" button opens modal with initialTab=local', async () => {
    mockFetchJson.mockResolvedValue(makeProvidersResponse([]));

    render(() => <LocalProviders />);

    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Add local provider'));

    await waitFor(() => {
      expect(screen.getByTestId('provider-modal')).toBeDefined();
    });

    expect(capturedModalProps?.initialTab).toBe('local');
  });

  it('providerDeepLink has authType local when a provider is selected', async () => {
    mockFetchJson.mockResolvedValue(makeProvidersResponse([]));

    render(() => <LocalProviders />);

    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });

    const connectBtns = screen.getAllByText('Connect');
    fireEvent.click(connectBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('provider-modal')).toBeDefined();
    });

    expect(capturedModalProps?.providerDeepLink?.authType).toBe('local');
  });

  // ── Regression: no analytics / charts ───────────────────────────────────
  it('does NOT render savings / cost (30d) / last used / usage (30d) text', async () => {
    mockFetchJson.mockResolvedValue(twoLocalProviders);

    render(() => <LocalProviders />);

    await waitFor(() => {
      expect(screen.getByText('Ollama')).toBeDefined();
    });

    expect(screen.queryByText(/savings/i)).toBeNull();
    expect(screen.queryByText(/cost \(30d\)/i)).toBeNull();
    expect(screen.queryByText(/last used/i)).toBeNull();
    expect(screen.queryByText(/usage \(30d\)/i)).toBeNull();
  });

  // ── View toggle ──────────────────────────────────────────────────────────
  it('switches to grid view when grid button is clicked', async () => {
    mockFetchJson.mockResolvedValue(makeProvidersResponse([]));

    const { container } = render(() => <LocalProviders />);

    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText('Grid view'));

    await waitFor(() => {
      const cards = container.querySelectorAll('.panel');
      expect(cards.length).toBeGreaterThan(0);
    });
  });

  it('shows Connected indicator in supported providers list when provider is connected', async () => {
    mockFetchJson.mockResolvedValue(twoLocalProviders);

    render(() => <LocalProviders />);

    // Wait for data to fully load (connected table shows up)
    await waitFor(() => {
      expect(screen.getByText('My Local Providers')).toBeDefined();
    });

    const connectedTexts = screen.getAllByText('Connected');
    expect(connectedTexts.length).toBeGreaterThan(0);
  });

  // ── Error / loading states ───────────────────────────────────────────────
  it('shows page structure when providers fetch fails', async () => {
    mockFetchJson.mockRejectedValue(new Error('network'));

    render(() => <LocalProviders />);

    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });

    expect(screen.queryByText('My Local Providers')).toBeNull();
  });

  it('shows page structure when agents fetch fails', async () => {
    mockFetchJson.mockResolvedValue(makeProvidersResponse([]));
    mockGetAgents.mockRejectedValue(new Error('agent error'));

    render(() => <LocalProviders />);

    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });
  });

  it('closes modal on close action', async () => {
    mockFetchJson.mockResolvedValue(makeProvidersResponse([]));

    render(() => <LocalProviders />);

    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Add local provider'));

    await waitFor(() => {
      expect(screen.getByTestId('provider-modal')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Close Modal'));

    await waitFor(() => {
      expect(screen.queryByTestId('provider-modal')).toBeNull();
    });
  });

  it('shows grid view with Connected indicator when provider is connected', async () => {
    mockFetchJson.mockResolvedValue(twoLocalProviders);

    const { container } = render(() => <LocalProviders />);

    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText('Grid view'));

    await waitFor(() => {
      const cards = container.querySelectorAll('.panel');
      expect(cards.length).toBeGreaterThan(0);
    });

    const connectedTexts = screen.getAllByText('Connected');
    expect(connectedTexts.length).toBeGreaterThan(0);
  });

  it('onUpdate callback refetches data', async () => {
    mockFetchJson.mockResolvedValue(makeProvidersResponse([]));

    render(() => <LocalProviders />);

    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Add local provider'));

    await waitFor(() => {
      expect(screen.getByTestId('provider-modal')).toBeDefined();
    });

    // Trigger onUpdate
    fireEvent.click(screen.getByText('Trigger Update'));

    await waitFor(() => {
      expect(mockFetchJson.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it('providerDeepLink has addKey=true when the provider is already connected', async () => {
    mockFetchJson.mockResolvedValue(twoLocalProviders);

    render(() => <LocalProviders />);

    await waitFor(() => {
      expect(screen.getByText('My Local Providers')).toBeDefined();
    });

    // Click Connect for a provider that is already connected
    const connectBtns = screen.getAllByText('Connect');
    fireEvent.click(connectBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('provider-modal')).toBeDefined();
    });

    expect(capturedModalProps?.providerDeepLink?.addKey).toBe(true);
  });

  it('renders grid view without connected indicator when no providers connected', async () => {
    mockFetchJson.mockResolvedValue(makeProvidersResponse([]));

    const { container } = render(() => <LocalProviders />);

    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText('Grid view'));

    await waitFor(() => {
      const cards = container.querySelectorAll('.panel');
      expect(cards.length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('Connected')).toBeNull();
  });

  it('handles getAgentProviders failure gracefully', async () => {
    mockFetchJson.mockResolvedValue(makeProvidersResponse([]));
    mockGetAgentProviders.mockRejectedValue(new Error('providers fetch failed'));

    render(() => <LocalProviders />);

    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });

    // Try to open the modal (agent providers will fail but page stays operational)
    const connectBtns = screen.getAllByText('Connect');
    fireEvent.click(connectBtns[0]);

    // Page should still be operational
    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });
  });
});
