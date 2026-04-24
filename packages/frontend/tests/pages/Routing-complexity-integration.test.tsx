import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';

const mockSetSearchParams = vi.fn();

vi.mock('@solidjs/router', () => ({
  useParams: () => ({ agentName: 'test-agent' }),
  useLocation: () => ({ pathname: '/agents/test-agent/routing', state: null }),
  useSearchParams: () => [{}, mockSetSearchParams],
  useNavigate: () => vi.fn(),
  A: (props: any) => <a href={props.href}>{props.children}</a>,
}));

vi.mock('@solidjs/meta', () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: (props: any) => <meta name={props.name ?? ''} content={props.content ?? ''} />,
}));

vi.mock('../../src/services/toast-store.js', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock('../../src/components/ProviderIcon.js', () => ({
  providerIcon: () => null,
  customProviderLogo: () => null,
}));

vi.mock('../../src/components/RoutingModals.js', () => ({
  default: () => null,
}));

vi.mock('../../src/components/ModelPickerModal.js', () => ({
  default: () => null,
}));

vi.mock('../../src/components/AuthBadge.js', () => ({
  authBadgeFor: () => null,
}));

vi.mock('../../src/components/FallbackList.js', () => ({
  default: () => null,
}));

vi.mock('../../src/services/formatters.js', () => ({
  customProviderColor: () => '#abc',
}));

vi.mock('../../src/services/routing-utils.js', () => ({
  pricePerM: () => '$0.00',
  resolveProviderId: () => null,
  inferProviderFromModel: () => null,
}));

vi.mock('../../src/services/api/header-tiers.js', () => ({
  listHeaderTiers: vi.fn().mockResolvedValue([]),
}));

const mockGetProviders = vi.fn();
const mockToggleComplexity = vi.fn();
const mockGetComplexityStatus = vi.fn();

vi.mock('../../src/services/api.js', () => ({
  getTierAssignments: vi.fn().mockResolvedValue([
    {
      id: '1',
      user_id: 'u1',
      agent_id: 'a',
      tier: 'simple',
      override_model: null,
      override_provider: null,
      override_auth_type: null,
      auto_assigned_model: 'gpt-4o-mini',
      fallback_models: null,
      updated_at: '2025-01-01',
    },
    {
      id: '2',
      user_id: 'u1',
      agent_id: 'a',
      tier: 'standard',
      override_model: null,
      override_provider: null,
      override_auth_type: null,
      auto_assigned_model: 'gpt-4o-mini',
      fallback_models: null,
      updated_at: '2025-01-01',
    },
    {
      id: '3',
      user_id: 'u1',
      agent_id: 'a',
      tier: 'complex',
      override_model: null,
      override_provider: null,
      override_auth_type: null,
      auto_assigned_model: 'claude-sonnet-4',
      fallback_models: null,
      updated_at: '2025-01-01',
    },
    {
      id: '4',
      user_id: 'u1',
      agent_id: 'a',
      tier: 'reasoning',
      override_model: null,
      override_provider: null,
      override_auth_type: null,
      auto_assigned_model: 'claude-opus-4-6',
      fallback_models: null,
      updated_at: '2025-01-01',
    },
    {
      id: '5',
      user_id: 'u1',
      agent_id: 'a',
      tier: 'default',
      override_model: null,
      override_provider: null,
      override_auth_type: null,
      auto_assigned_model: 'gpt-4o-mini',
      fallback_models: null,
      updated_at: '2025-01-01',
    },
  ]),
  getAvailableModels: vi.fn().mockResolvedValue([
    {
      model_name: 'gpt-4o-mini',
      provider: 'OpenAI',
      display_name: 'GPT-4o Mini',
      input_price_per_token: 0.00000015,
      output_price_per_token: 0.0000006,
      context_window: 128000,
      capability_reasoning: false,
      capability_code: true,
    },
  ]),
  getProviders: (...args: unknown[]) => mockGetProviders(...args),
  getCustomProviders: vi.fn().mockResolvedValue([]),
  getSpecificityAssignments: vi.fn().mockResolvedValue([
    {
      id: 'sa1',
      agent_id: 'a',
      category: 'coding',
      is_active: true,
      override_model: 'gpt-4o',
      override_provider: 'openai',
      override_auth_type: null,
      auto_assigned_model: null,
      fallback_models: null,
      updated_at: '2025-01-01',
    },
  ]),
  overrideSpecificity: vi.fn().mockResolvedValue({}),
  resetSpecificity: vi.fn().mockResolvedValue({}),
  setSpecificityFallbacks: vi.fn().mockResolvedValue([]),
  clearSpecificityFallbacks: vi.fn().mockResolvedValue(undefined),
  getComplexityStatus: (...args: unknown[]) => mockGetComplexityStatus(...args),
  toggleComplexity: (...args: unknown[]) => mockToggleComplexity(...args),
  refreshModels: vi.fn().mockResolvedValue([]),
  connectProvider: vi.fn().mockResolvedValue({}),
  deactivateAllProviders: vi.fn().mockResolvedValue({}),
  overrideTier: vi.fn().mockResolvedValue({}),
  resetTier: vi.fn().mockResolvedValue({}),
  resetAllTiers: vi.fn().mockResolvedValue({}),
  setFallbacks: vi.fn().mockResolvedValue([]),
  clearFallbacks: vi.fn().mockResolvedValue(undefined),
  updateCustomProvider: vi.fn().mockResolvedValue({}),
  deleteCustomProvider: vi.fn().mockResolvedValue({ ok: true }),
  getPricingHealth: vi.fn().mockResolvedValue({
    model_count: 100,
    last_fetched_at: '2026-04-13T00:00:00.000Z',
  }),
  refreshPricing: vi
    .fn()
    .mockResolvedValue({ ok: true, model_count: 100, last_fetched_at: '2026-04-13T00:00:00.000Z' }),
}));

import Routing from '../../src/pages/Routing';

describe('Routing — default tier + complexity integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProviders.mockResolvedValue([
      {
        id: 'p1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
        has_api_key: true,
        connected_at: '2025-01-01',
      },
    ]);
    mockGetComplexityStatus.mockResolvedValue({ enabled: true });
    mockToggleComplexity.mockResolvedValue({ ok: true, enabled: true });
  });

  it('renders tabs with Default as first tab and providers connected', async () => {
    render(() => <Routing />);
    await waitFor(() => {
      expect(screen.getByRole('tablist')).toBeDefined();
    });
    expect(screen.getByRole('tab', { name: /Default/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Complexity/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Task-specific/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Custom/ })).toBeDefined();
    // Default tab content visible by default
    expect(screen.getAllByText('Default model').length).toBeGreaterThan(0);
  });

  it('shows pipeline help button when complexity and specificity are both on', async () => {
    render(() => <Routing />);
    await waitFor(() => {
      expect(screen.getByLabelText('How routing works')).toBeDefined();
    });
  });

  it('shows "All requests" subtitle when complexity is off', async () => {
    mockGetComplexityStatus.mockResolvedValue({ enabled: false });
    render(() => <Routing />);
    await waitFor(() => {
      expect(screen.getByText('All requests route through this model')).toBeDefined();
    });
  });

  it('shows "Safety net" subtitle when complexity is on', async () => {
    render(() => <Routing />);
    await waitFor(() => {
      expect(
        screen.getByText('Acts as a safety net and handles requests that complexity routing can\u2019t resolve'),
      ).toBeDefined();
    });
  });

  it('flips the complexity switch and calls toggleComplexity', async () => {
    mockGetComplexityStatus.mockResolvedValue({ enabled: false });
    render(() => <Routing />);
    await screen.findByRole('tablist');
    fireEvent.click(screen.getByRole('tab', { name: /Complexity/ }));
    await waitFor(() => {
      expect(screen.getByText('Complexity routing is off')).toBeDefined();
    });
    fireEvent.click(screen.getAllByText('Enable complexity routing')[0]);
    await waitFor(() => {
      expect(mockToggleComplexity).toHaveBeenCalledWith('test-agent', true);
    });
  });

  it('hides pipeline description when complexity is off and no specificity', async () => {
    mockGetComplexityStatus.mockResolvedValue({ enabled: false });
    const { getSpecificityAssignments } = await import('../../src/services/api.js');
    vi.mocked(getSpecificityAssignments).mockResolvedValue([]);
    render(() => <Routing />);
    await waitFor(() => {
      expect(screen.getByRole('tablist')).toBeDefined();
    });
    expect(screen.queryByLabelText('How routing works')).toBeNull();
  });
});
