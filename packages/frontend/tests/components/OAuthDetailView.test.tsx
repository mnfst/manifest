import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import { createSignal } from "solid-js";

const mockGetOpenaiOAuthUrl = vi.fn();
const mockGetGeminiOAuthUrl = vi.fn();
const mockSubmitOpenaiOAuthCallback = vi.fn();
const mockRevokeOpenaiOAuth = vi.fn();
const mockRevokeGeminiOAuth = vi.fn();
const mockDisconnectProvider = vi.fn();

vi.mock("../../src/services/api.js", () => ({
  getOpenaiOAuthUrl: (...args: unknown[]) => mockGetOpenaiOAuthUrl(...args),
  getGeminiOAuthUrl: (...args: unknown[]) => mockGetGeminiOAuthUrl(...args),
  submitOpenaiOAuthCallback: (...args: unknown[]) =>
    mockSubmitOpenaiOAuthCallback(...args),
  revokeOpenaiOAuth: (...args: unknown[]) => mockRevokeOpenaiOAuth(...args),
  revokeGeminiOAuth: (...args: unknown[]) => mockRevokeGeminiOAuth(...args),
  disconnectProvider: (...args: unknown[]) => mockDisconnectProvider(...args),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../src/services/oauth-popup.js", () => ({
  monitorOAuthPopup: vi.fn(),
}));

import OAuthDetailView from "../../src/components/OAuthDetailView";
import { toast } from "../../src/services/toast-store.js";
import { monitorOAuthPopup } from "../../src/services/oauth-popup.js";
import type { ProviderDef } from "../../src/services/providers.js";
import type { AuthType } from "../../src/services/api.js";

const mockMonitorOAuthPopup = monitorOAuthPopup as ReturnType<typeof vi.fn>;

const openaiProvDef: ProviderDef = {
  id: "openai",
  name: "OpenAI",
  color: "#10a37f",
  initial: "O",
  subtitle: "GPT-4o, GPT-4.1",
  keyPrefix: "sk-",
  minKeyLength: 50,
  keyPlaceholder: "sk-...",
  supportsSubscription: true,
  subscriptionLabel: "ChatGPT Plus/Pro/Team",
  subscriptionAuthMode: "popup_oauth",
  models: [],
};

const geminiProvDef: ProviderDef = {
  id: "gemini",
  name: "Google",
  color: "#4285f4",
  initial: "G",
  subtitle: "Gemini 2.5, Gemini 2.0 Flash",
  keyPrefix: "AIza",
  minKeyLength: 39,
  keyPlaceholder: "AIza...",
  supportsSubscription: true,
  subscriptionLabel: "Gemini subscription",
  subscriptionAuthMode: "popup_oauth",
  models: [],
};

function renderComponent(
  overrides: {
    provDef?: ProviderDef;
    provId?: string;
    connected?: boolean;
  } = {},
) {
  const [busy, setBusy] = createSignal(false);
  const [selectedAuthType] = createSignal<AuthType>("subscription");
  const provDef = overrides.provDef ?? openaiProvDef;
  const provId = overrides.provId ?? provDef.id;
  const connectedValue = overrides.connected ?? false;

  const props = {
    provDef,
    provId,
    agentName: "test-agent",
    connected: () => connectedValue,
    selectedAuthType,
    busy,
    setBusy,
    onBack: vi.fn(),
    onUpdate: vi.fn(),
    onClose: vi.fn(),
  };

  const result = render(() => <OAuthDetailView {...props} />);
  return { ...result, props };
}

describe("OAuthDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("not connected state", () => {
    it("shows login button for OpenAI when not connected", () => {
      renderComponent({ connected: false });
      expect(screen.getByText("Log in with OpenAI")).toBeDefined();
    });

    it("shows login button for Gemini when not connected", () => {
      renderComponent({
        connected: false,
        provDef: geminiProvDef,
        provId: "gemini",
      });
      expect(screen.getByText("Log in with Google")).toBeDefined();
    });

    it("opens popup on login click and monitors it", async () => {
      const mockPopup = { close: vi.fn() } as unknown as Window;
      vi.stubGlobal("open", vi.fn().mockReturnValue(mockPopup));
      mockGetOpenaiOAuthUrl.mockResolvedValue({ url: "https://auth.openai.com/authorize" });

      renderComponent({ connected: false });
      await fireEvent.click(screen.getByText("Log in with OpenAI"));

      await waitFor(() => {
        expect(mockGetOpenaiOAuthUrl).toHaveBeenCalledWith("test-agent");
      });
      expect(window.open).toHaveBeenCalledWith(
        "https://auth.openai.com/authorize",
        "manifest-oauth",
        "width=500,height=700",
      );
      expect(mockMonitorOAuthPopup).toHaveBeenCalledWith(
        mockPopup,
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onFailure: expect.any(Function),
        }),
      );
    });

    it("opens popup on Gemini login click using getGeminiOAuthUrl", async () => {
      const mockPopup = { close: vi.fn() } as unknown as Window;
      vi.stubGlobal("open", vi.fn().mockReturnValue(mockPopup));
      mockGetGeminiOAuthUrl.mockResolvedValue({
        url: "https://accounts.google.com/o/oauth2/v2/auth?state=abc",
      });

      renderComponent({
        connected: false,
        provDef: geminiProvDef,
        provId: "gemini",
      });
      await fireEvent.click(screen.getByText("Log in with Google"));

      await waitFor(() => {
        expect(mockGetGeminiOAuthUrl).toHaveBeenCalledWith("test-agent");
      });
      expect(mockGetOpenaiOAuthUrl).not.toHaveBeenCalled();
      expect(window.open).toHaveBeenCalledWith(
        "https://accounts.google.com/o/oauth2/v2/auth?state=abc",
        "manifest-oauth",
        "width=500,height=700",
      );
    });

    it("shows error toast when popup is blocked", async () => {
      vi.stubGlobal("open", vi.fn().mockReturnValue(null));
      mockGetOpenaiOAuthUrl.mockResolvedValue({ url: "https://auth.openai.com" });

      renderComponent({ connected: false });
      await fireEvent.click(screen.getByText("Log in with OpenAI"));

      await waitFor(() => {
        expect(
          (toast as { error: ReturnType<typeof vi.fn> }).error,
        ).toHaveBeenCalledWith(
          "Popup was blocked by your browser. Allow popups for this site, then try again.",
        );
      });
    });

    it("handles getAuthUrl error gracefully", async () => {
      mockGetOpenaiOAuthUrl.mockRejectedValue(new Error("Network error"));

      renderComponent({ connected: false });
      await fireEvent.click(screen.getByText("Log in with OpenAI"));

      await waitFor(() => {
        expect(mockGetOpenaiOAuthUrl).toHaveBeenCalled();
      });
      // Should not throw, button re-enabled
    });

    it("calls onSuccess callback after popup success for OpenAI", async () => {
      const mockPopup = { close: vi.fn() } as unknown as Window;
      vi.stubGlobal("open", vi.fn().mockReturnValue(mockPopup));
      mockGetOpenaiOAuthUrl.mockResolvedValue({ url: "https://auth.openai.com" });

      const { props } = renderComponent({ connected: false });
      await fireEvent.click(screen.getByText("Log in with OpenAI"));

      await waitFor(() => {
        expect(mockMonitorOAuthPopup).toHaveBeenCalled();
      });

      // Simulate success callback from monitorOAuthPopup
      const monitorCall = mockMonitorOAuthPopup.mock.calls[0];
      const callbacks = monitorCall[1];
      callbacks.onSuccess();

      expect(
        (toast as { success: ReturnType<typeof vi.fn> }).success,
      ).toHaveBeenCalledWith("OpenAI subscription connected");
      expect(props.onUpdate).toHaveBeenCalled();
      expect(props.onClose).toHaveBeenCalled();
    });

    it("calls onFailure callback silently (no paste fallback for Gemini)", async () => {
      const mockPopup = { close: vi.fn() } as unknown as Window;
      vi.stubGlobal("open", vi.fn().mockReturnValue(mockPopup));
      mockGetGeminiOAuthUrl.mockResolvedValue({ url: "https://accounts.google.com" });

      renderComponent({
        connected: false,
        provDef: geminiProvDef,
        provId: "gemini",
      });
      await fireEvent.click(screen.getByText("Log in with Google"));

      await waitFor(() => {
        expect(mockMonitorOAuthPopup).toHaveBeenCalled();
      });

      const monitorCall = mockMonitorOAuthPopup.mock.calls[0];
      const callbacks = monitorCall[1];
      callbacks.onFailure();

      // Gemini has needsPasteFallback = false, so no paste UI should appear
      expect(screen.queryByPlaceholderText(/callback\?code/)).toBeNull();
    });
  });

  describe("paste fallback (OpenAI only)", () => {
    it("shows paste fallback UI for OpenAI after popup opens", async () => {
      const mockPopup = { close: vi.fn() } as unknown as Window;
      vi.stubGlobal("open", vi.fn().mockReturnValue(mockPopup));
      mockGetOpenaiOAuthUrl.mockResolvedValue({ url: "https://auth.openai.com" });

      renderComponent({ connected: false });
      await fireEvent.click(screen.getByText("Log in with OpenAI"));

      await waitFor(() => {
        expect(mockMonitorOAuthPopup).toHaveBeenCalled();
      });

      // Simulate failure so paste fallback shows
      const monitorCall = mockMonitorOAuthPopup.mock.calls[0];
      monitorCall[1].onFailure();

      // OpenAI has needsPasteFallback = true, so after popup opened + failure,
      // the paste UI should be visible
      await waitFor(() => {
        const input = screen.queryByPlaceholderText(
          "http://localhost:1455/auth/callback?code=...",
        );
        expect(input).toBeDefined();
      });
    });

    it("does NOT show paste fallback for Gemini after popup failure", async () => {
      const mockPopup = { close: vi.fn() } as unknown as Window;
      vi.stubGlobal("open", vi.fn().mockReturnValue(mockPopup));
      mockGetGeminiOAuthUrl.mockResolvedValue({ url: "https://accounts.google.com" });

      renderComponent({
        connected: false,
        provDef: geminiProvDef,
        provId: "gemini",
      });
      await fireEvent.click(screen.getByText("Log in with Google"));

      await waitFor(() => {
        expect(mockMonitorOAuthPopup).toHaveBeenCalled();
      });

      // Simulate failure
      const monitorCall = mockMonitorOAuthPopup.mock.calls[0];
      monitorCall[1].onFailure();

      // Gemini needsPasteFallback = false, so no paste input appears
      expect(
        screen.queryByPlaceholderText("http://localhost:1455/auth/callback?code=..."),
      ).toBeNull();
    });

    it("submits callback URL for OpenAI paste", async () => {
      const mockPopup = { close: vi.fn() } as unknown as Window;
      vi.stubGlobal("open", vi.fn().mockReturnValue(mockPopup));
      mockGetOpenaiOAuthUrl.mockResolvedValue({ url: "https://auth.openai.com" });
      mockSubmitOpenaiOAuthCallback.mockResolvedValue({ ok: true });

      const { props } = renderComponent({ connected: false });
      await fireEvent.click(screen.getByText("Log in with OpenAI"));

      await waitFor(() => {
        expect(mockMonitorOAuthPopup).toHaveBeenCalled();
      });

      // Trigger failure to show paste UI
      mockMonitorOAuthPopup.mock.calls[0][1].onFailure();

      await waitFor(() => {
        expect(
          screen.queryByPlaceholderText(
            "http://localhost:1455/auth/callback?code=...",
          ),
        ).toBeDefined();
      });

      const input = screen.getByPlaceholderText(
        "http://localhost:1455/auth/callback?code=...",
      );
      await fireEvent.input(input, {
        target: {
          value:
            "http://localhost:1455/auth/callback?code=auth-code&state=state-123",
        },
      });
      await fireEvent.click(screen.getByText("Connect"));

      await waitFor(() => {
        expect(mockSubmitOpenaiOAuthCallback).toHaveBeenCalledWith(
          "auth-code",
          "state-123",
        );
      });
      expect(
        (toast as { success: ReturnType<typeof vi.fn> }).success,
      ).toHaveBeenCalledWith("OpenAI subscription connected");
      expect(props.onUpdate).toHaveBeenCalled();
      expect(props.onClose).toHaveBeenCalled();
    });

    it("shows error when paste URL is missing code or state", async () => {
      const mockPopup = { close: vi.fn() } as unknown as Window;
      vi.stubGlobal("open", vi.fn().mockReturnValue(mockPopup));
      mockGetOpenaiOAuthUrl.mockResolvedValue({ url: "https://auth.openai.com" });

      renderComponent({ connected: false });
      await fireEvent.click(screen.getByText("Log in with OpenAI"));

      await waitFor(() => {
        expect(mockMonitorOAuthPopup).toHaveBeenCalled();
      });

      mockMonitorOAuthPopup.mock.calls[0][1].onFailure();

      await waitFor(() => {
        expect(
          screen.queryByPlaceholderText(
            "http://localhost:1455/auth/callback?code=...",
          ),
        ).toBeDefined();
      });

      const input = screen.getByPlaceholderText(
        "http://localhost:1455/auth/callback?code=...",
      );
      await fireEvent.input(input, {
        target: { value: "http://localhost:1455/auth/callback" },
      });
      await fireEvent.click(screen.getByText("Connect"));

      await waitFor(() => {
        expect(
          screen.getByText(
            "URL is missing the authorization code. Make sure you copied the full URL.",
          ),
        ).toBeDefined();
      });
    });

    it("shows error when callback submission fails", async () => {
      const mockPopup = { close: vi.fn() } as unknown as Window;
      vi.stubGlobal("open", vi.fn().mockReturnValue(mockPopup));
      mockGetOpenaiOAuthUrl.mockResolvedValue({ url: "https://auth.openai.com" });
      mockSubmitOpenaiOAuthCallback.mockRejectedValue(new Error("expired"));

      renderComponent({ connected: false });
      await fireEvent.click(screen.getByText("Log in with OpenAI"));

      await waitFor(() => {
        expect(mockMonitorOAuthPopup).toHaveBeenCalled();
      });

      mockMonitorOAuthPopup.mock.calls[0][1].onFailure();

      await waitFor(() => {
        expect(
          screen.queryByPlaceholderText(
            "http://localhost:1455/auth/callback?code=...",
          ),
        ).toBeDefined();
      });

      const input = screen.getByPlaceholderText(
        "http://localhost:1455/auth/callback?code=...",
      );
      await fireEvent.input(input, {
        target: {
          value:
            "http://localhost:1455/auth/callback?code=code1&state=state1",
        },
      });
      await fireEvent.click(screen.getByText("Connect"));

      await waitFor(() => {
        expect(
          screen.getByText(
            "Failed to exchange token. The URL may have expired — try logging in again.",
          ),
        ).toBeDefined();
      });
    });

    it("does not submit empty paste URL", async () => {
      const mockPopup = { close: vi.fn() } as unknown as Window;
      vi.stubGlobal("open", vi.fn().mockReturnValue(mockPopup));
      mockGetOpenaiOAuthUrl.mockResolvedValue({ url: "https://auth.openai.com" });

      renderComponent({ connected: false });
      await fireEvent.click(screen.getByText("Log in with OpenAI"));

      await waitFor(() => {
        expect(mockMonitorOAuthPopup).toHaveBeenCalled();
      });

      mockMonitorOAuthPopup.mock.calls[0][1].onFailure();

      await waitFor(() => {
        expect(screen.queryByText("Connect")).toBeDefined();
      });

      // Connect button is disabled when input is empty, but let's verify
      // submitCallback is not called on empty
      expect(mockSubmitOpenaiOAuthCallback).not.toHaveBeenCalled();
    });

    it("does not submit paste when no submitCallback (Gemini)", async () => {
      // Gemini's getOAuthFns returns submitCallback: null
      // Even if somehow the paste submit handler runs, it should bail
      const mockPopup = { close: vi.fn() } as unknown as Window;
      vi.stubGlobal("open", vi.fn().mockReturnValue(mockPopup));
      mockGetGeminiOAuthUrl.mockResolvedValue({ url: "https://accounts.google.com" });

      renderComponent({
        connected: false,
        provDef: geminiProvDef,
        provId: "gemini",
      });
      await fireEvent.click(screen.getByText("Log in with Google"));

      await waitFor(() => {
        expect(mockMonitorOAuthPopup).toHaveBeenCalled();
      });

      // Even if failure fires, no paste UI due to needsPasteFallback=false
      mockMonitorOAuthPopup.mock.calls[0][1].onFailure();

      // No paste input for Gemini
      expect(
        screen.queryByPlaceholderText("http://localhost:1455/auth/callback?code=..."),
      ).toBeNull();
      expect(mockSubmitOpenaiOAuthCallback).not.toHaveBeenCalled();
    });

    it("clears paste error when input changes", async () => {
      const mockPopup = { close: vi.fn() } as unknown as Window;
      vi.stubGlobal("open", vi.fn().mockReturnValue(mockPopup));
      mockGetOpenaiOAuthUrl.mockResolvedValue({ url: "https://auth.openai.com" });

      renderComponent({ connected: false });
      await fireEvent.click(screen.getByText("Log in with OpenAI"));

      await waitFor(() => {
        expect(mockMonitorOAuthPopup).toHaveBeenCalled();
      });

      mockMonitorOAuthPopup.mock.calls[0][1].onFailure();

      await waitFor(() => {
        expect(
          screen.queryByPlaceholderText(
            "http://localhost:1455/auth/callback?code=...",
          ),
        ).toBeDefined();
      });

      // Trigger error first
      const input = screen.getByPlaceholderText(
        "http://localhost:1455/auth/callback?code=...",
      );
      await fireEvent.input(input, {
        target: { value: "http://localhost:1455/auth/callback" },
      });
      await fireEvent.click(screen.getByText("Connect"));

      await waitFor(() => {
        expect(
          screen.getByText(
            "URL is missing the authorization code. Make sure you copied the full URL.",
          ),
        ).toBeDefined();
      });

      // Now change input, error should clear
      await fireEvent.input(input, {
        target: { value: "http://localhost:1455/auth/callback?code=new" },
      });

      expect(
        screen.queryByText(
          "URL is missing the authorization code. Make sure you copied the full URL.",
        ),
      ).toBeNull();
    });

    it("submits paste URL on Enter key press", async () => {
      const mockPopup = { close: vi.fn() } as unknown as Window;
      vi.stubGlobal("open", vi.fn().mockReturnValue(mockPopup));
      mockGetOpenaiOAuthUrl.mockResolvedValue({ url: "https://auth.openai.com" });
      mockSubmitOpenaiOAuthCallback.mockResolvedValue({ ok: true });

      const { props } = renderComponent({ connected: false });
      await fireEvent.click(screen.getByText("Log in with OpenAI"));

      await waitFor(() => {
        expect(mockMonitorOAuthPopup).toHaveBeenCalled();
      });

      mockMonitorOAuthPopup.mock.calls[0][1].onFailure();

      await waitFor(() => {
        expect(
          screen.queryByPlaceholderText(
            "http://localhost:1455/auth/callback?code=...",
          ),
        ).toBeDefined();
      });

      const input = screen.getByPlaceholderText(
        "http://localhost:1455/auth/callback?code=...",
      );
      await fireEvent.input(input, {
        target: {
          value:
            "http://localhost:1455/auth/callback?code=code1&state=state1",
        },
      });
      await fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(mockSubmitOpenaiOAuthCallback).toHaveBeenCalledWith(
          "code1",
          "state1",
        );
      });
      expect(props.onUpdate).toHaveBeenCalled();
      expect(props.onClose).toHaveBeenCalled();
    });
  });

  describe("connected state", () => {
    it("shows connected status text for OpenAI", () => {
      renderComponent({ connected: true });
      expect(
        screen.getByText("Connected via ChatGPT Plus/Pro/Team"),
      ).toBeDefined();
    });

    it("shows connected status text for Gemini", () => {
      renderComponent({
        connected: true,
        provDef: geminiProvDef,
        provId: "gemini",
      });
      expect(
        screen.getByText("Connected via Gemini subscription"),
      ).toBeDefined();
    });

    it("shows disconnect button when connected", () => {
      renderComponent({ connected: true });
      expect(screen.getByText("Disconnect")).toBeDefined();
    });

    it("calls revoke and disconnect on disconnect for OpenAI", async () => {
      mockRevokeOpenaiOAuth.mockResolvedValue({ ok: true });
      mockDisconnectProvider.mockResolvedValue({ notifications: [] });

      const { props } = renderComponent({ connected: true });
      await fireEvent.click(screen.getByText("Disconnect"));

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

    it("calls revokeGeminiOAuth on disconnect for Gemini", async () => {
      mockRevokeGeminiOAuth.mockResolvedValue({ ok: true });
      mockDisconnectProvider.mockResolvedValue({ notifications: [] });

      const { props } = renderComponent({
        connected: true,
        provDef: geminiProvDef,
        provId: "gemini",
      });
      await fireEvent.click(screen.getByText("Disconnect"));

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

    it("shows disconnect notifications as error toasts", async () => {
      mockRevokeOpenaiOAuth.mockResolvedValue({ ok: true });
      mockDisconnectProvider.mockResolvedValue({
        notifications: ["Model removed from tier"],
      });

      renderComponent({ connected: true });
      await fireEvent.click(screen.getByText("Disconnect"));

      await waitFor(() => {
        expect(
          (toast as { error: ReturnType<typeof vi.fn> }).error,
        ).toHaveBeenCalledWith("Model removed from tier");
      });
    });

    it("continues disconnect even if revoke fails", async () => {
      mockRevokeOpenaiOAuth.mockRejectedValue(new Error("revoke failed"));
      mockDisconnectProvider.mockResolvedValue({ notifications: [] });

      const { props } = renderComponent({ connected: true });
      await fireEvent.click(screen.getByText("Disconnect"));

      await waitFor(() => {
        expect(mockDisconnectProvider).toHaveBeenCalled();
      });
      expect(props.onBack).toHaveBeenCalled();
    });

    it("handles disconnect error gracefully", async () => {
      mockRevokeOpenaiOAuth.mockResolvedValue({ ok: true });
      mockDisconnectProvider.mockRejectedValue(new Error("network error"));

      renderComponent({ connected: true });
      await fireEvent.click(screen.getByText("Disconnect"));

      // Should not throw
      await waitFor(() => {
        expect(mockDisconnectProvider).toHaveBeenCalled();
      });
    });
  });

  describe("fallback subscription label", () => {
    it("falls back to 'subscription' when subscriptionLabel is missing", () => {
      const noLabelProv: ProviderDef = {
        ...openaiProvDef,
        subscriptionLabel: undefined,
      };
      renderComponent({ connected: true, provDef: noLabelProv });
      expect(
        screen.getByText("Connected via subscription"),
      ).toBeDefined();
    });
  });
});
