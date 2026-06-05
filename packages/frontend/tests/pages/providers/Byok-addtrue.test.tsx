/**
 * Tests the ?add=true auto-open flow for Byok page.
 * In a separate file to allow a fresh mock for useSearchParams.
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
      id: 'openai',
      name: 'OpenAI',
      supportsSubscription: true,
      subscriptionOnly: false,
      localOnly: false,
      color: '#000',
      initial: 'O',
    },
  ],
}));

import Byok from '../../../src/pages/providers/Byok';

describe('Byok page — ?add=true auto-open', () => {
  it('calls setSearchParams to clear ?add and queues openConnect', async () => {
    mockFetchJson.mockResolvedValue({ providers: [], model_counts: {} });

    render(() => <Byok />);

    await waitFor(() => {
      expect(mockSetSearchParams).toHaveBeenCalledWith({ add: undefined });
    });
  });
});
