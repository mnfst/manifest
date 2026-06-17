import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";

// NOTE (post-#2207 realignment):
// ProviderSelectModal no longer renders a provider list/tabs; it opens straight
// into a provider's detail view via `providerDeepLink` (exactly how
// ProviderConnectionsPage drives it in production). These tests previously
// reached the command-only provider's detail view by clicking it in the
// subscription list; they now pass the deep link instead. With a deep link
// open, the detail view's "Done"/back button closes the modal (there is no
// list to return to), so the final assertion checks `onClose` rather than the
// removed list view.

const mockConnectProvider = vi.fn();
const mockDisconnectProvider = vi.fn();
const mockGetOpenaiOAuthUrl = vi.fn();
const mockGetXaiOAuthUrl = vi.fn();
const mockSubmitOpenaiOAuthCallback = vi.fn();
const mockSubmitXaiOAuthCallback = vi.fn();
const mockPollMinimaxOAuth = vi.fn();
const mockStartMinimaxOAuth = vi.fn();
const mockRenameProviderKey = vi.fn();

vi.mock("../../src/services/api.js", () => ({
  connectProvider: (...args: unknown[]) => mockConnectProvider(...args),
  disconnectProvider: (...args: unknown[]) => mockDisconnectProvider(...args),
  refreshProviderModels: () => Promise.resolve({ ok: true, model_count: 0 }),
  getOpenaiOAuthUrl: (...args: unknown[]) => mockGetOpenaiOAuthUrl(...args),
  getXaiOAuthUrl: (...args: unknown[]) => mockGetXaiOAuthUrl(...args),
  submitOpenaiOAuthCallback: (...args: unknown[]) => mockSubmitOpenaiOAuthCallback(...args),
  submitXaiOAuthCallback: (...args: unknown[]) => mockSubmitXaiOAuthCallback(...args),
  pollMinimaxOAuth: (...args: unknown[]) => mockPollMinimaxOAuth(...args),
  revokeOpenaiOAuth: () => Promise.resolve({ ok: true }),
  revokeXaiOAuth: () => Promise.resolve({ ok: true }),
  startMinimaxOAuth: (...args: unknown[]) => mockStartMinimaxOAuth(...args),
  renameProviderKey: (...args: unknown[]) => mockRenameProviderKey(...args),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../src/components/ProviderIcon.js", () => ({
  providerIcon: () => null, customProviderLogo: () => null,
}));

// Mock providers to include a "command-only" subscription provider:
// has subscriptionCommand but NO subscriptionKeyPlaceholder and NO auth mode,
// which makes the detail view render the command-only login flow.
vi.mock("../../src/services/providers.js", () => {
  const commandOnlyProvider = {
    id: "cmd-sub",
    name: "CmdProvider",
    color: "#123",
    initial: "C",
    subtitle: "Command-only subscription provider",
    keyPrefix: "",
    minKeyLength: 0,
    keyPlaceholder: "",
    models: [],
    supportsSubscription: true,
    subscriptionLabel: "CmdSub Plan",
    subscriptionCommand: "cmdprov login",
    // No subscriptionKeyPlaceholder
    // No subscriptionAuthMode
  };
  return {
    PROVIDERS: [commandOnlyProvider],
    validateApiKey: () => ({ valid: true }),
    validateSubscriptionKey: () => ({ valid: true }),
  };
});

vi.mock("../../src/services/provider-utils.js", () => ({
  validateApiKey: () => ({ valid: true }),
  validateSubscriptionKey: () => ({ valid: true }),
}));

import ProviderSelectModal from "../../src/components/ProviderSelectModal";
import type { RoutingProvider } from "../../src/services/api.js";

describe("ProviderSelectModal -- command-only subscription detail view", () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onClose = vi.fn();
    onUpdate = vi.fn();
    mockDisconnectProvider.mockResolvedValue({ notifications: [] });
    mockPollMinimaxOAuth.mockResolvedValue({ status: "pending", pollIntervalMs: 2000 });
    mockStartMinimaxOAuth.mockResolvedValue({
      flowId: "flow-1",
      userCode: "ABCD-1234",
      verificationUri: "https://www.minimax.io/verify",
      expiresAt: Date.now() + 60_000,
      pollIntervalMs: 2000,
    });
  });

  it("shows command-only subtitle and hint text when not connected", () => {
    render(() => (
      <ProviderSelectModal
        providers={[]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
        providerDeepLink={{ providerId: "cmd-sub", authType: "subscription" }}
      />
    ));

    // Command-only hint
    expect(
      screen.getByText("Run the command below to log in via your browser."),
    ).toBeDefined();

    // Terminal command is shown
    expect(screen.getByText("cmdprov login")).toBeDefined();

    // Shows Done button (not connected)
    expect(screen.getByText("Done")).toBeDefined();
  });

  it("shows Disconnect button when command-only provider is connected", async () => {
    const connectedSub: RoutingProvider = {
      id: "p-cmd",
      provider: "cmd-sub",
      is_active: true,
      has_api_key: false,
      connected_at: "2025-01-01",
      auth_type: "subscription",
    };
    render(() => (
      <ProviderSelectModal
        providers={[connectedSub]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
        providerDeepLink={{ providerId: "cmd-sub", authType: "subscription" }}
      />
    ));

    // Should show Disconnect button
    expect(screen.getByText("Disconnect")).toBeDefined();

    // Click Disconnect
    fireEvent.click(screen.getByText("Disconnect"));

    await waitFor(() => {
      expect(mockDisconnectProvider).toHaveBeenCalledWith(
        "test-agent",
        "cmd-sub",
        "subscription",
      );
    });
    expect(onUpdate).toHaveBeenCalled();
  });

  it("shows Done button when command-only provider is not connected", () => {
    render(() => (
      <ProviderSelectModal
        providers={[]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
        providerDeepLink={{ providerId: "cmd-sub", authType: "subscription" }}
      />
    ));

    const doneBtn = screen.getByText("Done");
    expect(doneBtn).toBeDefined();

    // Clicking Done closes the modal (deep-link opens straight into the detail
    // view, so there is no list to return to — goBack() calls onClose()).
    fireEvent.click(doneBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
