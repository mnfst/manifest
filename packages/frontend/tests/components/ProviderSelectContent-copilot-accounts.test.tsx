import { render, waitFor } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import type { RoutingProvider } from '../../src/services/api';

vi.mock('../../src/services/api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/api')>();

  return {
    ...actual,
    connectProvider: vi.fn(),
    disconnectProvider: vi.fn().mockResolvedValue({ notifications: [] }),
  };
});

vi.mock('../../src/services/setup-status.js', () => ({
  checkIsSelfHosted: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../src/services/toast-store.js', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock('../../src/components/ProviderIcon.js', () => ({
  providerIcon: () => null,
  customProviderLogo: () => null,
}));

vi.mock('../../src/components/CopilotDeviceLogin.js', () => ({
  default: (props: {
    activeKeys?: Array<{ label: string }>;
    agentName: string;
    connected: boolean;
  }) => (
    <div
      data-testid="copilot-device-login"
      data-agent={props.agentName}
      data-connected={String(props.connected)}
      data-active-count={String((props.activeKeys ?? []).length)}
      data-active-labels={(props.activeKeys ?? []).map((key) => key.label).join(',')}
    />
  ),
}));

import ProviderSelectContent from '../../src/components/ProviderSelectContent';

describe('ProviderSelectContent Copilot accounts', () => {
  it('passes only active Copilot accounts with usable tokens to the detail view', async () => {
    const providers: RoutingProvider[] = [
      {
        id: 'pending',
        provider: 'copilot',
        auth_type: 'subscription',
        is_active: true,
        has_api_key: false,
        label: 'Pending',
        priority: 0,
        connected_at: '2026-05-21T00:00:00.000Z',
      },
      {
        id: 'work',
        provider: 'copilot',
        auth_type: 'subscription',
        is_active: true,
        has_api_key: true,
        label: 'Work',
        priority: 1,
        connected_at: '2026-05-21T00:00:00.000Z',
      },
    ];

    // The provider list/tile view was removed; the Copilot detail view is now
    // reached via a deep link instead of clicking a "GitHub Copilot" tile.
    const { container } = render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={providers}
        providerDeepLink={{ providerId: 'copilot', authType: 'subscription' }}
        onUpdate={vi.fn()}
      />
    ));

    const detail = await waitFor(() => {
      const element = container.querySelector('[data-testid="copilot-device-login"]');
      if (!element) throw new Error('Copilot detail view not found');
      return element;
    });

    expect(detail.getAttribute('data-active-count')).toBe('1');
    expect(detail.getAttribute('data-active-labels')).toBe('Work');
  });
});
