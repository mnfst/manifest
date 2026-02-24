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
  key_prefix: "sk-proj-",
  connected_at: "2025-01-01",
};

const disconnectedProvider: RoutingProvider = {
  id: "p2",
  provider: "anthropic",
  is_active: false,
  has_api_key: false,
  connected_at: "2025-01-01",
};

// Valid key that passes OpenAI validation (prefix "sk-", min 50 chars)
const VALID_OPENAI_KEY = "sk-" + "a".repeat(50);
// Valid key that passes Anthropic validation (prefix "sk-ant-", min 50 chars)
const VALID_ANTHROPIC_KEY = "sk-ant-" + "a".repeat(50);

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

  describe("detail view navigation", () => {
    it("shows API key input when provider row is clicked", async () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      expect(screen.getByLabelText("OpenAI API key")).toBeDefined();
    });

    it("returns to list view when back button is clicked", async () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      expect(screen.getByLabelText("OpenAI API key")).toBeDefined();

      fireEvent.click(screen.getByLabelText("Back to providers"));
      expect(screen.queryByLabelText("OpenAI API key")).toBeNull();
      // List view is back
      expect(screen.getByText("Done")).toBeDefined();
    });

    it("shows disconnect icon for connected providers", () => {
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
        />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      expect(screen.getByLabelText("Disconnect provider")).toBeDefined();
    });

    it("shows 'Change' button for connected non-ollama providers", () => {
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
        />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      expect(screen.getByText("Change")).toBeDefined();
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

    it("shows masked key prefix for connected providers", () => {
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
        />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      expect(screen.getByLabelText("Current API key (masked)")).toBeDefined();
    });
  });

  describe("connecting a provider", () => {
    it("connects a provider when valid API key is entered and Connect clicked", async () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      const input = screen.getByLabelText("OpenAI API key");
      fireEvent.input(input, { target: { value: VALID_OPENAI_KEY } });
      fireEvent.click(screen.getByText("Connect"));

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalledWith({
          provider: "openai",
          apiKey: VALID_OPENAI_KEY,
        });
      });
      expect(onUpdate).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("OpenAI connected");
    });

    it("does not connect when API key is empty", () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
      ));
      fireEvent.click(screen.getByText("OpenAI"));

      const connectBtn = screen.getByText("Connect");
      expect(connectBtn.hasAttribute("disabled")).toBe(true);
    });

    it("shows validation error for invalid key prefix", async () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      const input = screen.getByLabelText("OpenAI API key");
      fireEvent.input(input, { target: { value: "invalid-key-prefix-12345678901234567890123456789012345" } });
      fireEvent.click(screen.getByText("Connect"));

      expect(screen.getByText('OpenAI keys start with "sk-"')).toBeDefined();
      expect(mockConnectProvider).not.toHaveBeenCalled();
    });

    it("shows validation error for key that is too short", async () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      const input = screen.getByLabelText("OpenAI API key");
      fireEvent.input(input, { target: { value: "sk-short" } });
      fireEvent.click(screen.getByText("Connect"));

      expect(screen.getByText("Key is too short (minimum 50 characters)")).toBeDefined();
      expect(mockConnectProvider).not.toHaveBeenCalled();
    });

    it("clears validation error on input change", async () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      const input = screen.getByLabelText("OpenAI API key");
      fireEvent.input(input, { target: { value: "bad" } });
      fireEvent.click(screen.getByText("Connect"));

      expect(screen.getByText('OpenAI keys start with "sk-"')).toBeDefined();

      // Typing clears the error
      fireEvent.input(input, { target: { value: "sk-" } });
      expect(screen.queryByText('OpenAI keys start with "sk-"')).toBeNull();
    });

    it("connects on Enter key in API key input", async () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      const input = screen.getByLabelText("OpenAI API key");
      fireEvent.input(input, { target: { value: VALID_OPENAI_KEY } });
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
      fireEvent.click(screen.getByLabelText("Disconnect provider"));

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
      fireEvent.click(screen.getByLabelText("Disconnect provider"));

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
      fireEvent.click(screen.getByLabelText("Disconnect provider"));

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
      fireEvent.input(input, { target: { value: VALID_OPENAI_KEY } });
      fireEvent.click(screen.getByText("Connect"));

      // Should not throw
      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalled();
      });
    });
  });

  describe("updating a key", () => {
    it("switches to edit mode when Change is clicked", () => {
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
        />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      fireEvent.click(screen.getByText("Change"));

      // Edit mode shows a password input and Save button
      expect(screen.getByLabelText("New OpenAI API key")).toBeDefined();
      expect(screen.getByText("Save")).toBeDefined();
    });

    it("saves updated key", async () => {
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
        />
      ));
      fireEvent.click(screen.getByText("OpenAI"));
      fireEvent.click(screen.getByText("Change"));

      const input = screen.getByLabelText("New OpenAI API key");
      fireEvent.input(input, { target: { value: VALID_OPENAI_KEY } });
      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalledWith({
          provider: "openai",
          apiKey: VALID_OPENAI_KEY,
        });
      });
      expect(toast.success).toHaveBeenCalledWith("OpenAI key updated");
    });
  });
});
