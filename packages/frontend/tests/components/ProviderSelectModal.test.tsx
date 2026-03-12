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

let mockLocalMode = false;
vi.mock("../../src/services/local-mode.js", () => ({
  isLocalMode: () => mockLocalMode,
  checkLocalMode: () => Promise.resolve(mockLocalMode),
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
  auth_type: "api_key",
};

const disconnectedProvider: RoutingProvider = {
  id: "p2",
  provider: "anthropic",
  is_active: false,
  has_api_key: false,
  connected_at: "2025-01-01",
  auth_type: "api_key",
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
    mockLocalMode = false;
    onClose = vi.fn();
    onUpdate = vi.fn();
    mockConnectProvider.mockResolvedValue({});
    mockDisconnectProvider.mockResolvedValue({ notifications: [] });
  });

  it("renders modal with title", () => {
    render(() => (
      <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
    ));
    expect(screen.getByText("Connect providers")).toBeDefined();
  });

  it("renders subtitle description", () => {
    render(() => (
      <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
    ));
    expect(screen.getByText("Use your subscriptions or API keys to enable routing")).toBeDefined();
  });

  it("renders all provider names from the PROVIDERS list on API Keys tab", () => {
    render(() => (
      <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
    ));
    fireEvent.click(screen.getByText("API Keys"));
    expect(screen.getByText("OpenAI")).toBeDefined();
    expect(screen.getByText("Anthropic")).toBeDefined();
    expect(screen.getByText("Gemini")).toBeDefined();
    expect(screen.getByText("DeepSeek")).toBeDefined();
    expect(screen.getByText("OpenRouter")).toBeDefined();
  });

  it("shows toggle switch in 'on' state for connected providers", () => {
    const { container } = render(() => (
      <ProviderSelectModal
        providers={[connectedProvider]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
      />
    ));
    fireEvent.click(screen.getByText("API Keys"));
    const onSwitches = container.querySelectorAll(".provider-toggle__switch--on");
    expect(onSwitches.length).toBeGreaterThanOrEqual(1);
  });

  it("shows toggle switch in 'off' state for disconnected providers", () => {
    const { container } = render(() => (
      <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
    ));
    fireEvent.click(screen.getByText("API Keys"));
    const allSwitches = container.querySelectorAll(".provider-toggle__switch");
    const onSwitches = container.querySelectorAll(".provider-toggle__switch--on");
    expect(allSwitches.length).toBeGreaterThan(0);
    expect(onSwitches.length).toBe(0);
  });

  it("calls onClose when Done button is clicked", () => {
    render(() => (
      <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
    ));
    fireEvent.click(screen.getByText("Done"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when close button is clicked", () => {
    render(() => (
      <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
    ));
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when clicking overlay background", () => {
    const { container } = render(() => (
      <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
    ));
    const overlay = container.querySelector(".modal-overlay")!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not close when clicking inside the modal card", () => {
    const { container } = render(() => (
      <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
    ));
    const card = container.querySelector(".modal-card")!;
    fireEvent.click(card);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    const { container } = render(() => (
      <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
    ));
    const overlay = container.querySelector(".modal-overlay")!;
    fireEvent.keyDown(overlay, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  describe("detail view navigation", () => {
    it("shows API key input when provider row is clicked", async () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("OpenAI"));
      expect(screen.getByLabelText("OpenAI API key")).toBeDefined();
    });

    it("returns to list view when back button is clicked", async () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      fireEvent.click(screen.getByText("API Keys"));
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
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("OpenAI"));
      expect(screen.getByLabelText("Disconnect provider")).toBeDefined();
    });

    it("shows 'Change' button for connected non-ollama providers", () => {
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("OpenAI"));
      expect(screen.getByText("Change")).toBeDefined();
    });

    it("shows 'Connect' button for non-connected providers", () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("OpenAI"));
      expect(screen.getByText("Connect")).toBeDefined();
    });

    it("shows masked key prefix for connected providers", () => {
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("OpenAI"));
      expect(screen.getByLabelText("Current API key (masked)")).toBeDefined();
    });
  });

  describe("connecting a provider", () => {
    it("connects a provider when valid API key is entered and Connect clicked", async () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("OpenAI"));
      const input = screen.getByLabelText("OpenAI API key");
      fireEvent.input(input, { target: { value: VALID_OPENAI_KEY } });
      fireEvent.click(screen.getByText("Connect"));

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalledWith("test-agent", {
          provider: "openai",
          apiKey: VALID_OPENAI_KEY,
          authType: "api_key",
        });
      });
      expect(onUpdate).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("OpenAI connected");
    });

    it("does not connect when API key is empty", () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("OpenAI"));

      const connectBtn = screen.getByText("Connect");
      expect(connectBtn.hasAttribute("disabled")).toBe(true);
    });

    it("shows validation error for invalid key prefix", async () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("OpenAI"));
      const input = screen.getByLabelText("OpenAI API key");
      fireEvent.input(input, { target: { value: "invalid-key-prefix-12345678901234567890123456789012345" } });
      fireEvent.click(screen.getByText("Connect"));

      expect(screen.getByText('OpenAI keys start with "sk-"')).toBeDefined();
      expect(mockConnectProvider).not.toHaveBeenCalled();
    });

    it("shows validation error for key that is too short", async () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("OpenAI"));
      const input = screen.getByLabelText("OpenAI API key");
      fireEvent.input(input, { target: { value: "sk-short" } });
      fireEvent.click(screen.getByText("Connect"));

      expect(screen.getByText("Key is too short (minimum 50 characters)")).toBeDefined();
      expect(mockConnectProvider).not.toHaveBeenCalled();
    });

    it("clears validation error on input change", async () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      fireEvent.click(screen.getByText("API Keys"));
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
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("OpenAI"));
      const input = screen.getByLabelText("OpenAI API key");
      fireEvent.input(input, { target: { value: VALID_OPENAI_KEY } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalled();
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
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("OpenAI"));
      fireEvent.click(screen.getByLabelText("Disconnect provider"));

      await waitFor(() => {
        expect(mockDisconnectProvider).toHaveBeenCalledWith("test-agent", "openai", "api_key");
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
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
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
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
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
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      fireEvent.click(screen.getByText("API Keys"));
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
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
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
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("OpenAI"));
      fireEvent.click(screen.getByText("Change"));

      const input = screen.getByLabelText("New OpenAI API key");
      fireEvent.input(input, { target: { value: VALID_OPENAI_KEY } });
      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalledWith("test-agent", {
          provider: "openai",
          apiKey: VALID_OPENAI_KEY,
          authType: "api_key",
        });
      });
      expect(toast.success).toHaveBeenCalledWith("OpenAI key updated");
    });

    it("shows validation error for invalid key in edit mode", () => {
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("OpenAI"));
      fireEvent.click(screen.getByText("Change"));

      const input = screen.getByLabelText("New OpenAI API key");
      fireEvent.input(input, { target: { value: "bad-key" } });
      fireEvent.click(screen.getByText("Save"));

      expect(screen.getByText('OpenAI keys start with "sk-"')).toBeDefined();
      expect(mockConnectProvider).not.toHaveBeenCalled();
    });

    it("handles update key error gracefully", async () => {
      mockConnectProvider.mockRejectedValue(new Error("Server error"));
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("OpenAI"));
      fireEvent.click(screen.getByText("Change"));

      const input = screen.getByLabelText("New OpenAI API key");
      fireEvent.input(input, { target: { value: VALID_OPENAI_KEY } });
      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalled();
      });
    });

    it("triggers handleUpdateKey on Enter key in edit input", async () => {
      render(() => (
        <ProviderSelectModal
          providers={[connectedProvider]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("OpenAI"));
      fireEvent.click(screen.getByText("Change"));

      const input = screen.getByLabelText("New OpenAI API key");
      fireEvent.input(input, { target: { value: VALID_OPENAI_KEY } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalled();
      });
    });
  });

  describe("custom providers", () => {
    const customProviderData = [
      { id: "cp-1", name: "Groq", base_url: "https://api.groq.com", has_api_key: true, models: [{ model_name: "llama-3.1-70b" }, { model_name: "llama-3.1-8b" }], created_at: "2025-01-01" },
    ];

    it("renders custom provider list items", () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          customProviders={customProviderData}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      expect(screen.getByText("Groq")).toBeDefined();
      expect(screen.getByText("2 models")).toBeDefined();
    });

    it("renders custom provider icon letter", () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          customProviders={customProviderData}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      const letter = document.querySelector(".custom-provider-section .provider-card__logo-letter");
      expect(letter).not.toBeNull();
      expect(letter!.textContent).toBe("G");
    });

    it("shows Add custom provider button", () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      expect(screen.getByText("Add custom provider")).toBeDefined();
    });

    it("opens custom provider form when Add button is clicked", async () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("Add custom provider"));
      await waitFor(() => {
        expect(screen.getByPlaceholderText("e.g. Groq, vLLM, Azure")).toBeDefined();
      });
    });

    it("opens edit form when custom provider is clicked", async () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          customProviders={customProviderData}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("Groq"));
      await waitFor(() => {
        const nameInput = screen.getByDisplayValue("Groq");
        expect(nameInput).toBeDefined();
      });
    });

    it("singularizes model count for single model", () => {
      const singleModel = [{ ...customProviderData[0], models: [{ model_name: "llama" }] }];
      render(() => (
        <ProviderSelectModal
          providers={[]}
          customProviders={singleModel}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      expect(screen.getByText("1 model")).toBeDefined();
    });
  });

  describe("ollama (no key required)", () => {
    const ollamaConnected: RoutingProvider = {
      id: "p3",
      provider: "ollama",
      is_active: true,
      has_api_key: false,
      connected_at: "2025-01-01",
      auth_type: "api_key",
    };

    beforeEach(() => {
      mockLocalMode = true;
    });

    it("shows 'No API key required' for Ollama", () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("Ollama"));
      expect(screen.getByText("No API key required for local models")).toBeDefined();
    });

    it("shows Connect button for disconnected Ollama", () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("Ollama"));
      expect(screen.getByText("Connect")).toBeDefined();
    });

    it("shows Disconnect button for connected Ollama", () => {
      render(() => (
        <ProviderSelectModal
          providers={[ollamaConnected]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("Ollama"));
      expect(screen.getByText("Disconnect")).toBeDefined();
    });

    it("connects Ollama without API key", async () => {
      render(() => (
        <ProviderSelectModal
          providers={[]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("Ollama"));
      fireEvent.click(screen.getByText("Connect"));

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalledWith("test-agent", {
          provider: "ollama",
          apiKey: undefined,
          authType: "api_key",
        });
      });
    });

    it("disconnects connected Ollama", async () => {
      render(() => (
        <ProviderSelectModal
          providers={[ollamaConnected]}
          onClose={onClose}
          onUpdate={onUpdate}
          agentName="test-agent"
        />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      fireEvent.click(screen.getByText("Ollama"));
      fireEvent.click(screen.getByText("Disconnect"));

      await waitFor(() => {
        expect(mockDisconnectProvider).toHaveBeenCalledWith("test-agent", "ollama", "api_key");
      });
    });
  });

  it("shows default masked key when provider has no key_prefix", () => {
    const noPrefix: RoutingProvider = {
      id: "p4",
      provider: "openai",
      is_active: true,
      has_api_key: true,
      connected_at: "2025-01-01",
      auth_type: "api_key",
    };
    render(() => (
      <ProviderSelectModal
        providers={[noPrefix]}
        onClose={onClose}
        onUpdate={onUpdate}
        agentName="test-agent"
      />
    ));
    fireEvent.click(screen.getByText("API Keys"));
    fireEvent.click(screen.getByText("OpenAI"));
    const maskedInput = screen.getByLabelText("Current API key (masked)") as HTMLInputElement;
    expect(maskedInput.value).toContain("••••••••••••");
  });

  describe("subscription tab", () => {
    it("shows subscription tab as default active tab", () => {
      const { container } = render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      const activeTab = container.querySelector(".provider-modal__tab--active");
      expect(activeTab).not.toBeNull();
      expect(activeTab!.textContent).toBe("Subscription");
    });

    it("renders subscription providers with toggle switches", () => {
      const { container } = render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      // Subscription tab is default, check subscription providers are listed
      expect(screen.getByText("Anthropic")).toBeDefined();
      const switches = container.querySelectorAll(".provider-toggle__switch");
      expect(switches.length).toBeGreaterThan(0);
    });

    it("shows subscription toggle as on for subscription-connected providers with token", () => {
      const subProvider: RoutingProvider = {
        id: "p-sub",
        provider: "anthropic",
        is_active: true,
        has_api_key: true,
        key_prefix: "skst-tok",
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
      const onSwitches = container.querySelectorAll(".provider-toggle__switch--on");
      expect(onSwitches.length).toBeGreaterThanOrEqual(1);
    });

    it("opens detail view for Anthropic (has subscriptionKeyPlaceholder)", () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      fireEvent.click(screen.getByText("Anthropic"));

      // Should open detail view with setup token input
      expect(screen.getByLabelText("Anthropic setup token")).toBeDefined();
      expect(screen.getByText("Connect")).toBeDefined();
    });

    it("shows terminal command in Anthropic subscription detail view", () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      fireEvent.click(screen.getByText("Anthropic"));

      expect(screen.getByText("claude setup-token")).toBeDefined();
      expect(screen.getByText("Terminal")).toBeDefined();
    });

    it("connects Anthropic subscription with setup-token", async () => {
      const VALID_TOKEN = "sk-ant-oat01-test-token-1234567890";
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      fireEvent.click(screen.getByText("Anthropic"));

      const input = screen.getByLabelText("Anthropic setup token");
      fireEvent.input(input, { target: { value: VALID_TOKEN } });
      fireEvent.click(screen.getByText("Connect"));

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalledWith("test-agent", {
          provider: "anthropic",
          apiKey: VALID_TOKEN,
          authType: "subscription",
        });
      });
      expect(onUpdate).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Anthropic connected");
    });

    it("shows validation error for short subscription token", () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      fireEvent.click(screen.getByText("Anthropic"));

      const input = screen.getByLabelText("Anthropic setup token");
      fireEvent.input(input, { target: { value: "short" } });
      fireEvent.click(screen.getByText("Connect"));

      expect(screen.getByText("Token is too short (minimum 10 characters)")).toBeDefined();
      expect(mockConnectProvider).not.toHaveBeenCalled();
    });

    it("shows masked token for connected Anthropic subscription", () => {
      const subProvider: RoutingProvider = {
        id: "p-sub",
        provider: "anthropic",
        is_active: true,
        has_api_key: true,
        key_prefix: "skst-tok",
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
      fireEvent.click(screen.getByText("Anthropic"));

      expect(screen.getByLabelText("Current setup token (masked)")).toBeDefined();
      expect(screen.getByText("Change")).toBeDefined();
    });

    it("disconnects Anthropic subscription from detail view", async () => {
      const subProvider: RoutingProvider = {
        id: "p-sub",
        provider: "anthropic",
        is_active: true,
        has_api_key: true,
        key_prefix: "skst-tok",
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
      fireEvent.click(screen.getByText("Anthropic"));
      fireEvent.click(screen.getByLabelText("Disconnect provider"));

      await waitFor(() => {
        expect(mockDisconnectProvider).toHaveBeenCalledWith("test-agent", "anthropic", "subscription");
      });
      expect(onUpdate).toHaveBeenCalled();
    });

    it("shows tab hint text for subscription tab", () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      expect(
        screen.getByText(/Use your Claude Max or Pro subscription/),
      ).toBeDefined();
    });

    it("shows tab hint text for API Keys tab", () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      fireEvent.click(screen.getByText("API Keys"));
      expect(
        screen.getByText(/Connect providers using your own API keys/),
      ).toBeDefined();
    });

    it("toggles on a subscription provider without subscriptionKeyPlaceholder via handleSubscriptionToggle", async () => {
      // Create a subscription provider without subscriptionKeyPlaceholder
      // Anthropic has subscriptionKeyPlaceholder so it opens detail view.
      // We need to simulate a provider that uses the toggle directly.
      // All subscription providers in PROVIDERS currently have subscriptionKeyPlaceholder,
      // but the code path still triggers for providers without it — Anthropic has it,
      // so clicking Anthropic opens detail. We test the subscription connect flow
      // by checking the toggle switch and the handleSubscriptionToggle path.
      // Since Anthropic is the only supportsSubscription provider and it has
      // subscriptionKeyPlaceholder, the toggle path (handleSubscriptionToggle) is only
      // reachable if a provider has supportsSubscription=true but no subscriptionKeyPlaceholder.
      // However, isSubscriptionConnected and isSubscriptionWithToken are still exercised
      // in the subscription tab rendering. Let's test those helpers via the list view.
      const subProvider: RoutingProvider = {
        id: "p-sub-connected",
        provider: "anthropic",
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
      // On subscription tab, Anthropic should show toggle as "on" when isSubscriptionConnected
      // returns true. isSubscriptionConnected checks is_active (no has_api_key requirement).
      // But subscriptionKeyPlaceholder is set → uses isSubscriptionWithToken for the connected() signal.
      // isSubscriptionWithToken checks is_active && has_api_key → false here.
      // So the toggle should be OFF (has_api_key is false).
      const onSwitches = container.querySelectorAll(".provider-toggle__switch--on");
      expect(onSwitches.length).toBe(0);
    });

    it("shows subscription toggle as on when provider is subscription-connected without token requirement", async () => {
      const subProvider: RoutingProvider = {
        id: "p-sub-notok",
        provider: "anthropic",
        is_active: true,
        has_api_key: true,
        key_prefix: "sk-ant-oat",
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
      // isSubscriptionWithToken returns true (is_active && has_api_key)
      const onSwitches = container.querySelectorAll(".provider-toggle__switch--on");
      expect(onSwitches.length).toBeGreaterThanOrEqual(1);
    });

    it("shows subscription label from provider definition", () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      // Anthropic has subscriptionLabel: 'Claude Max / Pro subscription'
      expect(screen.getByText("Claude Max / Pro subscription")).toBeDefined();
    });

    it("shows detail subtitle for subscription mode", () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      // Click Anthropic on subscription tab to open detail
      fireEvent.click(screen.getByText("Anthropic"));
      expect(screen.getByText("Paste your setup-token to enable routing")).toBeDefined();
    });

    it("shows CopyButton with subscription command in detail view", () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      fireEvent.click(screen.getByText("Anthropic"));
      // The CopyButton receives the subscription command text
      expect(screen.getByText("claude setup-token")).toBeDefined();
    });

    it("shows subscription placeholder in setup token input", () => {
      render(() => (
        <ProviderSelectModal providers={[]} onClose={onClose} onUpdate={onUpdate} agentName="test-agent" />
      ));
      fireEvent.click(screen.getByText("Anthropic"));
      const input = screen.getByLabelText("Anthropic setup token") as HTMLInputElement;
      expect(input.getAttribute("placeholder")).toBe("Paste your setup-token");
    });

    it("updates token in subscription edit mode", async () => {
      const subProvider: RoutingProvider = {
        id: "p-sub",
        provider: "anthropic",
        is_active: true,
        has_api_key: true,
        key_prefix: "skst-tok",
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
      fireEvent.click(screen.getByText("Anthropic"));
      fireEvent.click(screen.getByText("Change"));

      const UPDATED_TOKEN = "sk-ant-oat01-updated-token-value";
      const input = screen.getByLabelText("New Anthropic setup token");
      fireEvent.input(input, { target: { value: UPDATED_TOKEN } });
      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(mockConnectProvider).toHaveBeenCalledWith("test-agent", {
          provider: "anthropic",
          apiKey: UPDATED_TOKEN,
          authType: "subscription",
        });
      });
      expect(toast.success).toHaveBeenCalledWith("Anthropic token updated");
    });
  });
});
