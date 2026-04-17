import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@solidjs/testing-library';

const mockSetSearchParams = vi.fn();

vi.mock('@solidjs/router', () => ({
  useParams: () => ({ agentName: 'test-agent' }),
  useLocation: () => ({ pathname: '/agents/test-agent/routing', state: null }),
  useSearchParams: () => [{ provider: 'custom', name: 'Groq', baseUrl: 'https://api.groq.com/v1' }, mockSetSearchParams],
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
  providerIcon: () => null, customProviderLogo: () => null,
}));

vi.mock('../../src/components/RoutingModals.js', () => ({
  default: (props: any) => (
    <>
      {props.showProviderModal() && (
        <div data-testid="provider-modal" data-prefill={JSON.stringify(props.customProviderPrefill ?? null)}>
          <button onClick={props.onProviderModalClose}>Done</button>
        </div>
      )}
    </>
  ),
}));

vi.mock('../../src/components/ModelPickerModal.js', () => ({
  default: () => null,
}));

const mockGetProviders = vi.fn();
const mockGetCustomProviders = vi.fn();

vi.mock('../../src/services/api.js', () => ({
  getTierAssignments: vi.fn().mockResolvedValue([
    { id: '1', user_id: 'u1', tier: 'simple', override_model: null, override_provider: null, auto_assigned_model: 'gpt-4o-mini', fallback_models: null, updated_at: '2025-01-01' },
    { id: '2', user_id: 'u1', tier: 'standard', override_model: null, override_provider: null, auto_assigned_model: 'gpt-4o-mini', fallback_models: null, updated_at: '2025-01-01' },
    { id: '3', user_id: 'u1', tier: 'complex', override_model: null, override_provider: null, auto_assigned_model: 'gpt-4o-mini', fallback_models: null, updated_at: '2025-01-01' },
    { id: '4', user_id: 'u1', tier: 'reasoning', override_model: null, override_provider: null, auto_assigned_model: 'gpt-4o-mini', fallback_models: null, updated_at: '2025-01-01' },
  ]),
  getAvailableModels: vi.fn().mockResolvedValue([]),
  getProviders: (...args: unknown[]) => mockGetProviders(...args),
  connectProvider: vi.fn().mockResolvedValue({}),
  deactivateAllProviders: vi.fn().mockResolvedValue({}),
  overrideTier: vi.fn().mockResolvedValue({}),
  resetTier: vi.fn().mockResolvedValue({}),
  resetAllTiers: vi.fn().mockResolvedValue({}),
  getCustomProviders: (...args: unknown[]) => mockGetCustomProviders(...args),
  updateCustomProvider: vi.fn().mockResolvedValue({}),
  deleteCustomProvider: vi.fn().mockResolvedValue({ ok: true }),
  setFallbacks: vi.fn().mockResolvedValue([]),
  clearFallbacks: vi.fn().mockResolvedValue(undefined),
  getModelPrices: vi.fn().mockResolvedValue([]),
  getAgentKey: vi.fn().mockResolvedValue({ keyPrefix: 'mnfst_abc', apiKey: 'mnfst_abc123' }),
  getHealth: vi.fn().mockResolvedValue({ mode: 'cloud' }),
  refreshModels: vi.fn().mockResolvedValue([]),
  getSpecificityAssignments: vi.fn().mockResolvedValue([]),
  overrideSpecificity: vi.fn().mockResolvedValue({}),
  getPricingHealth: vi.fn().mockResolvedValue({ model_count: 100, last_fetched_at: '2026-04-13T00:00:00.000Z' }),
  refreshPricing: vi.fn().mockResolvedValue({ ok: true, model_count: 100, last_fetched_at: '2026-04-13T00:00:00.000Z' }),
}));

vi.mock('../../src/services/routing-utils.js', () => ({
  pricePerM: () => '$0.00',
  resolveProviderId: () => null,
  inferProviderFromModel: () => null,
}));

vi.mock('../../src/components/AuthBadge.js', () => ({
  authBadgeFor: () => null,
}));

vi.mock('../../src/services/formatters.js', () => ({
  customProviderColor: () => '#abc',
}));

vi.mock('../../src/components/FallbackList.js', () => ({
  default: () => null,
}));

import Routing from '../../src/pages/Routing';

describe('Routing — customProviderPrefill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProviders.mockResolvedValue([]);
    mockGetCustomProviders.mockResolvedValue([]);
  });

  it('opens provider modal automatically when search params have provider=custom', async () => {
    render(() => <Routing />);
    await waitFor(() => {
      expect(screen.getByTestId('provider-modal')).toBeDefined();
    });
  });

  it('passes customProviderPrefill to the provider modal', async () => {
    render(() => <Routing />);
    await waitFor(() => {
      const modal = screen.getByTestId('provider-modal');
      const prefill = JSON.parse(modal.getAttribute('data-prefill') ?? 'null');
      expect(prefill).toEqual({
        name: 'Groq',
        baseUrl: 'https://api.groq.com/v1',
      });
    });
  });

  it('clears search params when provider modal is closed', async () => {
    render(() => <Routing />);
    await waitFor(() => {
      expect(screen.getByTestId('provider-modal')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Done'));
    expect(mockSetSearchParams).toHaveBeenCalledWith({
      provider: undefined,
      name: undefined,
      baseUrl: undefined,
      apiKey: undefined,
      models: undefined,
    });
  });
});
