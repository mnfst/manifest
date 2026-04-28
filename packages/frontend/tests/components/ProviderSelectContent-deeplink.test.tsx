import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';

vi.mock('../../src/services/api.js', () => ({
  connectProvider: vi.fn(),
  disconnectProvider: vi.fn().mockResolvedValue({ notifications: [] }),
}));

vi.mock('../../src/services/toast-store.js', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock('../../src/components/ProviderIcon.js', () => ({
  providerIcon: () => null, customProviderLogo: () => null,
}));

vi.mock('../../src/services/oauth-popup.js', () => ({
  monitorOAuthPopup: vi.fn(),
}));

import ProviderSelectContent from '../../src/components/ProviderSelectContent';

describe('ProviderSelectContent — providerDeepLink', () => {
  const onUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens directly to the provider detail view when providerDeepLink is set', () => {
    const { container } = render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        providerDeepLink={{ providerId: 'anthropic' }}
        onUpdate={onUpdate}
        onClose={vi.fn()}
      />
    ));
    // The detail view should be visible (provider-modal__view--from-right)
    const detailView = container.querySelector('.provider-modal__view--from-right');
    expect(detailView).not.toBeNull();
    // The tab list (part of provider list view) should not be visible
    expect(container.querySelector('[role="tablist"]')).toBeNull();
  });

  it('shows the correct provider name in the detail view', () => {
    render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        providerDeepLink={{ providerId: 'anthropic' }}
        onUpdate={onUpdate}
        onClose={vi.fn()}
      />
    ));
    expect(screen.getByText('Anthropic')).toBeDefined();
  });

  it('navigates back to the list view when back is clicked', async () => {
    const { container } = render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        providerDeepLink={{ providerId: 'gemini' }}
        onUpdate={onUpdate}
        onClose={vi.fn()}
      />
    ));
    // Should start in detail view
    expect(container.querySelector('.provider-modal__view--from-right')).not.toBeNull();

    // Click the back button
    const backBtn = container.querySelector('.modal-back-btn');
    expect(backBtn).not.toBeNull();
    fireEvent.click(backBtn!);

    // Should now show the list view
    await waitFor(() => {
      expect(screen.getByText('Connect providers')).toBeDefined();
    });
  });

  it('does not open detail view when providerDeepLink is null', () => {
    render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        providerDeepLink={null}
        onUpdate={onUpdate}
        onClose={vi.fn()}
      />
    ));
    // Should show the list view with header
    expect(screen.getByText('Connect providers')).toBeDefined();
  });

  it('does not open detail view when providerDeepLink is undefined', () => {
    render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        onUpdate={onUpdate}
        onClose={vi.fn()}
      />
    ));
    // Should show the list view with header
    expect(screen.getByText('Connect providers')).toBeDefined();
  });

  it('opens detail view for gemini with correct auth type', () => {
    render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        providerDeepLink={{ providerId: 'gemini' }}
        onUpdate={onUpdate}
        onClose={vi.fn()}
      />
    ));
    expect(screen.getByText('Google')).toBeDefined();
  });
});
