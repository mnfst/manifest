import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

const mockStartAnthropicOAuth = vi.fn();
const mockSubmitAnthropicOAuth = vi.fn();
const mockRevokeAnthropicOAuth = vi.fn();
const mockGetAnthropicOAuthPending = vi.fn();
const mockDisconnectProvider = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock('../../src/services/api.js', () => ({
  startAnthropicOAuth: (...args: unknown[]) => mockStartAnthropicOAuth(...args),
  submitAnthropicOAuth: (...args: unknown[]) => mockSubmitAnthropicOAuth(...args),
  revokeAnthropicOAuth: (...args: unknown[]) => mockRevokeAnthropicOAuth(...args),
  getAnthropicOAuthPending: (...args: unknown[]) => mockGetAnthropicOAuthPending(...args),
  disconnectProvider: (...args: unknown[]) => mockDisconnectProvider(...args),
}));

vi.mock('../../src/services/toast-store.js', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

import AnthropicOAuthDetailView from '../../src/components/AnthropicOAuthDetailView';
import type { ProviderDef } from '../../src/services/providers.js';

const provDef: ProviderDef = {
  id: 'anthropic',
  name: 'Anthropic',
  color: '#000',
  initial: 'A',
  subtitle: '',
  models: [],
  keyPrefix: 'sk-ant-',
  minKeyLength: 50,
  keyPlaceholder: '',
  supportsSubscription: true,
  subscriptionLabel: 'Claude Max / Pro subscription',
  subscriptionAuthMode: 'popup_paste',
};

function renderView(connectedValue = false) {
  const [busy, setBusy] = createSignal(false);
  const onBack = vi.fn();
  const onUpdate = vi.fn();
  const onClose = vi.fn();
  const result = render(() => (
    <AnthropicOAuthDetailView
      provDef={provDef}
      provId="anthropic"
      agentName="test-agent"
      connected={() => connectedValue}
      selectedAuthType={() => 'subscription'}
      busy={busy}
      setBusy={setBusy}
      onBack={onBack}
      onUpdate={onUpdate}
      onClose={onClose}
    />
  ));
  return { ...result, onBack, onUpdate, onClose };
}

const OAUTH_PAYLOAD = 'auth-code-123#state-xyz';

describe('AnthropicOAuthDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAnthropicOAuthPending.mockResolvedValue({ state: null });
  });

  it('renders the sign-in button and the paste-code input', () => {
    renderView();
    expect(screen.getByText('Sign in with Claude')).toBeDefined();
    expect(screen.getByLabelText('Anthropic authorization code')).toBeDefined();
  });

  it('shows a toast and clears state when the popup is blocked', async () => {
    mockStartAnthropicOAuth.mockResolvedValue({ url: 'https://x', state: 'abc' });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    renderView();
    fireEvent.click(screen.getByText('Sign in with Claude'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(expect.stringMatching(/Popup was blocked/));
    });
    openSpy.mockRestore();
  });

  it('starts the OAuth flow and opens a popup', async () => {
    mockStartAnthropicOAuth.mockResolvedValue({ url: 'https://x', state: 'abc' });
    const openSpy = vi
      .spyOn(window, 'open')
      .mockReturnValue({ closed: false } as unknown as Window);

    renderView();
    fireEvent.click(screen.getByText('Sign in with Claude'));

    await waitFor(() => {
      expect(mockStartAnthropicOAuth).toHaveBeenCalledWith('test-agent');
    });
    expect(openSpy).toHaveBeenCalledWith(
      'https://x',
      'manifest-anthropic-oauth',
      'noopener,noreferrer',
    );
    openSpy.mockRestore();
  });

  it('exchanges a pasted authorization code', async () => {
    mockStartAnthropicOAuth.mockResolvedValue({ url: 'https://x', state: 'state-xyz' });
    mockSubmitAnthropicOAuth.mockResolvedValue({ ok: true });
    vi.spyOn(window, 'open').mockReturnValue({ closed: false } as unknown as Window);

    const { onClose, onUpdate } = renderView();
    fireEvent.click(screen.getByText('Sign in with Claude'));
    await waitFor(() => expect(mockStartAnthropicOAuth).toHaveBeenCalled());

    const codeInput = screen.getByLabelText('Anthropic authorization code');
    fireEvent.input(codeInput, { target: { value: OAUTH_PAYLOAD } });
    fireEvent.click(screen.getByText('Connect'));

    await waitFor(() => {
      expect(mockSubmitAnthropicOAuth).toHaveBeenCalledWith(
        'test-agent',
        'auth-code-123',
        'state-xyz',
      );
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Anthropic subscription connected');
    expect(onUpdate).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('rejects input that does not look like an authorization code', () => {
    renderView();
    const codeInput = screen.getByLabelText('Anthropic authorization code');
    fireEvent.input(codeInput, { target: { value: 'sk-ant-oat01-some-token' } });
    fireEvent.click(screen.getByText('Connect'));

    expect(screen.getByText(/doesn't look like an authorization code/)).toBeDefined();
    expect(mockSubmitAnthropicOAuth).not.toHaveBeenCalled();
  });

  it('hydrates pending state on mount so a code can be pasted after a modal close', async () => {
    mockGetAnthropicOAuthPending.mockResolvedValue({ state: 'persisted-state' });
    mockSubmitAnthropicOAuth.mockResolvedValue({ ok: true });

    renderView();
    await waitFor(() => expect(mockGetAnthropicOAuthPending).toHaveBeenCalled());

    const codeInput = screen.getByLabelText('Anthropic authorization code');
    fireEvent.input(codeInput, { target: { value: 'fresh-code#persisted-state' } });
    fireEvent.click(screen.getByText('Connect'));

    await waitFor(() => {
      expect(mockSubmitAnthropicOAuth).toHaveBeenCalledWith(
        'test-agent',
        'fresh-code',
        'persisted-state',
      );
    });
  });

  it('hydrates pending state at submit time when the local signal was lost', async () => {
    mockGetAnthropicOAuthPending
      .mockResolvedValueOnce({ state: null }) // onMount call
      .mockResolvedValueOnce({ state: 'late-state' }); // submit call
    mockSubmitAnthropicOAuth.mockResolvedValue({ ok: true });

    renderView();
    await waitFor(() => expect(mockGetAnthropicOAuthPending).toHaveBeenCalledTimes(1));

    const codeInput = screen.getByLabelText('Anthropic authorization code');
    fireEvent.input(codeInput, { target: { value: 'code#whatever' } });
    fireEvent.click(screen.getByText('Connect'));

    await waitFor(() => {
      expect(mockSubmitAnthropicOAuth).toHaveBeenCalledWith('test-agent', 'code', 'late-state');
    });
  });

  it('asks the user to sign in first when no pending state is available', async () => {
    mockGetAnthropicOAuthPending.mockResolvedValue({ state: null });

    renderView();
    await waitFor(() => expect(mockGetAnthropicOAuthPending).toHaveBeenCalled());

    const codeInput = screen.getByLabelText('Anthropic authorization code');
    fireEvent.input(codeInput, { target: { value: 'orphan-code#orphan-state' } });
    fireEvent.click(screen.getByText('Connect'));

    await waitFor(() => {
      expect(screen.getByText(/Click "Sign in with Claude" first/)).toBeDefined();
    });
    expect(mockSubmitAnthropicOAuth).not.toHaveBeenCalled();
  });

  it('shows an error if the OAuth exchange fails', async () => {
    mockStartAnthropicOAuth.mockResolvedValue({ url: 'https://x', state: 's1' });
    mockSubmitAnthropicOAuth.mockRejectedValue(new Error('boom'));
    vi.spyOn(window, 'open').mockReturnValue({ closed: false } as unknown as Window);

    renderView();
    fireEvent.click(screen.getByText('Sign in with Claude'));
    await waitFor(() => expect(mockStartAnthropicOAuth).toHaveBeenCalled());

    const codeInput = screen.getByLabelText('Anthropic authorization code');
    fireEvent.input(codeInput, { target: { value: 'code#s1' } });
    fireEvent.click(screen.getByText('Connect'));

    await waitFor(() => {
      expect(screen.getByText(/Failed to exchange code/)).toBeDefined();
    });
  });

  it('falls back gracefully when the pending lookup throws on mount', async () => {
    mockGetAnthropicOAuthPending.mockRejectedValue(new Error('network'));
    renderView();
    await waitFor(() => expect(mockGetAnthropicOAuthPending).toHaveBeenCalled());
    expect(screen.getByText('Sign in with Claude')).toBeDefined();
  });

  it('skips the pending lookup when already connected', () => {
    renderView(true);
    expect(screen.getByText('Disconnect')).toBeDefined();
    expect(mockGetAnthropicOAuthPending).not.toHaveBeenCalled();
  });

  it('falls back gracefully when the late-arriving pending lookup throws', async () => {
    mockGetAnthropicOAuthPending
      .mockResolvedValueOnce({ state: null }) // onMount
      .mockRejectedValueOnce(new Error('network')); // submit-time

    renderView();
    await waitFor(() => expect(mockGetAnthropicOAuthPending).toHaveBeenCalledTimes(1));

    const codeInput = screen.getByLabelText('Anthropic authorization code');
    fireEvent.input(codeInput, { target: { value: 'code#whatever' } });
    fireEvent.click(screen.getByText('Connect'));

    await waitFor(() => {
      expect(screen.getByText(/Click "Sign in with Claude" first/)).toBeDefined();
    });
  });

  it('submits on Enter inside the paste input', async () => {
    mockGetAnthropicOAuthPending.mockResolvedValue({ state: 's' });
    mockSubmitAnthropicOAuth.mockResolvedValue({ ok: true });
    renderView();
    await waitFor(() => expect(mockGetAnthropicOAuthPending).toHaveBeenCalled());

    const codeInput = screen.getByLabelText('Anthropic authorization code');
    fireEvent.input(codeInput, { target: { value: 'code#s' } });
    fireEvent.keyDown(codeInput, { key: 'Enter' });

    await waitFor(() => expect(mockSubmitAnthropicOAuth).toHaveBeenCalled());
  });

  it('does not submit when the input is whitespace', () => {
    renderView();
    const codeInput = screen.getByLabelText('Anthropic authorization code');
    fireEvent.input(codeInput, { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Connect'));
    expect(mockSubmitAnthropicOAuth).not.toHaveBeenCalled();
  });

  it('surfaces server-side notifications when disconnect returns them', async () => {
    mockRevokeAnthropicOAuth.mockResolvedValue({ ok: true });
    mockDisconnectProvider.mockResolvedValue({
      notifications: ['Subscription is shared with another agent'],
    });

    const { onBack } = renderView(true);
    fireEvent.click(screen.getByText('Disconnect'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Subscription is shared with another agent');
    });
    expect(onBack).toHaveBeenCalled();
  });

  it('continues with disconnect when revoke fails (best-effort cleanup)', async () => {
    mockRevokeAnthropicOAuth.mockRejectedValue(new Error('revoke failed'));
    mockDisconnectProvider.mockResolvedValue({ ok: true });

    const { onBack, onUpdate } = renderView(true);
    fireEvent.click(screen.getByText('Disconnect'));

    await waitFor(() => expect(mockDisconnectProvider).toHaveBeenCalled());
    expect(onBack).toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalled();
  });

  it('does not throw when disconnect itself fails', async () => {
    mockRevokeAnthropicOAuth.mockResolvedValue({ ok: true });
    mockDisconnectProvider.mockRejectedValue(new Error('network'));

    const { onBack } = renderView(true);
    fireEvent.click(screen.getByText('Disconnect'));

    await waitFor(() => expect(mockDisconnectProvider).toHaveBeenCalled());
    expect(onBack).not.toHaveBeenCalled();
  });

  it('swallows errors thrown by startAnthropicOAuth', async () => {
    mockStartAnthropicOAuth.mockRejectedValue(new Error('network'));
    renderView();
    fireEvent.click(screen.getByText('Sign in with Claude'));
    await waitFor(() => expect(mockStartAnthropicOAuth).toHaveBeenCalled());
    expect(screen.getByText('Sign in with Claude')).toBeDefined();
  });
});
