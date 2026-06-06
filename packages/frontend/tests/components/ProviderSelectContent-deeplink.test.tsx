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

  it('navigates back to the list view when close is clicked in detail view', async () => {
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

    // The detail view header now has a Close button that goes back to the list
    const closeBtn = screen.getByLabelText('Close');
    expect(closeBtn).not.toBeNull();
    fireEvent.click(closeBtn);

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

  describe('new deeplink fields', () => {
    it('initialTab defaults the active tab to api_key', () => {
      const { container } = render(() => (
        <ProviderSelectContent
          agentName="test-agent"
          providers={[]}
          initialTab="api_key"
          onUpdate={onUpdate}
          onClose={vi.fn()}
        />
      ));
      const activeTab = container.querySelector('.panel__tab--active');
      expect(activeTab).not.toBeNull();
      expect(activeTab!.textContent).toContain('API Keys');
    });

    it('initialTab subscription keeps the default subscription tab active', () => {
      const { container } = render(() => (
        <ProviderSelectContent
          agentName="test-agent"
          providers={[]}
          initialTab="subscription"
          onUpdate={onUpdate}
          onClose={vi.fn()}
        />
      ));
      const activeTab = container.querySelector('.panel__tab--active');
      expect(activeTab).not.toBeNull();
      expect(activeTab!.textContent).toContain('Subscription');
    });

    it('deepLink.authType forces the detail view to open with the specified auth type (subscription)', async () => {
      // openai supports both api_key and subscription; with authType='subscription'
      // the detail view should open in subscription mode showing the OAuth button
      const { container } = render(() => (
        <ProviderSelectContent
          agentName="test-agent"
          providers={[]}
          providerDeepLink={{ providerId: 'openai', authType: 'subscription' }}
          onUpdate={onUpdate}
          onClose={vi.fn()}
        />
      ));
      // The detail view for OpenAI subscription shows the OAuth login button
      await waitFor(() => {
        expect(screen.getByText('Log in with OpenAI')).toBeDefined();
      });
      // Confirm the detail view is visible
      expect(container.querySelector('.provider-modal__view--from-right')).not.toBeNull();
    });

    it('closeOnBack — close button in detail view calls onClose instead of going to list', async () => {
      const onClose = vi.fn();
      const { container } = render(() => (
        <ProviderSelectContent
          agentName="test-agent"
          providers={[]}
          providerDeepLink={{ providerId: 'anthropic', closeOnBack: true }}
          onUpdate={onUpdate}
          onClose={onClose}
        />
      ));
      // Should start in detail view
      expect(container.querySelector('.provider-modal__view--from-right')).not.toBeNull();

      // Click close — with closeOnBack it should call onClose, not go back to list
      fireEvent.click(screen.getByLabelText('Close'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
      // List view should NOT have appeared (closeOnBack = close modal, not navigate)
    });

    it('closeOnBack=false (absent) — close button calls onClose to dismiss the modal', async () => {
      const onClose = vi.fn();
      const { container } = render(() => (
        <ProviderSelectContent
          agentName="test-agent"
          providers={[]}
          providerDeepLink={{ providerId: 'gemini' }}
          onUpdate={onUpdate}
          onClose={onClose}
        />
      ));
      // Should start in detail view
      expect(container.querySelector('.provider-modal__view--from-right')).not.toBeNull();

      // The header Close (×) button always dismisses the modal via onClose,
      // regardless of closeOnBack. Navigation back to list is done by other means.
      fireEvent.click(screen.getByLabelText('Close'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });
});
