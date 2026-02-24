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

import ProviderSelectModal from "../../src/components/ProviderSelectModal";
import { toast } from "../../src/services/toast-store.js";
import type { RoutingProvider } from "../../src/services/api.js";

const connectedProvider: RoutingProvider = {
  id: "p1",
  provider: "openai",
  is_active: true,
  has_api_key: true,
  connected_at: "2025-01-01",
};

const disconnectedProvider: RoutingProvider = {
  id: "p2",
  provider: "anthropic",
  is_active: false,
  has_api_key: false,
  connected_at: "2025-01-01",
};

describe("ProviderSelectModal", () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onClose = vi.fn();
    onUpdate = vi.fn();
    mockConnectProvider.mockResolvedValue({});
    mockDisconnectProvider.mockResolvedValue({ notifications: [] });
  });

  it("renders modal with title", () => {
    render(() => (
      <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
    ));
    expect(screen.getByText("Connect providers")).toBeDefined();
  });

  it("renders subtitle description", () => {
    render(() => (
      <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
    ));
    expect(screen.getByText("Add your API keys to enable routing through each provider")).toBeDefined();
  });

  it("renders all provider names from the PROVIDERS list", () => {
    render(() => (
      <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
    ));
    expect(screen.getByText("OpenAI")).toBeDefined();
    expect(screen.getByText("Anthropic")).toBeDefined();
    expect(screen.getByText("Gemini")).toBeDefined();
    expect(screen.getByText("DeepSeek")).toBeDefined();
  });

  it("shows 'Connected' badge for active providers with API keys", () => {
    render(() => (
      <ProviderSelectModal
        providers={[connectedProvider]}
        onClose={onClose}
        onUpdate={onUpdate}
      />
    ));
    const badges = screen.getAllByText("Connected");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'Not connected' badge for inactive providers", () => {
    render(() => (
      <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
    ));
    const notConnected = screen.getAllByText("Not connected");
    expect(notConnected.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onClose when Done button is clicked", () => {
    render(() => (
      <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
    ));
    fireEvent.click(screen.getByText("Done"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when close button is clicked", () => {
    render(() => (
      <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
    ));
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when clicking overlay background", () => {
    const { container } = render(() => (
      <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
    ));
    const overlay = container.querySelector(".modal-overlay")!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not close when clicking inside the modal card", () => {
    const { container } = render(() => (
      <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
    ));
    const card = container.querySelector(".modal-card")!;
    fireEvent.click(card);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    const { container } = render(() => (
      <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
    ));
    const overlay = container.querySelector(".modal-overlay")!;
    fireEvent.keyDown(overlay, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  describe("expanding a provider", () => {
    it("shows API key input when provider row is clicked", async () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      expect(screen.getByLabelText("OpenAI API key")).toBeDefined();
    });

    it("collapses when same provider is clicked again", async () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      expect(screen.getByLabelText("OpenAI API key")).toBeDefined();

      fireEvent.click(screen.getByText("OpenAI"));
      expect(screen.queryByLabelText("OpenAI API key")).toBeNull();
    });

    it("shows Disconnect button for connected providers", () => {
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
        />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      expect(screen.getByText("Disconnect")).toBeDefined();
    });

    it("shows 'Update key' button for connected non-ollama providers", () => {
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
        />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      expect(screen.getByText("Update key")).toBeDefined();
    });

    it("shows 'Connect' button for non-connected providers", () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
        />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      expect(screen.getByText("Connect")).toBeDefined();
    });
  });

  describe("connecting a provider", () => {
    it("connects a provider when API key is entered and Connect clicked", async () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      const input = screen.getByLabelText("OpenAI API key");
      fireEvent.input(input, { target: { value: "sk-test-123" } });
      fireEvent.click(screen.getByText("Connect"));

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalledWith({
          provider: "openai",
          apiKey: "sk-test-123",
        });
      });
      expect(onUpdate).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("openai connected");
    });

    it("does not connect when API key is empty", () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
      ));
      fireEvent.click(screen.getByText("OpenAI"));

      const connectBtn = screen.getByText("Connect");
      expect(connectBtn.hasAttribute("disabled")).toBe(true);
    });

    it("connects on Enter key in API key input", async () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      const input = screen.getByLabelText("OpenAI API key");
      fireEvent.input(input, { target: { value: "sk-test" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalled();
      });
    });
  });

  describe("Ollama provider", () => {
    it("shows 'No API key required' for Ollama", () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
      ));
      fireEvent.click(screen.getByText("Ollama"));
      expect(screen.getByText("No API key required for local models")).toBeDefined();
    });

    it("connects Ollama without API key", async () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
      ));
      fireEvent.click(screen.getByText("Ollama"));
      fireEvent.click(screen.getByText("Connect"));

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalledWith({
          provider: "ollama",
          apiKey: undefined,
        });
      });
    });
  });

  describe("disconnecting a provider", () => {
    it("calls disconnectProvider and triggers onUpdate", async () => {
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
        />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      fireEvent.click(screen.getByText("Disconnect"));

      await waitFor(() => {
        expect(mockDisconnectProvider).toHaveBeenCalledWith("openai");
      });
      expect(onUpdate).toHaveBeenCalled();
    });

    it("shows error toasts for disconnect notifications", async () => {
      mockDisconnectProvider.mockResolvedValue({
        notifications: ["Model X no longer available. Simple is back to automatic mode."],
      });

      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
        />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      fireEvent.click(screen.getByText("Disconnect"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Model X no longer available. Simple is back to automatic mode.",
        );
      });
    });

    it("handles disconnect error gracefully", async () => {
      mockDisconnectProvider.mockRejectedValue(new Error("Network error"));

      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
        />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      fireEvent.click(screen.getByText("Disconnect"));

      // Should not throw, busy state should reset
      await waitFor(() => {
        expect(mockDisconnectProvider).toHaveBeenCalled();
      });
    });
  });

  describe("connect error handling", () => {
    it("handles connect error gracefully", async () => {
      mockConnectProvider.mockRejectedValue(new Error("Failed"));

      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      const input = screen.getByLabelText("OpenAI API key");
      fireEvent.input(input, { target: { value: "sk-bad" } });
      fireEvent.click(screen.getByText("Connect"));

      // Should not throw
      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalled();
      });
    });
  });
});
