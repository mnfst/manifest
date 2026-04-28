import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { createSignal, type Accessor, type Setter } from 'solid-js';

const mockConnectProvider = vi.fn();
const mockDisconnectProvider = vi.fn();

vi.mock('../../src/services/api.js', () => ({
  connectProvider: (...args: unknown[]) => mockConnectProvider(...args),
  disconnectProvider: (...args: unknown[]) => mockDisconnectProvider(...args),
}));

vi.mock('../../src/services/toast-store.js', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock('../../src/components/ProviderIcon.js', () => ({
  providerIcon: () => null,
  customProviderLogo: () => null,
}));

vi.mock('../../src/components/CopyButton.js', () => ({
  default: (props: { text: string }) => <span data-testid="copy-btn">{props.text}</span>,
}));

vi.mock('../../src/components/ProviderKeyForm.js', () => ({
  default: () => <div data-testid="provider-key-form" />,
}));

vi.mock('../../src/components/OAuthDetailView.js', () => ({
  default: () => <div data-testid="oauth-detail-view" />,
}));

vi.mock('../../src/components/DeviceCodeDetailView.js', () => ({
  default: () => <div data-testid="device-code-detail-view" />,
}));

import ProviderDetailView from '../../src/components/ProviderDetailView';
import { toast } from '../../src/services/toast-store.js';
import type { AuthType, RoutingProvider } from '../../src/services/api.js';

function createTestProps(overrides: Partial<{
  provId: string;
  providers: RoutingProvider[];
  selectedAuthType: AuthType;
}> = {}) {
  const [busy, setBusy] = createSignal(false);
  const [keyInput, setKeyInput] = createSignal('');
  const [editing, setEditing] = createSignal(false);
  const [validationError, setValidationError] = createSignal<string | null>(null);
  const [selectedAuthType, setSelectedAuthType] = createSignal<AuthType>(
    overrides.selectedAuthType ?? 'api_key',
  );

  return {
    provId: overrides.provId ?? 'ollama',
    agentName: 'test-agent',
    providers: overrides.providers ?? [],
    selectedAuthType: selectedAuthType as Accessor<AuthType>,
    busy,
    setBusy: setBusy as Setter<boolean>,
    keyInput,
    setKeyInput: setKeyInput as Setter<string>,
    editing,
    setEditing: setEditing as Setter<boolean>,
    validationError,
    setValidationError: setValidationError as Setter<string | null>,
    onBack: vi.fn(),
    onUpdate: vi.fn(),
    onClose: vi.fn(),
  };
}

describe('ProviderDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectProvider.mockResolvedValue({});
    mockDisconnectProvider.mockResolvedValue({ notifications: [] });
  });

  describe('Ollama connect flow', () => {
    it('shows Connect button for disconnected Ollama', () => {
      const props = createTestProps({ provId: 'ollama', providers: [] });
      render(() => <ProviderDetailView {...props} />);
      expect(screen.getByText('Connect')).toBeDefined();
    });

    it('calls connectProvider and callbacks on successful connect', async () => {
      const props = createTestProps({ provId: 'ollama', providers: [] });
      render(() => <ProviderDetailView {...props} />);

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalledWith('test-agent', {
          provider: 'ollama',
          authType: 'api_key',
        });
        expect(props.onBack).toHaveBeenCalled();
        expect(props.onUpdate).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith('Ollama connected');
      });
    });

    it('handles connect failure gracefully', async () => {
      mockConnectProvider.mockRejectedValueOnce(new Error('fail'));
      const props = createTestProps({ provId: 'ollama', providers: [] });
      render(() => <ProviderDetailView {...props} />);

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalled();
        expect(props.onBack).not.toHaveBeenCalled();
      });
    });
  });

  describe('Ollama disconnect flow', () => {
    const connectedOllamaProviders: RoutingProvider[] = [
      {
        id: 'p1',
        provider: 'ollama',
        auth_type: 'api_key',
        is_active: true,
        has_api_key: false,
        connected_at: '2025-01-01',
      },
    ];

    it('shows Disconnect button for connected Ollama', () => {
      const props = createTestProps({
        provId: 'ollama',
        providers: connectedOllamaProviders,
      });
      render(() => <ProviderDetailView {...props} />);
      expect(screen.getByText('Disconnect')).toBeDefined();
    });

    it('calls disconnectProvider on disconnect click', async () => {
      const props = createTestProps({
        provId: 'ollama',
        providers: connectedOllamaProviders,
      });
      render(() => <ProviderDetailView {...props} />);

      fireEvent.click(screen.getByText('Disconnect'));

      await waitFor(() => {
        expect(mockDisconnectProvider).toHaveBeenCalledWith(
          'test-agent',
          'ollama',
          'api_key',
        );
        expect(props.onBack).toHaveBeenCalled();
        expect(props.onUpdate).toHaveBeenCalled();
      });
    });

    it('handles disconnect failure gracefully', async () => {
      mockDisconnectProvider.mockRejectedValueOnce(new Error('fail'));
      const props = createTestProps({
        provId: 'ollama',
        providers: connectedOllamaProviders,
      });
      render(() => <ProviderDetailView {...props} />);

      fireEvent.click(screen.getByText('Disconnect'));

      await waitFor(() => {
        expect(mockDisconnectProvider).toHaveBeenCalled();
        expect(props.onBack).not.toHaveBeenCalled();
      });
    });

    it('shows notification toasts from disconnect result', async () => {
      mockDisconnectProvider.mockResolvedValueOnce({
        notifications: ['Provider had active tiers'],
      });
      const props = createTestProps({
        provId: 'ollama',
        providers: connectedOllamaProviders,
      });
      render(() => <ProviderDetailView {...props} />);

      fireEvent.click(screen.getByText('Disconnect'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Provider had active tiers');
        expect(props.onBack).toHaveBeenCalled();
      });
    });
  });

  describe('OpenAI subscription renders OAuthDetailView', () => {
    it('renders OAuthDetailView for popup_oauth subscription flow', () => {
      const connectedOpenaiSub: RoutingProvider[] = [
        {
          id: 'p1',
          provider: 'openai',
          auth_type: 'subscription',
          is_active: true,
          has_api_key: false,
          connected_at: '2025-01-01',
        },
      ];
      const props = createTestProps({
        provId: 'openai',
        providers: connectedOpenaiSub,
        selectedAuthType: 'subscription',
      });
      render(() => <ProviderDetailView {...props} />);
      expect(screen.getByTestId('oauth-detail-view')).toBeDefined();
    });
  });

  it('renders back button', () => {
    const props = createTestProps();
    render(() => <ProviderDetailView {...props} />);
    const btn = screen.getByLabelText('Back to providers');
    expect(btn).toBeDefined();
    fireEvent.click(btn);
    expect(props.onBack).toHaveBeenCalled();
  });

  it('renders ProviderKeyForm for non-Ollama providers', () => {
    const props = createTestProps({ provId: 'anthropic' });
    render(() => <ProviderDetailView {...props} />);
    expect(screen.getByTestId('provider-key-form')).toBeDefined();
  });
});
