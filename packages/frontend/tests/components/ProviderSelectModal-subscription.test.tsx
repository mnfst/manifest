import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";

const mockConnectProvider = vi.fn();
const mockDisconnectProvider = vi.fn();

vi.mock("../../src/services/api.js", () => ({
  connectProvider: (...args: unknown[]) => mockConnectProvider(...args),
  disconnectProvider: (...args: unknown[]) => mockDisconnectProvider(...args),
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

// Mock providers to include subscription providers for different code paths:
// 1. testToggleProvider: supportsSubscription=true, NO subscriptionKeyPlaceholder,
//    NO subscriptionCommand, NO oauthFlow → direct toggle path (handleSubscriptionToggle)
// 2. testCommandProvider: supportsSubscription=true, has subscriptionCommand,
//    NO subscriptionKeyPlaceholder, NO oauthFlow → opens detail view, isToggleSub() path
vi.mock("../../src/services/providers.js", () => {
  const testToggleProvider = {
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
    // No subscriptionKeyPlaceholder, no subscriptionCommand, no oauthFlow → toggle path
  };
  const testCommandProvider = {
    id: "test-cmd",
    name: "TestCmd",
    color: "#222",
    initial: "C",
    subtitle: "Test CLI subscription provider",
    keyPrefix: "",
    minKeyLength: 0,
    keyPlaceholder: "",
    models: [],
    supportsSubscription: true,
    subscriptionCommand: "test-cli auth",
    // No subscriptionKeyPlaceholder, no oauthFlow → isToggleSub() in detail view
  };
  return {
    PROVIDERS: [testToggleProvider, testCommandProvider],
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

  describe("CLI subscription detail view (isToggleSub)", () => {
    it("opens detail view for CLI subscription provider with command", () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      // TestCmd has subscriptionCommand → clicking it calls openDetail
      fireEvent.click(screen.getByText("TestCmd"));

      // Should show the isToggleSub subtitle
      expect(screen.getByText("Authenticate via CLI to enable routing")).toBeDefined();
      // Should show the terminal command
      expect(screen.getByText("test-cli auth")).toBeDefined();
      // Should show "Run the command below to authenticate." (no subscriptionKeyPlaceholder)
      expect(screen.getByText("Run the command below to authenticate.")).toBeDefined();
    });

    it("shows Connect button for not-connected CLI subscription provider", () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("TestCmd"));
      expect(screen.getByText("Connect")).toBeDefined();
    });

    it("connects CLI subscription provider when Connect is clicked", async () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("TestCmd"));
      fireEvent.click(screen.getByText("Connect"));

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalledWith("test-agent", {
          provider: "test-cmd",
          authType: "subscription",
        });
      });
      expect(toast.success).toHaveBeenCalledWith("TestCmd subscription connected");
      expect(onUpdate).toHaveBeenCalled();
    });

    it("handles connect error gracefully for CLI subscription", async () => {
      mockConnectProvider.mockRejectedValue(new Error("Network error"));
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("TestCmd"));
      fireEvent.click(screen.getByText("Connect"));

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalled();
      });
      // Should not throw, onUpdate should not be called
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("shows Disconnect button for connected CLI subscription provider", () => {
      const subProvider: RoutingProvider = {
        id: "p-cmd-sub",
        provider: "test-cmd",
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
      fireEvent.click(screen.getByText("TestCmd"));
      expect(screen.getByText("Disconnect")).toBeDefined();
    });

    it("disconnects CLI subscription provider when Disconnect is clicked", async () => {
      const subProvider: RoutingProvider = {
        id: "p-cmd-sub",
        provider: "test-cmd",
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
      fireEvent.click(screen.getByText("TestCmd"));
      fireEvent.click(screen.getByText("Disconnect"));

      await waitFor(() => {
        expect(mockDisconnectProvider).toHaveBeenCalledWith(
          "test-agent",
          "test-cmd",
          "subscription",
        );
      });
      expect(onUpdate).toHaveBeenCalled();
    });
  });
});
