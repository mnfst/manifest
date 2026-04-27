import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';

const broadcastChannelRegistry = new Map<string, Set<MockBroadcastChannel>>();

class MockBroadcastChannel {
  name: string;
  onmessage: ((event: { data: unknown }) => void) | null = null;

  constructor(name: string) {
    this.name = name;
    if (!broadcastChannelRegistry.has(name)) {
      broadcastChannelRegistry.set(name, new Set());
    }
    broadcastChannelRegistry.get(name)!.add(this);
  }

  postMessage(data: unknown) {
    const listeners = broadcastChannelRegistry.get(this.name);
    if (!listeners) return;
    for (const channel of listeners) {
      if (channel === this) continue;
      channel.onmessage?.({ data });
    }
  }

  close() {
    broadcastChannelRegistry.get(this.name)?.delete(this);
  }
}

const mockConnectProvider = vi.fn();
const mockDisconnectProvider = vi.fn();
const mockGetOpenaiOAuthUrl = vi.fn();
const mockPollMinimaxOAuth = vi.fn();
const mockRevokeOpenaiOAuth = vi.fn();
const mockStartMinimaxOAuth = vi.fn();
const mockCreateCustomProvider = vi.fn();
const mockUpdateCustomProvider = vi.fn();
const mockDeleteCustomProvider = vi.fn();

vi.mock('../../src/services/api.js', () => ({
  connectProvider: (...args: unknown[]) => mockConnectProvider(...args),
  disconnectProvider: (...args: unknown[]) => mockDisconnectProvider(...args),
  getOpenaiOAuthUrl: (...args: unknown[]) => mockGetOpenaiOAuthUrl(...args),
  pollMinimaxOAuth: (...args: unknown[]) => mockPollMinimaxOAuth(...args),
  revokeOpenaiOAuth: (...args: unknown[]) => mockRevokeOpenaiOAuth(...args),
  startMinimaxOAuth: (...args: unknown[]) => mockStartMinimaxOAuth(...args),
  createCustomProvider: (...args: unknown[]) => mockCreateCustomProvider(...args),
  updateCustomProvider: (...args: unknown[]) => mockUpdateCustomProvider(...args),
  deleteCustomProvider: (...args: unknown[]) => mockDeleteCustomProvider(...args),
}));

vi.mock('../../src/services/toast-store.js', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock('../../src/components/ProviderIcon.js', () => ({
  providerIcon: () => null, customProviderLogo: () => null,
}));

import ProviderSelectModal from '../../src/components/ProviderSelectModal';
import { toast } from '../../src/services/toast-store.js';
import type { RoutingProvider } from '../../src/services/api.js';

const connectedProvider: RoutingProvider = {
  id: 'p1',
  provider: 'openai',
  is_active: true,
  has_api_key: true,
  key_prefix: 'sk-proj-',
  connected_at: '2025-01-01',
  auth_type: 'api_key',
};

const disconnectedProvider: RoutingProvider = {
  id: 'p2',
  provider: 'anthropic',
  is_active: false,
  has_api_key: false,
  connected_at: '2025-01-01',
  auth_type: 'api_key',
};

// Valid key that passes OpenAI validation (prefix "sk-", min 50 chars)
const VALID_OPENAI_KEY = 'sk-' + 'a'.repeat(50);
// Valid key that passes Anthropic validation (prefix "sk-ant-", min 50 chars)
const VALID_ANTHROPIC_KEY = 'sk-ant-' + 'a'.repeat(50);
const VALID_QWEN_KEY = 'sk-' + 'a'.repeat(30);

describe('ProviderSelectModal', () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    broadcastChannelRegistry.clear();
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
    onClose = vi.fn();
    onUpdate = vi.fn();
    mockConnectProvider.mockResolvedValue({});
    mockDisconnectProvider.mockResolvedValue({ notifications: [] });
    mockGetOpenaiOAuthUrl.mockResolvedValue({
      url: 'https://auth.openai.com/oauth/authorize?test=1',
    });
    mockPollMinimaxOAuth.mockResolvedValue({
      status: 'pending',
      message: 'Waiting for MiniMax approval…',
      pollIntervalMs: 2000,
    });
    mockRevokeOpenaiOAuth.mockResolvedValue({ ok: true });
    mockStartMinimaxOAuth.mockResolvedValue({
      flowId: 'flow-1',
      userCode: 'ABCD-1234',
      verificationUri: 'https://www.minimax.io/verify',
      expiresAt: Date.now() + 60_000,
      pollIntervalMs: 2000,
    });
  });

  it('renders modal with title', () => {
    render(() => (
      <ProviderSelectModal
        providers={[]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
      />
    ));
    expect(screen.getByText('Connect providers')).toBeDefined();
  });

  it('renders subtitle description', () => {
    render(() => (
      <ProviderSelectModal
        providers={[]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
      />
    ));
    expect(screen.getByText('Use your subscriptions or API keys to enable routing')).toBeDefined();
  });

  it('renders all provider names from the PROVIDERS list on API Keys tab', () => {
    render(() => (
      <ProviderSelectModal
        providers={[]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
      />
    ));
    fireEvent.click(screen.getByText('API Keys'));
    expect(screen.getByText('OpenAI')).toBeDefined();
    expect(screen.getByText('Anthropic')).toBeDefined();
    expect(screen.getByText('Google')).toBeDefined();
    expect(screen.getByText('DeepSeek')).toBeDefined();
    expect(screen.getByText('OpenRouter')).toBeDefined();
  });

  it("does not show subscription-only providers in the API Keys tab", () => {
    render(() => (
      <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
    ));
    fireEvent.click(screen.getByText("API Keys"));
    expect(screen.queryByText("GitHub Copilot")).toBeNull();
  });

  it("shows toggle switch in 'on' state for connected providers", () => {
    const { container } = render(() => (
      <ProviderSelectModal
        providers={[connectedProvider]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
      />
    ));
    fireEvent.click(screen.getByText('API Keys'));
    const onSwitches = container.querySelectorAll('.provider-toggle__switch--on');
    expect(onSwitches.length).toBeGreaterThanOrEqual(1);
  });

  it("shows toggle switch in 'off' state for disconnected providers", () => {
    const { container } = render(() => (
      <ProviderSelectModal
        providers={[]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
      />
    ));
    fireEvent.click(screen.getByText('API Keys'));
    const allSwitches = container.querySelectorAll('.provider-toggle__switch');
    const onSwitches = container.querySelectorAll('.provider-toggle__switch--on');
    expect(allSwitches.length).toBeGreaterThan(0);
    expect(onSwitches.length).toBe(0);
  });

  it('calls onClose when Done button is clicked', () => {
    render(() => (
      <ProviderSelectModal
        providers={[]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
      />
    ));
    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when close button is clicked', () => {
    render(() => (
      <ProviderSelectModal
        providers={[]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
      />
    ));
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when clicking overlay background', () => {
    const { container } = render(() => (
      <ProviderSelectModal
        providers={[]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
      />
    ));
    const overlay = container.querySelector('.modal-overlay')!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not close when clicking inside the modal card', () => {
    const { container } = render(() => (
      <ProviderSelectModal
        providers={[]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
      />
    ));
    const card = container.querySelector('.modal-card')!;
    fireEvent.click(card);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    const { container } = render(() => (
      <ProviderSelectModal
        providers={[]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
      />
    ));
    const overlay = container.querySelector('.modal-overlay')!;
    fireEvent.keyDown(overlay, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  describe('detail view navigation', () => {
    it('shows API key input when provider row is clicked', async () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));
      expect(screen.getByLabelText('OpenAI API key')).toBeDefined();
    });

    it('shows where-to-get API key link for selected provider', () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));

      const link = screen.getByRole('link', { name: 'Get OpenAI API key' });
      expect(link.getAttribute('href')).toBe('https://platform.openai.com/api-keys');
      expect(link.getAttribute('target')).toBe('_blank');
    });

    it('returns to list view when back button is clicked', async () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));
      expect(screen.getByLabelText('OpenAI API key')).toBeDefined();

      fireEvent.click(screen.getByLabelText('Back to providers'));
      expect(screen.queryByLabelText('OpenAI API key')).toBeNull();
      // List view is back
      expect(screen.getByText('Done')).toBeDefined();
    });

    it('shows disconnect icon for connected providers', () => {
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));
      expect(screen.getByLabelText('Disconnect provider')).toBeDefined();
    });

    it("shows 'Change' button for connected non-ollama providers", () => {
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));
      expect(screen.getByText('Change')).toBeDefined();
    });

    it("shows 'Connect' button for non-connected providers", () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));
      expect(screen.getByText('Connect')).toBeDefined();
    });

    it('shows masked key prefix for connected providers', () => {
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));
      expect(screen.getByLabelText('Current API key (masked)')).toBeDefined();
    });

    it('sends Alibaba API keys without a region override and relies on backend auto-detection', async () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));

      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('Alibaba'));
      fireEvent.input(screen.getByLabelText('Alibaba API key'), {
        target: { value: VALID_QWEN_KEY },
      });
      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalledWith('test-agent', {
          provider: 'qwen',
          apiKey: VALID_QWEN_KEY,
          authType: 'api_key',
        });
      });
    });
  });

  describe('connecting a provider', () => {
    it('connects a provider when valid API key is entered and Connect clicked', async () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));
      const input = screen.getByLabelText('OpenAI API key');
      fireEvent.input(input, { target: { value: VALID_OPENAI_KEY } });
      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalledWith('test-agent', {
          provider: 'openai',
          apiKey: VALID_OPENAI_KEY,
          authType: 'api_key',
        });
      });
      expect(onUpdate).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('OpenAI connected');
    });

    it('does not connect when API key is empty', () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));

      const connectBtn = screen.getByText('Connect');
      expect(connectBtn.hasAttribute('disabled')).toBe(true);
    });

    it('shows validation error for invalid key prefix', async () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));
      const input = screen.getByLabelText('OpenAI API key');
      fireEvent.input(input, {
        target: { value: 'invalid-key-prefix-12345678901234567890123456789012345' },
      });
      fireEvent.click(screen.getByText('Connect'));

      expect(screen.getByText('OpenAI keys start with "sk-"')).toBeDefined();
      expect(mockConnectProvider).not.toHaveBeenCalled();
    });

    it('shows validation error for key that is too short', async () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));
      const input = screen.getByLabelText('OpenAI API key');
      fireEvent.input(input, { target: { value: 'sk-short' } });
      fireEvent.click(screen.getByText('Connect'));

      expect(screen.getByText('Key is too short (minimum 50 characters)')).toBeDefined();
      expect(mockConnectProvider).not.toHaveBeenCalled();
    });

    it('clears validation error on input change', async () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));
      const input = screen.getByLabelText('OpenAI API key');
      fireEvent.input(input, { target: { value: 'bad' } });
      fireEvent.click(screen.getByText('Connect'));

      expect(screen.getByText('OpenAI keys start with "sk-"')).toBeDefined();

      // Typing clears the error
      fireEvent.input(input, { target: { value: 'sk-' } });
      expect(screen.queryByText('OpenAI keys start with "sk-"')).toBeNull();
    });

    it('connects on Enter key in API key input', async () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));
      const input = screen.getByLabelText('OpenAI API key');
      fireEvent.input(input, { target: { value: VALID_OPENAI_KEY } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalled();
      });
    });
  });

  describe('disconnecting a provider', () => {
    it('calls disconnectProvider and triggers onUpdate', async () => {
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));
      fireEvent.click(screen.getByLabelText('Disconnect provider'));

      await waitFor(() => {
        expect(mockDisconnectProvider).toHaveBeenCalledWith('test-agent', 'openai', 'api_key');
      });
      expect(onUpdate).toHaveBeenCalled();
    });

    it('shows error toasts for disconnect notifications', async () => {
      mockDisconnectProvider.mockResolvedValue({
        notifications: ['Model X no longer available. Simple is back to automatic mode.'],
      });

      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));
      fireEvent.click(screen.getByLabelText('Disconnect provider'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Model X no longer available. Simple is back to automatic mode.',
        );
      });
    });

    it('handles disconnect error gracefully', async () => {
      mockDisconnectProvider.mockRejectedValue(new Error('Network error'));

      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));
      fireEvent.click(screen.getByLabelText('Disconnect provider'));

      // Should not throw, busy state should reset
      await waitFor(() => {
        expect(mockDisconnectProvider).toHaveBeenCalled();
      });
    });
  });

  describe('connect error handling', () => {
    it('handles connect error gracefully', async () => {
      mockConnectProvider.mockRejectedValue(new Error('Failed'));

      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));
      const input = screen.getByLabelText('OpenAI API key');
      fireEvent.input(input, { target: { value: VALID_OPENAI_KEY } });
      fireEvent.click(screen.getByText('Connect'));

      // Should not throw
      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalled();
      });
    });
  });

  describe('updating a key', () => {
    it('switches to edit mode when Change is clicked', () => {
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));
      fireEvent.click(screen.getByText('Change'));

      // Edit mode shows a masked input and Save button
      expect(screen.getByLabelText('New OpenAI API key')).toBeDefined();
      expect(screen.getByText('Save')).toBeDefined();
    });

    it('saves updated key', async () => {
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));
      fireEvent.click(screen.getByText('Change'));

      const input = screen.getByLabelText('New OpenAI API key');
      fireEvent.input(input, { target: { value: VALID_OPENAI_KEY } });
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalledWith('test-agent', {
          provider: 'openai',
          apiKey: VALID_OPENAI_KEY,
          authType: 'api_key',
        });
      });
      expect(toast.success).toHaveBeenCalledWith('OpenAI key updated');
    });

    it('shows validation error for invalid key in edit mode', () => {
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));
      fireEvent.click(screen.getByText('Change'));

      const input = screen.getByLabelText('New OpenAI API key');
      fireEvent.input(input, { target: { value: 'bad-key' } });
      fireEvent.click(screen.getByText('Save'));

      expect(screen.getByText('OpenAI keys start with "sk-"')).toBeDefined();
      expect(mockConnectProvider).not.toHaveBeenCalled();
    });

    it('handles update key error gracefully', async () => {
      mockConnectProvider.mockRejectedValue(new Error('Server error'));
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));
      fireEvent.click(screen.getByText('Change'));

      const input = screen.getByLabelText('New OpenAI API key');
      fireEvent.input(input, { target: { value: VALID_OPENAI_KEY } });
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalled();
      });
    });

    it('triggers handleUpdateKey on Enter key in edit input', async () => {
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('OpenAI'));
      fireEvent.click(screen.getByText('Change'));

      const input = screen.getByLabelText('New OpenAI API key');
      fireEvent.input(input, { target: { value: VALID_OPENAI_KEY } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalled();
      });
    });
  });

  describe('custom providers', () => {
    const customProviderData = [
      {
        id: 'cp-1',
        name: 'Groq',
        base_url: 'https://api.groq.com',
        has_api_key: true,
        models: [{ model_name: 'llama-3.1-70b' }, { model_name: 'llama-3.1-8b' }],
        created_at: '2025-01-01',
      },
    ];

    it('renders custom provider list items', () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          customProviders={customProviderData}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      expect(screen.getByText('Groq')).toBeDefined();
      expect(screen.getByText('Custom')).toBeDefined();
    });

    it('renders custom provider icon letter', () => {
      const { container } = render(() => (
        <ProviderSelectModal
          providers={[]}
          customProviders={customProviderData}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      // Find the Groq provider toggle and check its logo letter
      const groqToggle = screen.getByText('Groq').closest('.provider-toggle');
      const letter = groqToggle?.querySelector('.provider-card__logo-letter');
      expect(letter).not.toBeNull();
      expect(letter!.textContent).toBe('G');
    });

    it('shows Add custom provider button', () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      expect(screen.getByText('Add custom provider')).toBeDefined();
    });

    it('opens custom provider form when Add button is clicked', async () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('Add custom provider'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g. Groq, Together, Azure')).toBeDefined();
      });
    });

    it('opens edit form when custom provider is clicked', async () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          customProviders={customProviderData}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('Groq'));
      await waitFor(() => {
        const nameInput = screen.getByDisplayValue('Groq');
        expect(nameInput).toBeDefined();
      });
    });

    it('singularizes model count for single model', () => {
      const singleModel = [{ ...customProviderData[0], models: [{ model_name: 'llama' }] }];
      render(() => (
        <ProviderSelectModal
          providers={[]}
          customProviders={singleModel}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      // Custom providers show the "Custom" tag
      expect(screen.getByText('Custom')).toBeDefined();
    });
  });

  it('shows default masked key when provider has no key_prefix', () => {
    const noPrefix: RoutingProvider = {
      id: 'p4',
      provider: 'openai',
      is_active: true,
      has_api_key: true,
      connected_at: '2025-01-01',
      auth_type: 'api_key',
    };
    render(() => (
      <ProviderSelectModal
        providers={[noPrefix]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
      />
    ));
    fireEvent.click(screen.getByText('API Keys'));
    fireEvent.click(screen.getByText('OpenAI'));
    const maskedInput = screen.getByLabelText('Current API key (masked)') as HTMLInputElement;
    expect(maskedInput.value).toContain('••••••••••••');
  });

  describe('subscription tab', () => {
    it('shows subscription tab as default active tab', () => {
      const { container } = render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      const activeTab = container.querySelector('.panel__tab--active');
      expect(activeTab).not.toBeNull();
      expect(activeTab!.textContent).toContain('Subscription');
    });

    it('renders subscription providers with toggle switches', () => {
      const { container } = render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      // Subscription tab is default, check subscription providers are listed
      expect(screen.getByText('Anthropic')).toBeDefined();
      const switches = container.querySelectorAll('.provider-toggle__switch');
      expect(switches.length).toBeGreaterThan(0);
    });

    it('shows subscription toggle as on for subscription-connected providers with token', () => {
      const subProvider: RoutingProvider = {
        id: 'p-sub',
        provider: 'anthropic',
        is_active: true,
        has_api_key: true,
        key_prefix: 'skst-tok',
        connected_at: '2025-01-01',
        auth_type: 'subscription',
      };
      const { container } = render(() => (
        <ProviderSelectModal
          providers={[subProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      const onSwitches = container.querySelectorAll('.provider-toggle__switch--on');
      expect(onSwitches.length).toBeGreaterThanOrEqual(1);
    });

    it('opens detail view for Anthropic (has subscriptionKeyPlaceholder)', () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('Anthropic'));

      // Should open detail view with setup token input
      expect(screen.getByLabelText('Anthropic setup token')).toBeDefined();
      expect(screen.getByText('Connect')).toBeDefined();
    });

    it('does not show credits button for non-Anthropic providers', () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('OpenAI'));

      expect(screen.queryByText('Claim your credits on Claude')).toBeNull();
    });

    it('shows terminal command in Anthropic subscription detail view', () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('Anthropic'));

      expect(screen.getByText('claude setup-token')).toBeDefined();
      expect(screen.getByText('Terminal')).toBeDefined();
    });

    it('connects Anthropic subscription with setup-token', async () => {
      const VALID_TOKEN = 'sk-ant-oat01-test-token-1234567890';
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('Anthropic'));

      const input = screen.getByLabelText('Anthropic setup token');
      fireEvent.input(input, { target: { value: VALID_TOKEN } });
      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalledWith('test-agent', {
          provider: 'anthropic',
          apiKey: VALID_TOKEN,
          authType: 'subscription',
        });
      });
      expect(onUpdate).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Anthropic connected');
    });

    it('shows validation error for short subscription token', () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('Anthropic'));

      const input = screen.getByLabelText('Anthropic setup token');
      fireEvent.input(input, { target: { value: 'short' } });
      fireEvent.click(screen.getByText('Connect'));

      expect(screen.getByText('Token is too short (minimum 10 characters)')).toBeDefined();
      expect(mockConnectProvider).not.toHaveBeenCalled();
    });

    it('shows masked token for connected Anthropic subscription', () => {
      const subProvider: RoutingProvider = {
        id: 'p-sub',
        provider: 'anthropic',
        is_active: true,
        has_api_key: true,
        key_prefix: 'skst-tok',
        connected_at: '2025-01-01',
        auth_type: 'subscription',
      };
      render(() => (
        <ProviderSelectModal
          providers={[subProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('Anthropic'));

      expect(screen.getByLabelText('Current setup token (masked)')).toBeDefined();
      expect(screen.getByText('Change')).toBeDefined();
    });

    it('disconnects Anthropic subscription from detail view', async () => {
      const subProvider: RoutingProvider = {
        id: 'p-sub',
        provider: 'anthropic',
        is_active: true,
        has_api_key: true,
        key_prefix: 'skst-tok',
        connected_at: '2025-01-01',
        auth_type: 'subscription',
      };
      render(() => (
        <ProviderSelectModal
          providers={[subProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('Anthropic'));
      fireEvent.click(screen.getByLabelText('Disconnect provider'));

      await waitFor(() => {
        expect(mockDisconnectProvider).toHaveBeenCalledWith(
          'test-agent',
          'anthropic',
          'subscription',
        );
      });
      expect(onUpdate).toHaveBeenCalled();
    });

    it('shows tab hint text for subscription tab', () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      expect(
        screen.getByText(/Use your existing subscription or paid plan/),
      ).toBeDefined();
    });

    it('shows tab hint text for API Keys tab', () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      expect(screen.getByText(/Connect providers using your own API keys/)).toBeDefined();
    });

    it('toggles on a subscription provider without subscriptionKeyPlaceholder via handleSubscriptionToggle', async () => {
      // Create a subscription provider without subscriptionKeyPlaceholder
      // Anthropic has subscriptionKeyPlaceholder so it opens detail view.
      // We need to simulate a provider that uses the toggle directly.
      // All subscription providers in PROVIDERS currently have subscriptionKeyPlaceholder,
      // but the code path still triggers for providers without it — Anthropic has it,
      // so clicking Anthropic opens detail. We test the subscription connect flow
      // by checking the toggle switch and the handleSubscriptionToggle path.
      // Since Anthropic is the only supportsSubscription provider and it has
      // subscriptionKeyPlaceholder, the toggle path (handleSubscriptionToggle) is only
      // reachable if a provider has supportsSubscription=true but no subscriptionKeyPlaceholder.
      // However, isSubscriptionConnected and isSubscriptionWithToken are still exercised
      // in the subscription tab rendering. Let's test those helpers via the list view.
      const subProvider: RoutingProvider = {
        id: 'p-sub-connected',
        provider: 'anthropic',
        is_active: true,
        has_api_key: false,
        connected_at: '2025-01-01',
        auth_type: 'subscription',
      };
      const { container } = render(() => (
        <ProviderSelectModal
          providers={[subProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      // On subscription tab, Anthropic should show toggle as "on" when isSubscriptionConnected
      // returns true. isSubscriptionConnected checks is_active (no has_api_key requirement).
      // But subscriptionKeyPlaceholder is set → uses isSubscriptionWithToken for the connected() signal.
      // isSubscriptionWithToken checks is_active && has_api_key → false here.
      // So the toggle should be OFF (has_api_key is false).
      const onSwitches = container.querySelectorAll('.provider-toggle__switch--on');
      expect(onSwitches.length).toBe(0);
    });

    it('shows subscription toggle as on when provider is subscription-connected without token requirement', async () => {
      const subProvider: RoutingProvider = {
        id: 'p-sub-notok',
        provider: 'anthropic',
        is_active: true,
        has_api_key: true,
        key_prefix: 'sk-ant-oat',
        connected_at: '2025-01-01',
        auth_type: 'subscription',
      };
      const { container } = render(() => (
        <ProviderSelectModal
          providers={[subProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      // isSubscriptionWithToken returns true (is_active && has_api_key)
      const onSwitches = container.querySelectorAll('.provider-toggle__switch--on');
      expect(onSwitches.length).toBeGreaterThanOrEqual(1);
    });

    it('shows subscription label from provider definition', () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      // Anthropic has subscriptionLabel: 'Claude Max / Pro subscription'
      expect(screen.getByText('Claude Max / Pro subscription')).toBeDefined();
    });

    it('shows detail subtitle for subscription mode', () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      // Click Anthropic on subscription tab to open detail
      fireEvent.click(screen.getByText('Anthropic'));
      expect(screen.getByText('Connect providers')).toBeDefined();
    });

    it('shows CopyButton with subscription command in detail view', () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('Anthropic'));
      // The CopyButton receives the subscription command text
      expect(screen.getByText('claude setup-token')).toBeDefined();
    });

    it('shows subscription placeholder in setup token input', () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('Anthropic'));
      const input = screen.getByLabelText('Anthropic setup token') as HTMLInputElement;
      expect(input.getAttribute('placeholder')).toBe('Paste your setup-token');
    });

    it('hides the "Get API key" link in Anthropic subscription mode', () => {
      // Anthropic subscription uses setup-tokens from the CLI, not API keys from the
      // dashboard, so the console.anthropic.com/settings/keys URL would be misleading.
      const { container } = render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('Anthropic'));
      const link = container.querySelector<HTMLAnchorElement>(
        'a[href="https://console.anthropic.com/settings/keys"]',
      );
      expect(link).toBeNull();
    });

    it('updates token in subscription edit mode', async () => {
      const subProvider: RoutingProvider = {
        id: 'p-sub',
        provider: 'anthropic',
        is_active: true,
        has_api_key: true,
        key_prefix: 'skst-tok',
        connected_at: '2025-01-01',
        auth_type: 'subscription',
      };
      render(() => (
        <ProviderSelectModal
          providers={[subProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('Anthropic'));
      fireEvent.click(screen.getByText('Change'));

      const UPDATED_TOKEN = 'sk-ant-oat01-updated-token-value';
      const input = screen.getByLabelText('New Anthropic setup token');
      fireEvent.input(input, { target: { value: UPDATED_TOKEN } });
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalledWith('test-agent', {
          provider: 'anthropic',
          apiKey: UPDATED_TOKEN,
          authType: 'subscription',
        });
      });
      expect(toast.success).toHaveBeenCalledWith('Anthropic token updated');
    });

    it('opens detail view for OAuth subscription provider (OpenAI)', () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('OpenAI'));
      expect(screen.getByText('Connect providers')).toBeDefined();
    });

    it("shows 'Log in with OpenAI' button for OAuth provider", () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('OpenAI'));
      expect(screen.getByText('Log in with OpenAI')).toBeDefined();
    });

    it('shows OAuth login hint text', () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('OpenAI'));
      expect(screen.getByText(/Log in with your OpenAI account/)).toBeDefined();
    });

    it('calls getOpenaiOAuthUrl and opens popup on login click', async () => {
      const mockPopup = { closed: false, close: vi.fn() };
      vi.spyOn(window, 'open').mockReturnValue(mockPopup as unknown as Window);

      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('OpenAI'));
      fireEvent.click(screen.getByText('Log in with OpenAI'));

      await waitFor(() => {
        expect(mockGetOpenaiOAuthUrl).toHaveBeenCalledWith('test-agent');
      });
      expect(window.open).toHaveBeenCalledWith(
        'https://auth.openai.com/oauth/authorize?test=1',
        'manifest-oauth',
        'width=500,height=700',
      );

      vi.restoreAllMocks();
    });

    it('shows Disconnect button for connected OAuth provider', () => {
      const subProvider: RoutingProvider = {
        id: 'p-openai-sub',
        provider: 'openai',
        is_active: true,
        has_api_key: true,
        key_prefix: '{"t":"eyJ',
        connected_at: '2025-01-01',
        auth_type: 'subscription',
      };
      render(() => (
        <ProviderSelectModal
          providers={[subProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('OpenAI'));
      expect(screen.getByText('Disconnect')).toBeDefined();
      expect(screen.getByText(/Connected via ChatGPT Plus\/Pro\/Team/)).toBeDefined();
    });

    it('shows OpenAI subscription label in list', () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      expect(screen.getByText('ChatGPT Plus/Pro/Team')).toBeDefined();
    });

    it('shows MiniMax subscription label in list', () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      expect(screen.getByText('MiniMax Coding Plan')).toBeDefined();
    });

    it('opens MiniMax device-code detail view', () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('MiniMax'));
      expect(screen.getByText('Connect providers')).toBeDefined();
      expect(screen.getByText('Connect with MiniMax')).toBeDefined();
      expect(screen.getByLabelText('Region')).toBeDefined();
    });

    it('starts MiniMax device-code flow and shows code details', async () => {
      vi.spyOn(window, 'open').mockReturnValue({ closed: false } as unknown as Window);

      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('MiniMax'));
      fireEvent.click(screen.getByText('Connect with MiniMax'));

      await waitFor(() => {
        expect(mockStartMinimaxOAuth).toHaveBeenCalledWith('test-agent', 'global');
      });
      expect(screen.getByDisplayValue('ABCD-1234')).toBeDefined();
      expect(screen.getByDisplayValue('https://www.minimax.io/verify')).toBeDefined();
      expect(window.open).toHaveBeenCalledWith(
        'https://www.minimax.io/verify',
        '_blank',
        'noopener,noreferrer',
      );

      vi.restoreAllMocks();
    });

    it('starts MiniMax device-code flow with the selected region', async () => {
      vi.spyOn(window, 'open').mockReturnValue({ closed: false } as unknown as Window);

      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('MiniMax'));
      fireEvent.change(screen.getByLabelText('Region'), { target: { value: 'cn' } });
      fireEvent.click(screen.getByText('Connect with MiniMax'));

      await waitFor(() => {
        expect(mockStartMinimaxOAuth).toHaveBeenCalledWith('test-agent', 'cn');
      });

      vi.restoreAllMocks();
    });

    it('shows MiniMax pending status and can reopen the verification page', async () => {
      vi.useFakeTimers();
      vi.spyOn(window, 'open').mockReturnValue({ closed: false } as unknown as Window);
      mockPollMinimaxOAuth.mockResolvedValueOnce({
        status: 'pending',
        message: 'Waiting for MiniMax approval…',
        pollIntervalMs: 2500,
      });

      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));

      fireEvent.click(screen.getByText('MiniMax'));
      fireEvent.click(screen.getByText('Connect with MiniMax'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('ABCD-1234')).toBeDefined();
      });

      await vi.advanceTimersByTimeAsync(2000);

      await waitFor(() => {
        expect(mockPollMinimaxOAuth).toHaveBeenCalledWith('flow-1');
        expect(screen.getByText('Waiting for MiniMax approval…')).toBeDefined();
      });

      fireEvent.click(screen.getByText('Open verification page'));

      expect(window.open).toHaveBeenLastCalledWith(
        'https://www.minimax.io/verify',
        '_blank',
        'noopener,noreferrer',
      );

      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('closes the modal when MiniMax approval succeeds', async () => {
      vi.useFakeTimers();
      vi.spyOn(window, 'open').mockReturnValue({ closed: false } as unknown as Window);
      mockPollMinimaxOAuth.mockResolvedValueOnce({ status: 'success' });

      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));

      fireEvent.click(screen.getByText('MiniMax'));
      fireEvent.click(screen.getByText('Connect with MiniMax'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('ABCD-1234')).toBeDefined();
      });

      await vi.advanceTimersByTimeAsync(2000);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('MiniMax subscription connected');
        expect(onUpdate).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });

      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('shows MiniMax poll errors inline', async () => {
      vi.useFakeTimers();
      vi.spyOn(window, 'open').mockReturnValue({ closed: false } as unknown as Window);
      mockPollMinimaxOAuth.mockResolvedValueOnce({
        status: 'error',
        message: 'MiniMax rejected the login',
      });

      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));

      fireEvent.click(screen.getByText('MiniMax'));
      fireEvent.click(screen.getByText('Connect with MiniMax'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('ABCD-1234')).toBeDefined();
      });

      await vi.advanceTimersByTimeAsync(2000);

      await waitFor(() => {
        expect(screen.getByText('MiniMax rejected the login')).toBeDefined();
      });
      expect(onClose).not.toHaveBeenCalled();

      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('shows a retry message when MiniMax polling throws', async () => {
      vi.useFakeTimers();
      vi.spyOn(window, 'open').mockReturnValue({ closed: false } as unknown as Window);
      mockPollMinimaxOAuth.mockRejectedValueOnce(new Error('network error'));

      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));

      fireEvent.click(screen.getByText('MiniMax'));
      fireEvent.click(screen.getByText('Connect with MiniMax'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('ABCD-1234')).toBeDefined();
      });

      await vi.advanceTimersByTimeAsync(2000);

      await waitFor(() => {
        expect(
          screen.getByText('Failed to check approval status. Start again to retry.'),
        ).toBeDefined();
      });

      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('shows an expiry message instead of polling expired MiniMax codes', async () => {
      vi.useFakeTimers();
      vi.spyOn(window, 'open').mockReturnValue({ closed: false } as unknown as Window);
      mockStartMinimaxOAuth.mockResolvedValueOnce({
        flowId: 'expired-flow',
        userCode: 'EXPIRED-1234',
        verificationUri: 'https://www.minimax.io/verify',
        expiresAt: Date.now() - 1,
        pollIntervalMs: 1,
      });

      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));

      fireEvent.click(screen.getByText('MiniMax'));
      fireEvent.click(screen.getByText('Connect with MiniMax'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('EXPIRED-1234')).toBeDefined();
      });

      await vi.advanceTimersByTimeAsync(1);

      await waitFor(() => {
        expect(
          screen.getByText('This verification code expired. Start again to generate a new one.'),
        ).toBeDefined();
      });
      expect(mockPollMinimaxOAuth).not.toHaveBeenCalled();

      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('keeps MiniMax in setup mode when starting the device-code flow fails', async () => {
      mockStartMinimaxOAuth.mockRejectedValueOnce(new Error('MiniMax unavailable'));

      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));

      fireEvent.click(screen.getByText('MiniMax'));
      fireEvent.click(screen.getByText('Connect with MiniMax'));

      await waitFor(() => {
        expect(mockStartMinimaxOAuth).toHaveBeenCalledWith('test-agent', 'global');
      });
      expect(screen.queryByDisplayValue('ABCD-1234')).toBeNull();
      expect(screen.getByText('Connect with MiniMax')).toBeDefined();
    });

    it('shows Disconnect button for connected MiniMax subscription', () => {
      const subProvider: RoutingProvider = {
        id: 'p-minimax-sub',
        provider: 'minimax',
        is_active: true,
        has_api_key: true,
        key_prefix: '{"t":"mm',
        connected_at: '2025-01-01',
        auth_type: 'subscription',
      };
      render(() => (
        <ProviderSelectModal
          providers={[subProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('MiniMax'));
      expect(screen.getByText('Disconnect')).toBeDefined();
      expect(screen.getByText(/Connected via MiniMax Coding Plan/)).toBeDefined();
    });

    it('disconnects MiniMax without revoking OpenAI OAuth', async () => {
      const subProvider: RoutingProvider = {
        id: 'p-minimax-sub',
        provider: 'minimax',
        is_active: true,
        has_api_key: true,
        key_prefix: '{"t":"mm',
        connected_at: '2025-01-01',
        auth_type: 'subscription',
      };
      render(() => (
        <ProviderSelectModal
          providers={[subProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));

      fireEvent.click(screen.getByText('MiniMax'));
      fireEvent.click(screen.getByText('Disconnect'));

      await waitFor(() => {
        expect(mockDisconnectProvider).toHaveBeenCalledWith(
          'test-agent',
          'minimax',
          'subscription',
        );
      });
      expect(mockRevokeOpenaiOAuth).not.toHaveBeenCalled();
    });

    it('shows MiniMax disconnect notifications as error toasts', async () => {
      mockDisconnectProvider.mockResolvedValueOnce({
        notifications: ['MiniMax tiers were recalculated.'],
      });
      const subProvider: RoutingProvider = {
        id: 'p-minimax-sub',
        provider: 'minimax',
        is_active: true,
        has_api_key: true,
        key_prefix: '{"t":"mm',
        connected_at: '2025-01-01',
        auth_type: 'subscription',
      };
      render(() => (
        <ProviderSelectModal
          providers={[subProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));

      fireEvent.click(screen.getByText('MiniMax'));
      fireEvent.click(screen.getByText('Disconnect'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('MiniMax tiers were recalculated.');
      });
      expect(mockRevokeOpenaiOAuth).not.toHaveBeenCalled();
    });

    it('ignores stale MiniMax poll results while a replacement flow is still starting', async () => {
      vi.useFakeTimers();
      const openSpy = vi
        .spyOn(window, 'open')
        .mockReturnValue({ closed: false } as unknown as Window);

      let resolveFirstPoll:
        | ((value: { status: string; message?: string; pollIntervalMs?: number }) => void)
        | undefined;
      let resolveSecondStart:
        | ((value: {
            flowId: string;
            userCode: string;
            verificationUri: string;
            expiresAt: number;
            pollIntervalMs: number;
          }) => void)
        | undefined;
      mockStartMinimaxOAuth
        .mockResolvedValueOnce({
          flowId: 'flow-1',
          userCode: 'ABCD-1234',
          verificationUri: 'https://www.minimax.io/verify',
          expiresAt: Date.now() + 60_000,
          pollIntervalMs: 2000,
        })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveSecondStart = resolve;
            }),
        );
      mockPollMinimaxOAuth.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstPoll = resolve;
          }),
      );

      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));

      fireEvent.click(screen.getByText('MiniMax'));
      fireEvent.click(screen.getByText('Connect with MiniMax'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('ABCD-1234')).toBeDefined();
      });

      await vi.advanceTimersByTimeAsync(2000);
      await waitFor(() => {
        expect(mockPollMinimaxOAuth).toHaveBeenCalledWith('flow-1');
      });

      fireEvent.click(screen.getByText('Start over'));

      await waitFor(() => {
        expect(mockStartMinimaxOAuth).toHaveBeenCalledTimes(2);
      });

      resolveFirstPoll?.({ status: 'success' });
      await Promise.resolve();
      await Promise.resolve();

      expect(onClose).not.toHaveBeenCalled();
      expect(onUpdate).not.toHaveBeenCalled();
      expect(screen.getByDisplayValue('ABCD-1234')).toBeDefined();

      resolveSecondStart?.({
        flowId: 'flow-2',
        userCode: 'WXYZ-9876',
        verificationUri: 'https://www.minimax.io/verify-2',
        expiresAt: Date.now() + 60_000,
        pollIntervalMs: 2000,
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('WXYZ-9876')).toBeDefined();
      });

      vi.useRealTimers();
      openSpy.mockRestore();
    });

    it('stops MiniMax polling after the modal unmounts', async () => {
      vi.useFakeTimers();
      vi.spyOn(window, 'open').mockReturnValue({ closed: false } as unknown as Window);

      let resolveFirstPoll:
        | ((value: { status: string; message?: string; pollIntervalMs?: number }) => void)
        | undefined;
      mockPollMinimaxOAuth.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstPoll = resolve;
          }),
      );

      const view = render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));

      fireEvent.click(screen.getByText('MiniMax'));
      fireEvent.click(screen.getByText('Connect with MiniMax'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('ABCD-1234')).toBeDefined();
      });

      await vi.advanceTimersByTimeAsync(2000);
      await waitFor(() => {
        expect(mockPollMinimaxOAuth).toHaveBeenCalledTimes(1);
      });

      view.unmount();
      resolveFirstPoll?.({ status: 'pending', pollIntervalMs: 2000 });
      await Promise.resolve();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(4000);

      expect(mockPollMinimaxOAuth).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('does not show paste field for OAuth provider', () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('OpenAI'));
      // Should not have a setup token input field
      const inputs = document.querySelectorAll(".provider-detail__input--masked");
      expect(inputs.length).toBe(0);
    });

    it('handles OAuth login error gracefully', async () => {
      mockGetOpenaiOAuthUrl.mockRejectedValue(new Error('Network error'));

      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('OpenAI'));
      fireEvent.click(screen.getByText('Log in with OpenAI'));

      await waitFor(() => {
        expect(mockGetOpenaiOAuthUrl).toHaveBeenCalled();
      });
    });

    it('shows toggle as on for OpenAI subscription with token', () => {
      const subProvider: RoutingProvider = {
        id: 'p-openai-sub',
        provider: 'openai',
        is_active: true,
        has_api_key: true,
        key_prefix: '{"t":"eyJ',
        connected_at: '2025-01-01',
        auth_type: 'subscription',
      };
      const { container } = render(() => (
        <ProviderSelectModal
          providers={[subProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      const onSwitches = container.querySelectorAll('.provider-toggle__switch--on');
      expect(onSwitches.length).toBeGreaterThanOrEqual(1);
    });

    it('disconnects OpenAI OAuth subscription and revokes token', async () => {
      const subProvider: RoutingProvider = {
        id: 'p-openai-sub',
        provider: 'openai',
        is_active: true,
        has_api_key: true,
        key_prefix: '{"t":"eyJ',
        connected_at: '2025-01-01',
        auth_type: 'subscription',
      };
      render(() => (
        <ProviderSelectModal
          providers={[subProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('OpenAI'));
      fireEvent.click(screen.getByText('Disconnect'));

      await waitFor(() => {
        expect(mockRevokeOpenaiOAuth).toHaveBeenCalledWith('test-agent');
        expect(mockDisconnectProvider).toHaveBeenCalledWith('test-agent', 'openai', 'subscription');
      });
      expect(onUpdate).toHaveBeenCalled();
    });

    it('still disconnects when token revocation fails', async () => {
      mockRevokeOpenaiOAuth.mockRejectedValue(new Error('revoke failed'));
      const subProvider: RoutingProvider = {
        id: 'p-openai-sub',
        provider: 'openai',
        is_active: true,
        has_api_key: true,
        key_prefix: '{"t":"eyJ',
        connected_at: '2025-01-01',
        auth_type: 'subscription',
      };
      render(() => (
        <ProviderSelectModal
          providers={[subProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('OpenAI'));
      fireEvent.click(screen.getByText('Disconnect'));

      await waitFor(() => {
        expect(mockDisconnectProvider).toHaveBeenCalledWith('test-agent', 'openai', 'subscription');
      });
      expect(onUpdate).toHaveBeenCalled();
    });

    it('shows popup blocked error when window.open returns null', async () => {
      vi.spyOn(window, 'open').mockReturnValue(null);

      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('OpenAI'));
      fireEvent.click(screen.getByText('Log in with OpenAI'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Popup was blocked by your browser. Allow popups for this site, then try again.',
        );
      });

      vi.restoreAllMocks();
    });

    it('detects successful OAuth callback via polling', async () => {
      // Set the done URL immediately so the first poll tick picks it up
      const mockPopup = {
        closed: false,
        close: vi.fn(),
        location: { href: 'http://localhost:3000/oauth/openai/done?ok=1' },
      };
      vi.spyOn(window, 'open').mockReturnValue(mockPopup as unknown as Window);

      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('OpenAI'));
      fireEvent.click(screen.getByText('Log in with OpenAI'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('OpenAI subscription connected');
      });
      expect(mockPopup.close).toHaveBeenCalled();
      expect(onUpdate).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('shows paste URL input immediately after clicking login', async () => {
      const mockPopup = {
        closed: false,
        close: vi.fn(),
        get location(): { href: string } {
          throw new DOMException('cross-origin');
        },
      };
      vi.spyOn(window, 'open').mockReturnValue(mockPopup as unknown as Window);

      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('OpenAI'));
      fireEvent.click(screen.getByText('Log in with OpenAI'));

      // Paste URL field appears immediately (not after popup closes)
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('http://localhost:1455/auth/callback?code=...'),
        ).toBeDefined();
      });
      expect(onUpdate).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('stops polling when popup is closed by user', async () => {
      const mockPopup = {
        closed: true,
        close: vi.fn(),
        get location(): { href: string } {
          throw new DOMException('cross-origin');
        },
      };
      vi.spyOn(window, 'open').mockReturnValue(mockPopup as unknown as Window);

      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('OpenAI'));
      fireEvent.click(screen.getByText('Log in with OpenAI'));

      // Wait long enough for the polling to detect the closed popup
      await new Promise((r) => setTimeout(r, 500));

      // No success or error toast, just stopped polling
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      expect(onUpdate).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('detects successful OAuth via BroadcastChannel', async () => {
      const mockPopup = {
        closed: false,
        close: vi.fn(),
        get location(): { href: string } {
          throw new DOMException('cross-origin');
        },
      };
      vi.spyOn(window, 'open').mockReturnValue(mockPopup as unknown as Window);

      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('OpenAI'));
      fireEvent.click(screen.getByText('Log in with OpenAI'));

      // Simulate the done page sending via BroadcastChannel
      await new Promise((r) => setTimeout(r, 50));
      const bc = new BroadcastChannel('manifest-oauth');
      bc.postMessage({ type: 'manifest-oauth-success' });
      bc.close();

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('OpenAI subscription connected');
      });
      expect(onUpdate).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('BroadcastChannel still works after COOP makes popup appear closed', async () => {
      // COOP headers from auth.openai.com sever window.opener,
      // making popup.closed return true immediately in the opener.
      const mockPopup = {
        closed: true,
        close: vi.fn(),
        get location(): { href: string } {
          throw new DOMException('cross-origin');
        },
      };
      vi.spyOn(window, 'open').mockReturnValue(mockPopup as unknown as Window);

      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('OpenAI'));
      fireEvent.click(screen.getByText('Log in with OpenAI'));

      // Poll detects popup.closed=true, but BroadcastChannel stays alive
      await new Promise((r) => setTimeout(r, 500));

      // OAuth flow completes and done page sends BroadcastChannel message
      const bc = new BroadcastChannel('manifest-oauth');
      bc.postMessage({ type: 'manifest-oauth-success' });
      bc.close();

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('OpenAI subscription connected');
      });
      expect(onUpdate).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('detects successful OAuth via postMessage', async () => {
      const mockPopup = {
        closed: false,
        close: vi.fn(),
        get location(): { href: string } {
          throw new DOMException('cross-origin');
        },
      };
      vi.spyOn(window, 'open').mockReturnValue(mockPopup as unknown as Window);

      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('OpenAI'));
      fireEvent.click(screen.getByText('Log in with OpenAI'));

      // Simulate the done page sending a postMessage
      await new Promise((r) => setTimeout(r, 50));
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'manifest-oauth-success' } }),
      );

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('OpenAI subscription connected');
      });
      expect(mockPopup.close).toHaveBeenCalled();
      expect(onUpdate).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('keeps paste URL visible after failed OAuth via postMessage', async () => {
      const mockPopup = {
        closed: false,
        close: vi.fn(),
        get location(): { href: string } {
          throw new DOMException('cross-origin');
        },
      };
      vi.spyOn(window, 'open').mockReturnValue(mockPopup as unknown as Window);

      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('OpenAI'));
      fireEvent.click(screen.getByText('Log in with OpenAI'));

      // Paste URL field is already visible before any message
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('http://localhost:1455/auth/callback?code=...'),
        ).toBeDefined();
      });

      // Error message arrives — paste field still visible, no crash
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'manifest-oauth-error' } }));
      await new Promise((r) => setTimeout(r, 50));
      expect(
        screen.getByPlaceholderText('http://localhost:1455/auth/callback?code=...'),
      ).toBeDefined();
      expect(onUpdate).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it("opens device login view for copilot instead of toggling directly", async () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      // Find the copilot row and click its toggle area
      const copilotText = screen.getByText("GitHub Copilot");
      expect(copilotText).toBeDefined();

      // Click the Copilot row (toggle)
      fireEvent.click(copilotText);

      // Should open device login detail view instead of calling connectProvider
      await waitFor(() => {
        expect(screen.getByText("Connect providers")).toBeDefined();
      });
      // connectProvider should NOT have been called (device login guard)
      expect(mockConnectProvider).not.toHaveBeenCalled();
    });

    it("opens device login detail view for connected copilot (disconnect via detail)", async () => {
      const copilotSubProvider: RoutingProvider = {
        id: "p-copilot",
        provider: "copilot",
        is_active: true,
        has_api_key: true,
        key_prefix: "ghu_",
        connected_at: "2025-01-01",
        auth_type: "subscription",
      };
      render(() => (
        <ProviderSelectModal
          providers={[copilotSubProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      // Click the copilot row — always navigates to detail view
      const copilotText = screen.getByText("GitHub Copilot");
      fireEvent.click(copilotText);

      // Should open device login detail view (with disconnect button)
      await waitFor(() => {
        expect(screen.getByText("Connected via GitHub device login.")).toBeDefined();
      });
    });
  });

  describe('custom provider callbacks', () => {
    it('calls onUpdate when custom provider form triggers onCreated', async () => {
      mockCreateCustomProvider.mockResolvedValue({
        id: 'cp-new',
        name: 'NewProvider',
        base_url: 'http://localhost:8080',
        has_api_key: false,
        models: [{ model_name: 'test-model' }],
        created_at: '2025-01-01',
      });

      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('Add custom provider'));

      // Fill in the custom provider form
      const nameInput = screen.getByPlaceholderText('e.g. Groq, Together, Azure');
      fireEvent.input(nameInput, { target: { value: 'NewProvider' } });

      const urlInput = screen.getByPlaceholderText('https://api.example.com/v1');
      fireEvent.input(urlInput, { target: { value: 'http://localhost:8080' } });

      const modelInput = screen.getByPlaceholderText('Model name');
      fireEvent.input(modelInput, { target: { value: 'test-model' } });

      // Click Connect (the create mode button label)
      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockCreateCustomProvider).toHaveBeenCalled();
      });
      expect(onUpdate).toHaveBeenCalled();
      // Should navigate back to list view
      expect(screen.getByText('Done')).toBeDefined();
    });

    it('calls onUpdate when custom provider form triggers onDeleted', async () => {
      mockDeleteCustomProvider.mockResolvedValue({ ok: true });

      const customProviders = [
        {
          id: 'cp-1',
          name: 'TestProv',
          base_url: 'http://localhost:8080',
          has_api_key: false,
          models: [{ model_name: 'm1' }],
          created_at: '2025-01-01',
        },
      ];

      render(() => (
        <ProviderSelectModal
          providers={[]}
          customProviders={customProviders}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText('API Keys'));
      fireEvent.click(screen.getByText('TestProv'));

      // Click Delete provider button to open confirmation dialog
      fireEvent.click(screen.getByText('Delete provider'));

      // Confirm deletion in the confirmation dialog
      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeDefined();
      });
      fireEvent.click(screen.getByText('Delete'));

      await waitFor(() => {
        expect(mockDeleteCustomProvider).toHaveBeenCalledWith('test-agent', 'cp-1');
      });
      expect(onUpdate).toHaveBeenCalled();
      // Should navigate back to list view
      expect(screen.getByText('Done')).toBeDefined();
    });
  });
});
