import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@solidjs/testing-library";

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
  providerIcon: () => null, customProviderLogo: () => null,
}));

vi.mock("../../src/services/oauth-popup.js", () => ({
  monitorOAuthPopup: vi.fn(),
}));

// Mock providers with a device-login provider that has NO detail view
// (no subscriptionKeyPlaceholder, no subscriptionCommand, no subscriptionAuthMode).
// This forces handleSubscriptionToggle to handle the deviceLogin guard (lines 112-115).
vi.mock("../../src/services/providers.js", () => {
  const deviceLoginProvider = {
    id: "dev-login",
    name: "DevLoginProvider",
    color: "#000",
    initial: "D",
    subtitle: "Device login provider without detail view",
    keyPrefix: "",
    minKeyLength: 0,
    keyPlaceholder: "",
    models: [],
    supportsSubscription: true,
    deviceLogin: true,
    // Intentionally no subscriptionKeyPlaceholder, subscriptionCommand,
    // or subscriptionAuthMode so hasDetailView() returns false in
    // ProviderSubscriptionTab and onToggle is called.
  };
  return {
    PROVIDERS: [deviceLoginProvider],
    validateApiKey: () => ({ valid: true }),
    validateSubscriptionKey: () => ({ valid: true }),
  };
});

vi.mock("../../src/components/CopilotDeviceLogin.js", () => ({
  default: (props: any) => (
    <div
      data-testid="copilot-device-login"
      data-agent={props.agentName}
      data-connected={String(props.connected)}
    >
      <button data-testid="copilot-connected" onClick={() => props.onConnected()}>
        Connected
      </button>
      <button data-testid="copilot-disconnected" onClick={() => props.onDisconnected()}>
        Disconnected
      </button>
    </div>
  ),
}));

import ProviderSelectContent from "../../src/components/ProviderSelectContent";

describe("ProviderSelectContent - deviceLogin detail view", () => {
  let onUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onUpdate = vi.fn();
    mockConnectProvider.mockResolvedValue({});
    mockDisconnectProvider.mockResolvedValue({ notifications: [] });
  });

  it("opens the device-login view (not a connect call) for a deviceLogin provider deep link", async () => {
    // The provider list/tile view was removed; a deviceLogin provider is now
    // reached via a deep link. Because the provider has deviceLogin: true,
    // ProviderSelectContent renders the CopilotDeviceLogin view rather than
    // eagerly calling connectProvider.
    const { container } = render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        providerDeepLink={{ providerId: "dev-login", authType: "subscription" }}
        onUpdate={onUpdate}
      />
    ));

    await waitFor(() => {
      expect(container.querySelector('[data-testid="copilot-device-login"]')).not.toBeNull();
    });

    // Opening the device-login view must NOT auto-connect the provider.
    expect(mockConnectProvider).not.toHaveBeenCalled();
  });
});
