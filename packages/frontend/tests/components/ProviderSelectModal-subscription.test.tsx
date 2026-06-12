import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";

// NOTE (post-#2207 realignment):
// ProviderSelectModal no longer renders a provider list with subscription
// toggle switches — the list/tab UI (and `handleSubscriptionToggle`) was
// extracted into ProviderSubscriptionTab / RoutingTabs. The modal now opens
// straight into a single provider's detail view via `providerDeepLink`, which
// is exactly how ProviderConnectionsPage drives it in production.
//
// The original "toggle path" assertions (connect/disconnect a subscription by
// flipping a list toggle, the `provider-toggle__switch--on` state, and the
// default "Subscription" label) now live in:
//   - tests/components/ProviderSubscriptionTab.test.tsx
//     ("calls onToggle ... when provider has no detail-view fields",
//      "omits the provider-toggle__switch--on class when disconnected",
//      'renders the hint, link, and falls back to default "Subscription" label')
//
// This file is realigned to test the surviving contract: connecting and
// disconnecting a subscription through ProviderSelectModal's detail view. The
// connect/disconnect/notification/error intent of the original toggle tests is
// preserved against the real entry point.

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

// A subscription provider that stores a pasted token. In the detail view this
// renders the subscription token form (ProviderKeyForm in subscription mode),
// which is the surviving surface for subscription connect/disconnect.
vi.mock("../../src/services/providers.js", () => {
  const testProvider = {
    id: "test-sub",
    name: "TestSub",
    color: "#000",
    initial: "T",
    subtitle: "Test subscription provider",
    keyPrefix: "",
    minKeyLength: 0,
    keyPlaceholder: "",
    models: [],
    supportsSubscription: true,
    subscriptionAuthMode: "token",
    subscriptionLabel: "TestSub Plan",
    subscriptionKeyPlaceholder: "Paste your TestSub token",
  };
  return {
    PROVIDERS: [testProvider],
    validateApiKey: () => ({ valid: true }),
    validateSubscriptionKey: () => ({ valid: true }),
  };
});

vi.mock("../../src/services/provider-utils.js", () => ({
  validateApiKey: () => ({ valid: true }),
  validateSubscriptionKey: () => ({ valid: true }),
}));

import ProviderSelectModal from "../../src/components/ProviderSelectModal";
import { toast } from "../../src/services/toast-store.js";
import type { RoutingProvider } from "../../src/services/api.js";

const VALID_TOKEN = "tok-abcdef123456";

const connectedSub: RoutingProvider = {
  id: "p-sub",
  provider: "test-sub",
  is_active: true,
  has_api_key: true,
  connected_at: "2025-01-01",
  auth_type: "subscription",
};

describe("ProviderSelectModal — subscription detail view", () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onClose = vi.fn();
    onUpdate = vi.fn();
    mockConnectProvider.mockResolvedValue({});
    mockDisconnectProvider.mockResolvedValue({ notifications: [] });
  });

  it("connects a subscription provider when a token is pasted and Connect is clicked", async () => {
    render(() => (
      <ProviderSelectModal
        providers={[]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
        providerDeepLink={{ providerId: "test-sub", authType: "subscription" }}
      />
    ));
    fireEvent.input(screen.getByLabelText("TestSub setup token"), {
      target: { value: VALID_TOKEN },
    });
    fireEvent.click(screen.getByText("Connect"));

    await waitFor(() => {
      expect(mockConnectProvider).toHaveBeenCalledWith(
        "test-agent",
        expect.objectContaining({
          provider: "test-sub",
          apiKey: VALID_TOKEN,
          authType: "subscription",
        }),
      );
    });
    expect(toast.success).toHaveBeenCalledWith("TestSub connected");
    expect(onUpdate).toHaveBeenCalled();
  });

  it("disconnects a connected subscription provider from the detail view", async () => {
    render(() => (
      <ProviderSelectModal
        providers={[connectedSub]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
        providerDeepLink={{ providerId: "test-sub", authType: "subscription" }}
      />
    ));
    fireEvent.click(screen.getByLabelText("Disconnect provider"));

    await waitFor(() => {
      expect(mockDisconnectProvider).toHaveBeenCalledWith(
        "test-agent",
        "test-sub",
        "subscription",
        undefined,
      );
    });
    expect(onUpdate).toHaveBeenCalled();
  });

  it("shows disconnect notifications as error toasts", async () => {
    mockDisconnectProvider.mockResolvedValue({
      notifications: ["Model X is no longer available."],
    });
    render(() => (
      <ProviderSelectModal
        providers={[connectedSub]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
        providerDeepLink={{ providerId: "test-sub", authType: "subscription" }}
      />
    ));
    fireEvent.click(screen.getByLabelText("Disconnect provider"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Model X is no longer available.");
    });
  });

  it("handles connect error gracefully without calling onUpdate", async () => {
    mockConnectProvider.mockRejectedValue(new Error("Network error"));
    render(() => (
      <ProviderSelectModal
        providers={[]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
        providerDeepLink={{ providerId: "test-sub", authType: "subscription" }}
      />
    ));
    fireEvent.input(screen.getByLabelText("TestSub setup token"), {
      target: { value: VALID_TOKEN },
    });
    fireEvent.click(screen.getByText("Connect"));

    await waitFor(() => {
      expect(mockConnectProvider).toHaveBeenCalled();
    });
    // Should not throw, should not call onUpdate
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("shows the connected-via subscription label when already connected", () => {
    render(() => (
      <ProviderSelectModal
        providers={[connectedSub]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
        providerDeepLink={{ providerId: "test-sub", authType: "subscription" }}
      />
    ));
    // A connected subscription shows the masked token + Disconnect affordance.
    expect(screen.getByLabelText("Current setup token (masked)")).toBeDefined();
    expect(screen.getByLabelText("Disconnect provider")).toBeDefined();
  });
});
