import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";

const mockConnectProvider = vi.fn();
const mockDisconnectProvider = vi.fn();
const mockGetOpenaiOAuthUrl = vi.fn();

vi.mock("../../src/services/api.js", () => ({
  connectProvider: (...args: unknown[]) => mockConnectProvider(...args),
  disconnectProvider: (...args: unknown[]) => mockDisconnectProvider(...args),
  getOpenaiOAuthUrl: (...args: unknown[]) => mockGetOpenaiOAuthUrl(...args),
  revokeOpenaiOAuth: () => Promise.resolve({ ok: true }),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../src/components/ProviderIcon.js", () => ({
  providerIcon: () => null,
}));

vi.mock("../../src/services/local-mode.js", () => ({
  isLocalMode: () => false,
  checkLocalMode: () => Promise.resolve(false),
}));

// Mock providers to include a subscription provider WITHOUT subscriptionKeyPlaceholder
// so handleSubscriptionToggle is exercised (the toggle path, not the detail-view path).
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
    // No subscriptionKeyPlaceholder → toggle path
  };
  return {
    PROVIDERS: [testProvider],
    validateApiKey: () => ({ valid: true }),
    validateSubscriptionKey: () => ({ valid: true }),
  };
});

import ProviderSelectModal from "../../src/components/ProviderSelectModal";
import { toast } from "../../src/services/toast-store.js";
import type { RoutingProvider } from "../../src/services/api.js";

describe("ProviderSelectModal — subscription toggle (no subscriptionKeyPlaceholder)", () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onClose = vi.fn();
    onUpdate = vi.fn();
    mockConnectProvider.mockResolvedValue({});
    mockDisconnectProvider.mockResolvedValue({ notifications: [] });
  });

  it("connects a subscription provider via toggle when not connected", async () => {
    render(() => (
      <ProviderSelectModal
        providers={[]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
      />
    ));
    // On subscription tab (default), click the TestSub provider toggle
    fireEvent.click(screen.getByText("TestSub"));

    await waitFor(() => {
      expect(mockConnectProvider).toHaveBeenCalledWith("test-agent", {
        provider: "test-sub",
        authType: "subscription",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("TestSub subscription connected");
    expect(onUpdate).toHaveBeenCalled();
  });

  it("disconnects a subscription provider via toggle when already connected", async () => {
    const subProvider: RoutingProvider = {
      id: "p-sub",
      provider: "test-sub",
      is_active: true,
      has_api_key: false,
      connected_at: "2025-01-01",
      auth_type: "subscription",
    };
    render(() => (
      <ProviderSelectModal
        providers={[subProvider]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
      />
    ));
    // On subscription tab, the toggle is ON → click disconnects
    fireEvent.click(screen.getByText("TestSub"));

    await waitFor(() => {
      expect(mockDisconnectProvider).toHaveBeenCalledWith("test-agent", "test-sub", "subscription");
    });
    expect(toast.success).toHaveBeenCalledWith("TestSub subscription disconnected");
    expect(onUpdate).toHaveBeenCalled();
  });

  it("shows disconnect notifications as error toasts", async () => {
    mockDisconnectProvider.mockResolvedValue({
      notifications: ["Model X is no longer available."],
    });
    const subProvider: RoutingProvider = {
      id: "p-sub",
      provider: "test-sub",
      is_active: true,
      has_api_key: false,
      connected_at: "2025-01-01",
      auth_type: "subscription",
    };
    render(() => (
      <ProviderSelectModal
        providers={[subProvider]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
      />
    ));
    fireEvent.click(screen.getByText("TestSub"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Model X is no longer available.");
    });
  });

  it("handles toggle error gracefully", async () => {
    mockConnectProvider.mockRejectedValue(new Error("Network error"));
    render(() => (
      <ProviderSelectModal
        providers={[]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
      />
    ));
    fireEvent.click(screen.getByText("TestSub"));

    await waitFor(() => {
      expect(mockConnectProvider).toHaveBeenCalled();
    });
    // Should not throw, should not call onUpdate
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("shows isSubscriptionConnected toggle as ON when provider is active", () => {
    const subProvider: RoutingProvider = {
      id: "p-sub",
      provider: "test-sub",
      is_active: true,
      has_api_key: false,
      connected_at: "2025-01-01",
      auth_type: "subscription",
    };
    const { container } = render(() => (
      <ProviderSelectModal
        providers={[subProvider]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
      />
    ));
    // For a provider without subscriptionKeyPlaceholder, connected() uses isSubscriptionConnected
    // which only checks is_active (not has_api_key)
    const onSwitches = container.querySelectorAll(".provider-toggle__switch--on");
    expect(onSwitches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders 'Subscription' as default label when no subscriptionLabel set", () => {
    const { container } = render(() => (
      <ProviderSelectModal
        providers={[]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
      />
    ));
    // TestSub provider has no subscriptionLabel, so the fallback 'Subscription' is used
    // Check within the provider toggle's local-only span (not the tab label)
    const localOnlyLabels = container.querySelectorAll(".provider-toggle__local-only");
    const hasSubscriptionLabel = Array.from(localOnlyLabels).some(
      (el) => el.textContent === "Subscription",
    );
    expect(hasSubscriptionLabel).toBe(true);
  });
});
