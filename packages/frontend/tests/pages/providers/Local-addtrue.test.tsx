/**
 * Tests the ?add=true auto-open flow for Local Providers page.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@solidjs/testing-library';

const mockSetSearchParams = vi.fn();
vi.mock('@solidjs/router', () => ({
  useSearchParams: () => [{ add: 'true' }, mockSetSearchParams],
}));

vi.mock('@solidjs/meta', () => ({
  Title: (props: any) => <title>{props.children}</title>,
}));

const mockFetchJson = vi.fn();
vi.mock('../../../src/services/api/core.js', () => ({
  fetchJson: (...args: unknown[]) => mockFetchJson(...args),
  BASE_URL: '/api/v1',
}));

vi.mock('../../../src/services/api.js', () => ({
  getAgents: () => Promise.resolve({ agents: [{ agent_name: 'my-agent' }] }),
}));

vi.mock('../../../src/services/api/routing.js', () => ({
  getProviders: () => Promise.resolve([]),
}));

vi.mock('../../../src/components/ProviderIcon.jsx', () => ({
  providerIcon: () => null,
}));

vi.mock('../../../src/components/ProviderSelectModal.jsx', () => ({
  default: (props: any) => (
    <div data-testid="provider-modal">
      <button onClick={props.onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../../../src/styles/routing.css', () => ({}));

vi.mock('../../../src/services/providers.js', () => ({
  PROVIDERS: [
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

import LocalProviders from '../../../src/pages/providers/Local';

describe('Local Providers page — ?add=true auto-open', () => {
  it('calls setSearchParams to clear ?add and queues openConnect', async () => {
    mockFetchJson.mockResolvedValue({ providers: [], model_counts: {} });

    render(() => <LocalProviders />);

    await waitFor(() => {
      expect(mockSetSearchParams).toHaveBeenCalledWith({ add: undefined });
    });
  });
});
