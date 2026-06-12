import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";

// NOTE (post-#2207 realignment):
// ProviderSelectModal no longer renders a provider list/tabs; it opens straight
// into a provider's detail view via `providerDeepLink` (exactly how
// ProviderConnectionsPage drives it in production). These tests previously
// reached OpenCode Go's detail view by clicking it in the subscription list;
// they now pass the deep link instead. The detail-view assertions (sign-in
// link, beta hint, token paste field, connect, disconnect) are unchanged.

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
  providerIcon: () => null,
  customProviderLogo: () => null,
}));

// Only mock opencode-go so the detail view renders a single known provider.
vi.mock("../../src/services/providers.js", () => {
  const opencodeGoProvider = {
    id: "opencode-go",
    name: "OpenCode Go",
    color: "#7C3AED",
    initial: "OG",
    subtitle: "GLM, Kimi, MiMo, MiniMax",
    keyPrefix: "",
    minKeyLength: 20,
    keyPlaceholder: "",
    models: [{ label: "GLM-5.1", value: "opencode-go/glm-5.1" }],
    supportsSubscription: true,
    subscriptionOnly: true,
    subscriptionLabel: "OpenCode Go (beta)",
    subscriptionAuthMode: "token",
    subscriptionKeyPlaceholder: "Paste your OpenCode API key",
    subscriptionCredentialKind: "api-key",
    subscriptionSignInUrl: "https://opencode.ai/auth",
    subscriptionSignInLabel: "Sign in to OpenCode Go",
    subscriptionSignInHint:
      "Sign in to OpenCode Go, copy your API key, then paste it below. OpenCode Go is currently in beta.",
  };
  return {
    PROVIDERS: [opencodeGoProvider],
    validateApiKey: () => ({ valid: true }),
    validateSubscriptionKey: (_p: unknown, key: string) =>
      key.length >= 10 ? { valid: true } : { valid: false, error: "Token is too short" },
  };
});

// The detail view validates pasted tokens via provider-utils, not the
// providers module — mock both so the real validator isn't pulled in.
vi.mock("../../src/services/provider-utils.js", () => ({
  validateApiKey: () => ({ valid: true }),
  validateSubscriptionKey: (_p: unknown, key: string) =>
    key.length >= 10 ? { valid: true } : { valid: false, error: "Token is too short" },
}));

import ProviderSelectModal from "../../src/components/ProviderSelectModal";
import type { RoutingProvider } from "../../src/services/api.js";

describe("OpenCode Go subscription detail view", () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onClose = vi.fn();
    onUpdate = vi.fn();
    mockConnectProvider.mockResolvedValue({});
    mockDisconnectProvider.mockResolvedValue({ notifications: [] });
  });

  const openDetailView = () => {
    render(() => (
      <ProviderSelectModal
        providers={[]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
        providerDeepLink={{ providerId: "opencode-go", authType: "subscription" }}
      />
    ));
  };

  it("opens the sign-in URL in a new tab", () => {
    openDetailView();

    const signInLink = screen.getByRole("link", {
      name: /Sign in to OpenCode Go/i,
    }) as HTMLAnchorElement;
    expect(signInLink.getAttribute("href")).toBe("https://opencode.ai/auth");
    expect(signInLink.getAttribute("target")).toBe("_blank");
    expect(signInLink.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("shows the beta hint and never says Zen", () => {
    openDetailView();

    const hint = screen.getByText(
      /Sign in to OpenCode Go, copy your API key.*beta/i,
    );
    expect(hint.textContent).not.toMatch(/Zen/i);
  });

  it("shows a token paste field, not a terminal command block", () => {
    openDetailView();

    const input = screen.getByPlaceholderText("Paste your OpenCode API key");
    expect(input.tagName).toBe("INPUT");
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it("saves a pasted token as a subscription connection", async () => {
    openDetailView();

    const input = screen.getByPlaceholderText(
      "Paste your OpenCode API key",
    ) as HTMLInputElement;
    fireEvent.input(input, { target: { value: "a-valid-opencode-token" } });
    fireEvent.click(screen.getByText("Connect"));

    await waitFor(() => {
      expect(mockConnectProvider).toHaveBeenCalledWith(
        "test-agent",
        expect.objectContaining({
          provider: "opencode-go",
          apiKey: "a-valid-opencode-token",
          authType: "subscription",
        }),
      );
    });
  });

  it("disconnects when the trash icon is clicked", async () => {
    const connected: RoutingProvider = {
      id: "p-og",
      provider: "opencode-go",
      is_active: true,
      has_api_key: true,
      connected_at: "2026-04-10",
      auth_type: "subscription",
    };
    render(() => (
      <ProviderSelectModal
        providers={[connected]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
        providerDeepLink={{ providerId: "opencode-go", authType: "subscription" }}
      />
    ));

    fireEvent.click(screen.getByLabelText("Disconnect provider"));

    await waitFor(() => {
      expect(mockDisconnectProvider).toHaveBeenCalledWith(
        "test-agent",
        "opencode-go",
        "subscription",
        undefined,
      );
    });
    expect(onUpdate).toHaveBeenCalled();
  });
});
