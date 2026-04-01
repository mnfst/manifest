/**
 * Focused tests for the revokeOAuthForProvider path in ProviderDetailView.
 *
 * In production, popup_oauth providers always disconnect through OAuthDetailView's
 * own handler. ProviderDetailView.handleDisconnect has a defensive shouldRevokeOAuth()
 * check for safety. This test exercises that path by creating a synthetic provider
 * that has both noKeyRequired (renders Ollama-style disconnect button) and
 * subscriptionAuthMode: 'popup_oauth' (makes shouldRevokeOAuth() return true).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import { createSignal } from "solid-js";

const mockDisconnectProvider = vi.fn();
const mockRevokeOpenaiOAuth = vi.fn();
const mockRevokeGeminiOAuth = vi.fn();

vi.mock("../../src/services/api.js", () => ({
  connectProvider: vi.fn(),
  disconnectProvider: (...args: unknown[]) => mockDisconnectProvider(...args),
  revokeOpenaiOAuth: (...args: unknown[]) => mockRevokeOpenaiOAuth(...args),
  revokeGeminiOAuth: (...args: unknown[]) => mockRevokeGeminiOAuth(...args),
  getOpenaiOAuthUrl: vi.fn(),
  getGeminiOAuthUrl: vi.fn(),
  submitOpenaiOAuthCallback: vi.fn(),
  startMinimaxOAuth: vi.fn(),
  pollMinimaxOAuth: vi.fn(),
  copilotDeviceCode: vi.fn(),
  copilotPollToken: vi.fn(),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../src/components/ProviderIcon.js", () => ({
  providerIcon: () => null,
}));

vi.mock("../../src/services/oauth-popup.js", () => ({
  monitorOAuthPopup: vi.fn(),
}));

// noKeyRequired + subscriptionAuthMode: 'popup_oauth' causes the Ollama-style
// disconnect button to render AND shouldRevokeOAuth() to return true.
vi.mock("../../src/services/providers.js", () => {
  const oauthOpenai = {
    id: "openai",
    name: "OpenAI",
    color: "#10a37f",
    initial: "O",
    subtitle: "GPT-4o",
    keyPrefix: "",
    minKeyLength: 0,
    keyPlaceholder: "",
    noKeyRequired: true,
    supportsSubscription: true,
    subscriptionLabel: "ChatGPT subscription",
    subscriptionAuthMode: "popup_oauth",
    models: [],
  };
  const oauthGemini = {
    id: "gemini",
    name: "Google",
    color: "#4285f4",
    initial: "G",
    subtitle: "Gemini",
    keyPrefix: "",
    minKeyLength: 0,
    keyPlaceholder: "",
    noKeyRequired: true,
    supportsSubscription: true,
    subscriptionLabel: "Gemini subscription",
    subscriptionAuthMode: "popup_oauth",
    models: [],
  };
  const oauthUnknown = {
    id: "future-provider",
    name: "FutureProvider",
    color: "#ccc",
    initial: "F",
    subtitle: "Future",
    keyPrefix: "",
    minKeyLength: 0,
    keyPlaceholder: "",
    noKeyRequired: true,
    supportsSubscription: true,
    subscriptionLabel: "Future subscription",
    subscriptionAuthMode: "popup_oauth",
    models: [],
  };
  return {
    PROVIDERS: [oauthOpenai, oauthGemini, oauthUnknown],
    getProvider: (id: string) =>
      [oauthOpenai, oauthGemini, oauthUnknown].find((p) => p.id === id),
    getModelLabel: (_id: string, model: string) => model,
  };
});

import ProviderDetailView from "../../src/components/ProviderDetailView";
import type { RoutingProvider, AuthType } from "../../src/services/api.js";

function renderComponent(
  provId: string,
  providers: RoutingProvider[] = [],
) {
  const [busy, setBusy] = createSignal(false);
  const [keyInput, setKeyInput] = createSignal("");
  const [editing, setEditing] = createSignal(false);
  const [validationError, setValidationError] = createSignal<string | null>(
    null,
  );
  const [selectedAuthType] = createSignal<AuthType>("subscription");

  const props = {
    provId,
    agentName: "test-agent",
    providers,
    selectedAuthType,
    busy,
    setBusy,
    keyInput,
    setKeyInput,
    editing,
    setEditing,
    validationError,
    setValidationError,
    onBack: vi.fn(),
    onUpdate: vi.fn(),
    onClose: vi.fn(),
  };

  const result = render(() => <ProviderDetailView {...props} />);
  return { ...result, props };
}

describe("ProviderDetailView revokeOAuthForProvider path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDisconnectProvider.mockResolvedValue({ notifications: [] });
  });

  it("calls revokeOpenaiOAuth via handleDisconnect for OpenAI popup_oauth provider", async () => {
    mockRevokeOpenaiOAuth.mockResolvedValue({ ok: true });

    const openaiSub: RoutingProvider = {
      id: "p-1",
      provider: "openai",
      is_active: true,
      has_api_key: false,
      connected_at: "2025-01-01",
      auth_type: "subscription",
    };

    const { props } = renderComponent("openai", [openaiSub]);

    // The noKeyRequired Ollama-style disconnect button should be visible
    const disconnectButtons = screen.getAllByText("Disconnect");
    // Click the Ollama-path disconnect button (the first one outside OAuthDetailView)
    await fireEvent.click(disconnectButtons[disconnectButtons.length - 1]);

    await waitFor(() => {
      expect(mockRevokeOpenaiOAuth).toHaveBeenCalledWith("test-agent");
      expect(mockDisconnectProvider).toHaveBeenCalledWith(
        "test-agent",
        "openai",
        "subscription",
      );
      expect(props.onBack).toHaveBeenCalled();
      expect(props.onUpdate).toHaveBeenCalled();
    });
  });

  it("calls revokeGeminiOAuth via handleDisconnect for Gemini popup_oauth provider", async () => {
    mockRevokeGeminiOAuth.mockResolvedValue({ ok: true });

    const geminiSub: RoutingProvider = {
      id: "p-2",
      provider: "gemini",
      is_active: true,
      has_api_key: false,
      connected_at: "2025-01-01",
      auth_type: "subscription",
    };

    const { props } = renderComponent("gemini", [geminiSub]);

    const disconnectButtons = screen.getAllByText("Disconnect");
    await fireEvent.click(disconnectButtons[disconnectButtons.length - 1]);

    await waitFor(() => {
      expect(mockRevokeGeminiOAuth).toHaveBeenCalledWith("test-agent");
      expect(mockRevokeOpenaiOAuth).not.toHaveBeenCalled();
      expect(mockDisconnectProvider).toHaveBeenCalledWith(
        "test-agent",
        "gemini",
        "subscription",
      );
      expect(props.onBack).toHaveBeenCalled();
      expect(props.onUpdate).toHaveBeenCalled();
    });
  });

  it("logs warning for unknown provider in revokeOAuthForProvider", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const unknownSub: RoutingProvider = {
      id: "p-4",
      provider: "future-provider",
      is_active: true,
      has_api_key: false,
      connected_at: "2025-01-01",
      auth_type: "subscription",
    };

    const { props } = renderComponent("future-provider", [unknownSub]);

    const disconnectButtons = screen.getAllByText("Disconnect");
    await fireEvent.click(disconnectButtons[disconnectButtons.length - 1]);

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        "No OAuth revoke handler for provider: future-provider",
      );
      expect(mockRevokeOpenaiOAuth).not.toHaveBeenCalled();
      expect(mockRevokeGeminiOAuth).not.toHaveBeenCalled();
      expect(mockDisconnectProvider).toHaveBeenCalledWith(
        "test-agent",
        "future-provider",
        "subscription",
      );
      expect(props.onBack).toHaveBeenCalled();
    });

    warnSpy.mockRestore();
  });

  it("continues disconnect when revoke rejects", async () => {
    mockRevokeOpenaiOAuth.mockRejectedValue(new Error("revoke failed"));

    const openaiSub: RoutingProvider = {
      id: "p-3",
      provider: "openai",
      is_active: true,
      has_api_key: false,
      connected_at: "2025-01-01",
      auth_type: "subscription",
    };

    const { props } = renderComponent("openai", [openaiSub]);

    const disconnectButtons = screen.getAllByText("Disconnect");
    await fireEvent.click(disconnectButtons[disconnectButtons.length - 1]);

    await waitFor(() => {
      expect(mockDisconnectProvider).toHaveBeenCalled();
      expect(props.onBack).toHaveBeenCalled();
    });
  });
});
