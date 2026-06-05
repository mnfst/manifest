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

const mockModalOnUpdate = vi.fn();
const mockModalOnClose = vi.fn();
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
      id: 'openai',
      name: 'OpenAI',
      supportsSubscription: true,
      subscriptionOnly: false,
      localOnly: false,
      color: '#000',
      initial: 'O',
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      supportsSubscription: false,
      subscriptionOnly: false,
      localOnly: false,
      color: '#000',
      initial: 'D',
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
  ],
}));

// ── Test data ────────────────────────────────────────────────────────────────
const makeProvidersResponse = (providers: any[] = []) => ({
  providers,
  model_counts: { anthropic: 10, openai: 20 },
});

const subscriptionConn = {
  id: 'conn-1',
  label: 'Personal',
  key_prefix: null,
  cached_model_count: 5,
  is_active: true,
};

const twoSubscriptions = makeProvidersResponse([
  {
    provider: 'anthropic',
    auth_type: 'subscription',
    connection_count: 1,
    connections: [subscriptionConn],
    total_models: 5,
  },
  {
    provider: 'openai',
    auth_type: 'subscription',
    connection_count: 1,
    connections: [{ ...subscriptionConn, id: 'conn-2', label: 'Work', cached_model_count: 8 }],
    total_models: 8,
  },
]);

import Subscriptions from '../../../src/pages/providers/Subscriptions';

describe('Subscriptions page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedModalProps = null;
    mockGetAgents.mockResolvedValue({ agents: [{ agent_name: 'my-agent' }] });
    mockGetAgentProviders.mockResolvedValue([]);
  });

  // ── Connected table ──────────────────────────────────────────────────────
  it('renders connected subscription rows with provider name and model count', async () => {
    mockFetchJson.mockResolvedValue(twoSubscriptions);

    render(() => <Subscriptions />);

    await waitFor(() => {
      expect(screen.getByText('My Subscriptions')).toBeDefined();
    });

    expect(screen.getAllByText('Anthropic').length).toBeGreaterThan(0);
    expect(screen.getAllByText('OpenAI').length).toBeGreaterThan(0);
    // model counts from connections (cached_model_count: 5 and 8)
    const cells5 = screen.getAllByText('5');
    expect(cells5.length).toBeGreaterThan(0);
    const cells8 = screen.getAllByText('8');
    expect(cells8.length).toBeGreaterThan(0);
    // labels
    expect(screen.getByText('Personal')).toBeDefined();
    expect(screen.getByText('Work')).toBeDefined();
  });

  it('shows Active status badge for active connections', async () => {
    mockFetchJson.mockResolvedValue(twoSubscriptions);

    render(() => <Subscriptions />);

    await waitFor(() => {
      expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    });
  });

  it('shows Inactive badge for inactive connections', async () => {
    const mixed = makeProvidersResponse([
      {
        provider: 'anthropic',
        auth_type: 'subscription',
        connection_count: 2,
        connections: [
          subscriptionConn, // is_active: true
          { ...subscriptionConn, id: 'conn-inactive', label: 'Old', is_active: false },
        ],
        total_models: 5,
      },
    ]);
    mockFetchJson.mockResolvedValue(mixed);

    render(() => <Subscriptions />);

    await waitFor(() => {
      expect(screen.getByText('My Subscriptions')).toBeDefined();
    });

    // Both Active and Inactive badges should appear
    expect(screen.getByText('Active')).toBeDefined();
    expect(screen.getByText('Inactive')).toBeDefined();
  });

  it('hides the connected table when no subscriptions are active', async () => {
    mockFetchJson.mockResolvedValue(makeProvidersResponse([]));

    const { container } = render(() => <Subscriptions />);

    await waitFor(() => {
      expect(mockFetchJson).toHaveBeenCalled();
    });

    // "My Subscriptions" heading should not appear
    expect(screen.queryByText('My Subscriptions')).toBeNull();
  });

  // ── Supported providers table ────────────────────────────────────────────
  it('renders the Supported providers section with subscription providers', async () => {
    mockFetchJson.mockResolvedValue(makeProvidersResponse([]));

    render(() => <Subscriptions />);

    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });

    // Only supportsSubscription providers should appear
    expect(screen.getByText('Anthropic')).toBeDefined();
    expect(screen.getByText('OpenAI')).toBeDefined();
    // DeepSeek has supportsSubscription=false → should not appear
    expect(screen.queryByText('DeepSeek')).toBeNull();
    // Ollama is localOnly → should not appear
    expect(screen.queryByText('Ollama')).toBeNull();
  });

  it('Add subscription button in the supported-providers list opens modal with initialTab=subscription', async () => {
    mockFetchJson.mockResolvedValue(makeProvidersResponse([]));

    render(() => <Subscriptions />);

    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });

    const addBtns = screen.getAllByText('Add subscription');
    // Click the first provider's Add button (not the header button)
    const providerAddBtn = addBtns.find((btn) => btn.closest('tr'));
    if (providerAddBtn) {
      fireEvent.click(providerAddBtn);
    } else {
      fireEvent.click(addBtns[0]);
    }

    await waitFor(() => {
      expect(screen.getByTestId('provider-modal')).toBeDefined();
    });

    expect(capturedModalProps?.initialTab).toBe('subscription');
  });

  it('header "Add subscription" button opens modal with initialTab=subscription', async () => {
    mockFetchJson.mockResolvedValue(makeProvidersResponse([]));

    render(() => <Subscriptions />);

    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });

    // First button in the page header
    const headerBtn = screen.getAllByText('Add subscription')[0];
    fireEvent.click(headerBtn);

    await waitFor(() => {
      expect(screen.getByTestId('provider-modal')).toBeDefined();
    });

    expect(capturedModalProps?.initialTab).toBe('subscription');
  });

  it('providerDeepLink has authType subscription when provider selected', async () => {
    mockFetchJson.mockResolvedValue(makeProvidersResponse([]));

    render(() => <Subscriptions />);

    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });

    const addBtns = screen.getAllByText('Add subscription');
    fireEvent.click(addBtns[1]); // second button = first provider row

    await waitFor(() => {
      expect(screen.getByTestId('provider-modal')).toBeDefined();
    });

    expect(capturedModalProps?.providerDeepLink?.authType).toBe('subscription');
  });

  // ── Regression: no analytics / charts ───────────────────────────────────
  it('does NOT render any savings / cost (30d) / last used / sparkline text', async () => {
    mockFetchJson.mockResolvedValue(twoSubscriptions);

    render(() => <Subscriptions />);

    await waitFor(() => {
      expect(screen.getByText('Anthropic')).toBeDefined();
    });

    expect(screen.queryByText(/savings/i)).toBeNull();
    expect(screen.queryByText(/cost \(30d\)/i)).toBeNull();
    expect(screen.queryByText(/last used/i)).toBeNull();
    expect(screen.queryByText(/usage \(30d\)/i)).toBeNull();
  });

  // ── View toggle ──────────────────────────────────────────────────────────
  it('switches to grid view when grid button is clicked', async () => {
    mockFetchJson.mockResolvedValue(makeProvidersResponse([]));

    const { container } = render(() => <Subscriptions />);

    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });

    const gridBtn = screen.getByLabelText('Grid view');
    fireEvent.click(gridBtn);

    // In grid view the panel cards are rendered — no data-table with Provider/Models header row
    await waitFor(() => {
      const cards = container.querySelectorAll('.panel');
      expect(cards.length).toBeGreaterThan(0);
    });
  });

  // ── Error / loading states ───────────────────────────────────────────────
  it('shows the page structure even when providers fetch fails', async () => {
    mockFetchJson.mockRejectedValue(new Error('network error'));

    render(() => <Subscriptions />);

    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });

    // No connected table with "My Subscriptions"
    expect(screen.queryByText('My Subscriptions')).toBeNull();
  });

  it('shows the page structure even when agents fetch fails', async () => {
    mockFetchJson.mockResolvedValue(makeProvidersResponse([]));
    mockGetAgents.mockRejectedValue(new Error('agent error'));

    render(() => <Subscriptions />);

    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });
  });

  it('closes modal on handleModalClose', async () => {
    mockFetchJson.mockResolvedValue(makeProvidersResponse([]));

    render(() => <Subscriptions />);

    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });

    // Open modal
    const addBtns = screen.getAllByText('Add subscription');
    fireEvent.click(addBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('provider-modal')).toBeDefined();
    });

    // Close modal
    fireEvent.click(screen.getByText('Close Modal'));

    await waitFor(() => {
      expect(screen.queryByTestId('provider-modal')).toBeNull();
    });
  });

  it('shows active connection count in supported providers list', async () => {
    mockFetchJson.mockResolvedValue(twoSubscriptions);

    render(() => <Subscriptions />);

    // Wait for data to load (connected table appears)
    await waitFor(() => {
      expect(screen.getByText('My Subscriptions')).toBeDefined();
    });

    // active connection badges in the supported providers list
    const activeTexts = screen.getAllByText(/active connection/);
    expect(activeTexts.length).toBeGreaterThan(0);
  });

  it('onUpdate callback refetches data', async () => {
    mockFetchJson.mockResolvedValue(makeProvidersResponse([]));

    render(() => <Subscriptions />);

    await waitFor(() => {
      expect(screen.getByText('Supported providers')).toBeDefined();
    });

    const addBtns = screen.getAllByText('Add subscription');
    fireEvent.click(addBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('provider-modal')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Trigger Update'));

    await waitFor(() => {
      expect(mockFetchJson.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it('providerDeepLink has addKey=true when the provider is already connected', async () => {
    mockFetchJson.mockResolvedValue(twoSubscriptions);

    render(() => <Subscriptions />);

    await waitFor(() => {
      expect(screen.getByText('My Subscriptions')).toBeDefined();
    });

    const addBtns = screen.getAllByText('Add subscription');
    // Click the provider-row button for anthropic (already connected)
    fireEvent.click(addBtns[1]);

    await waitFor(() => {
      expect(screen.getByTestId('provider-modal')).toBeDefined();
    });

    expect(capturedModalProps?.providerDeepLink?.addKey).toBe(true);
  });

  it('renders grid view with active connection indicator for connected providers', async () => {
    mockFetchJson.mockResolvedValue(twoSubscriptions);

    render(() => <Subscriptions />);

    await waitFor(() => {
      expect(screen.getByText('My Subscriptions')).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText('Grid view'));

    await waitFor(() => {
      const activeTexts = screen.getAllByText(/active connection/);
      expect(activeTexts.length).toBeGreaterThan(0);
    });
  });
});
