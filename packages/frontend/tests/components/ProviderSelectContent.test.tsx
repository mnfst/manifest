import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";

vi.mock("../../src/services/api.js", () => ({
  connectProvider: vi.fn(),
  disconnectProvider: vi.fn().mockResolvedValue({ notifications: [] }),
  probeCustomProvider: vi
    .fn()
    .mockResolvedValue({ models: [{ model_name: 'llama-3.1-8b' }] }),
  createCustomProvider: vi.fn().mockResolvedValue({ id: 'cp-1' }),
  deleteCustomProvider: vi.fn().mockResolvedValue({}),
  updateCustomProvider: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../src/services/setup-status.js", () => ({
  checkIsSelfHosted: vi.fn().mockResolvedValue(true),
  checkIsOllamaAvailable: vi.fn().mockResolvedValue(false),
  checkLocalLlmHost: vi.fn().mockResolvedValue('localhost'),
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
      <button data-testid="copilot-back" onClick={() => props.onBack()}>
        Back
      </button>
    </div>
  ),
}));

import ProviderSelectContent from "../../src/components/ProviderSelectContent";

describe("ProviderSelectContent", () => {
  const onUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders header and footer by default", () => {
    const { container } = render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        onUpdate={onUpdate}
        onClose={vi.fn()}
      />
    ));
    expect(screen.getByText("Connect providers")).toBeDefined();
    expect(container.querySelector(".provider-modal__footer")).not.toBeNull();
  });

  it("hides header when showHeader is false", () => {
    const { container } = render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        onUpdate={onUpdate}
        showHeader={false}
      />
    ));
    expect(container.querySelector(".routing-modal__header")).toBeNull();
  });

  it("hides footer when showFooter is false", () => {
    const { container } = render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        onUpdate={onUpdate}
        showFooter={false}
      />
    ));
    expect(container.querySelector(".provider-modal__footer")).toBeNull();
  });

  it("renders both tabs", () => {
    render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        onUpdate={onUpdate}
      />
    ));
    expect(screen.getByText("Subscription")).toBeDefined();
    expect(screen.getByText("API Keys")).toBeDefined();
  });

  it("reveals the Local tab once isSelfHosted resolves true", async () => {
    render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        onUpdate={onUpdate}
      />
    ));
    // Subscription + API Keys are always present; Local shows up after
    // the checkIsSelfHosted mock resolves.
    await waitFor(() => expect(screen.getByText("Local")).toBeDefined());
  });

  it("defaults to the Subscription tab even in self-hosted mode", async () => {
    render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        onUpdate={onUpdate}
      />
    ));
    await waitFor(() => screen.getByText("Local"));
    const subTab = screen.getByText("Subscription").closest("button")!;
    expect(subTab.getAttribute("aria-selected")).toBe("true");
  });

  it("disconnects a local provider when the toggle is clicked while ON", async () => {
    const api = await import("../../src/services/api.js");
    const disconnect = api.disconnectProvider as unknown as ReturnType<typeof vi.fn>;
    disconnect.mockResolvedValueOnce({ notifications: ["cleared 2 overrides"] });
    const onUpdateLocal = vi.fn();
    const { container } = render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[
          {
            id: "prov-1",
            provider: "ollama",
            auth_type: "local",
            is_active: true,
            has_api_key: false,
            connected_at: "2025-01-01",
          },
        ]}
        onUpdate={onUpdateLocal}
      />
    ));
    await waitFor(() => screen.getByText("Local"));
    fireEvent.click(screen.getByText("Local"));
    const ollamaTile = await waitFor(() => {
      const tiles = Array.from(
        container.querySelectorAll<HTMLButtonElement>("button.provider-toggle"),
      );
      const t = tiles.find((el) => el.textContent?.includes("Ollama"));
      if (!t) throw new Error("Ollama tile not found");
      return t;
    });
    // Toggle should be ON since the provider is connected with auth_type='local'
    expect(ollamaTile.querySelector(".provider-toggle__switch--on")).not.toBeNull();
    fireEvent.click(ollamaTile);
    await waitFor(() => expect(disconnect).toHaveBeenCalledWith("test-agent", "ollama", "local"));
    await waitFor(() => expect(onUpdateLocal).toHaveBeenCalled());
  });

  it("surfaces disconnect API errors via toast without onUpdate", async () => {
    const api = await import("../../src/services/api.js");
    const disconnect = api.disconnectProvider as unknown as ReturnType<typeof vi.fn>;
    disconnect.mockRejectedValueOnce(new Error("boom"));
    const onUpdateLocal = vi.fn();
    const { container } = render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[
          {
            id: "prov-1",
            provider: "ollama",
            auth_type: "local",
            is_active: true,
            has_api_key: false,
            connected_at: "2025-01-01",
          },
        ]}
        onUpdate={onUpdateLocal}
      />
    ));
    await waitFor(() => screen.getByText("Local"));
    fireEvent.click(screen.getByText("Local"));
    const ollamaTile = await waitFor(() => {
      const tiles = Array.from(
        container.querySelectorAll<HTMLButtonElement>("button.provider-toggle"),
      );
      const t = tiles.find((el) => el.textContent?.includes("Ollama"));
      if (!t) throw new Error("Ollama tile not found");
      return t;
    });
    fireEvent.click(ollamaTile);
    await waitFor(() => expect(disconnect).toHaveBeenCalled());
    expect(onUpdateLocal).not.toHaveBeenCalled();
  });

  it("shows Z.ai GLM Coding Plan in the subscription tab", () => {
    render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        onUpdate={onUpdate}
      />
    ));
    // Subscription tab is the default view; Z.ai should appear with the GLM Coding Plan label
    expect(screen.getByText("Z.ai")).toBeDefined();
    expect(screen.getAllByText("GLM Coding Plan").length).toBeGreaterThan(0);
  });

  it("opens token paste detail view when Z.ai is clicked in subscription tab", async () => {
    const { container } = render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        onUpdate={onUpdate}
      />
    ));
    fireEvent.click(screen.getByText("Z.ai"));
    await waitFor(() => {
      const input = container.querySelector(
        'input[placeholder="Paste your Z.ai API key"]',
      );
      expect(input).not.toBeNull();
    });
  });

  it("shows 'Get Z.ai API key' link in the Z.ai subscription detail view", async () => {
    const { container } = render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        onUpdate={onUpdate}
      />
    ));
    fireEvent.click(screen.getByText("Z.ai"));
    await waitFor(() => {
      const link = container.querySelector<HTMLAnchorElement>(
        'a[href="https://z.ai/manage-apikey/apikey-list"]',
      );
      expect(link).not.toBeNull();
      expect(link!.textContent).toContain("Z.ai");
    });
  });

  it("switches tabs on click", () => {
    const { container } = render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        onUpdate={onUpdate}
      />
    ));
    const apiKeysTab = screen.getByText("API Keys");
    fireEvent.click(apiKeysTab);
    const tab = container.querySelector('[aria-selected="true"]');
    expect(tab?.textContent).toContain("API Keys");
  });

  it("calls onClose when Done is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        onUpdate={onUpdate}
        onClose={onClose}
      />
    ));
    const doneBtn = container.querySelector(".provider-modal__footer .btn")!;
    fireEvent.click(doneBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("does not throw when onClose is omitted and Done clicked", () => {
    const { container } = render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        onUpdate={onUpdate}
      />
    ));
    const doneBtn = container.querySelector(".provider-modal__footer .btn")!;
    expect(() => fireEvent.click(doneBtn)).not.toThrow();
  });

  describe("LocalServerDetailView flow", () => {
    it("opens LocalServerDetailView when a reachable local-server tile is clicked, and closes on onBack", async () => {
      const { container } = render(() => (
        <ProviderSelectContent
          agentName="test-agent"
          providers={[]}
          onUpdate={onUpdate}
        />
      ));

      // Wait for self-hosted to resolve, then switch to the Local tab (only
      // rendered in self-hosted mode) where the LM Studio tile lives.
      await waitFor(() => screen.getByText("Local"));
      fireEvent.click(screen.getByText("Local"));

      const lmsBtn = await waitFor(() => {
        const b = Array.from(container.querySelectorAll<HTMLButtonElement>("button.provider-toggle")).find(
          (el) => el.textContent?.includes("LM Studio") && !el.disabled,
        );
        if (!b) throw new Error("lmstudio tile not yet enabled");
        return b;
      });
      fireEvent.click(lmsBtn);

      // LocalServerDetailView renders its own "Connect 1 model" button
      await waitFor(() => {
        expect(container.textContent).toContain("Connect 1 model");
      });

      // Back button dismisses the detail view and returns to the list
      const backBtn = container.querySelector(".provider-detail__back") as HTMLButtonElement;
      fireEvent.click(backBtn);
      await waitFor(() => {
        expect(container.querySelector(".provider-detail__back")).toBeNull();
      });
    });

    it("completes the Connect flow: closes the detail view and calls onUpdate", async () => {
      const onUpdateLocal = vi.fn().mockResolvedValue(undefined);
      const { container } = render(() => (
        <ProviderSelectContent
          agentName="test-agent"
          providers={[]}
          onUpdate={onUpdateLocal}
        />
      ));

      await waitFor(() => screen.getByText("Local"));
      fireEvent.click(screen.getByText("Local"));

      const lmsBtn = await waitFor(() => {
        const b = Array.from(container.querySelectorAll<HTMLButtonElement>("button.provider-toggle")).find(
          (el) => el.textContent?.includes("LM Studio") && !el.disabled,
        );
        if (!b) throw new Error("lmstudio tile not yet enabled");
        return b;
      });
      fireEvent.click(lmsBtn);

      const connectBtn = await waitFor(() => {
        const b = Array.from(container.querySelectorAll("button")).find((el) =>
          el.textContent?.trim().startsWith("Connect 1 model"),
        );
        if (!b) throw new Error("Connect button not yet rendered");
        return b as HTMLButtonElement;
      });
      fireEvent.click(connectBtn);

      // After successful create, onConnected → goBack + onUpdate
      await waitFor(() => {
        expect(onUpdateLocal).toHaveBeenCalled();
        expect(container.querySelector(".provider-detail__back")).toBeNull();
      });
    });

    it("routes editing an LM Studio custom provider to LocalServerDetailView in edit mode", async () => {
      const lmsCustom = {
        id: 'cp-lms',
        name: 'LM Studio',
        base_url: 'http://localhost:1234/v1',
        models: [{ model_name: 'llama', input_price_per_million_tokens: 0, output_price_per_million_tokens: 0 }],
      };

      const { container } = render(() => (
        <ProviderSelectContent
          agentName="test-agent"
          providers={[]}
          customProviders={[lmsCustom]}
          onUpdate={onUpdate}
        />
      ));

      await waitFor(() => screen.getByText("Local"));
      fireEvent.click(screen.getByText("Local"));

      // Click the custom provider toggle for LM Studio
      const lmsToggle = await waitFor(() => {
        const toggles = Array.from(container.querySelectorAll<HTMLButtonElement>("button.provider-toggle"));
        const t = toggles.find((el) => el.textContent?.includes("LM Studio"));
        if (!t) throw new Error("LM Studio custom provider toggle not found");
        return t;
      });
      fireEvent.click(lmsToggle);

      // Should open LocalServerDetailView in edit mode
      await waitFor(() => {
        expect(container.textContent).toContain("Edit provider");
      });
    });

    it("does not expose an Advanced / customize escape hatch from the local-server view", async () => {
      const { container } = render(() => (
        <ProviderSelectContent
          agentName="test-agent"
          providers={[]}
          onUpdate={onUpdate}
        />
      ));

      await waitFor(() => screen.getByText("Local"));
      fireEvent.click(screen.getByText("Local"));

      const lmsBtn = await waitFor(() => {
        const b = Array.from(container.querySelectorAll<HTMLButtonElement>("button.provider-toggle")).find(
          (el) => el.textContent?.includes("LM Studio") && !el.disabled,
        );
        if (!b) throw new Error("lmstudio tile not yet enabled");
        return b;
      });
      fireEvent.click(lmsBtn);

      await waitFor(() => {
        expect(container.textContent).toContain("Connect 1 model");
      });

      const advanced = Array.from(container.querySelectorAll("button")).find((el) =>
        el.textContent?.toLowerCase().includes("advanced"),
      );
      const customize = Array.from(container.querySelectorAll("button")).find((el) =>
        el.textContent?.toLowerCase().includes("customize"),
      );
      expect(advanced).toBeUndefined();
      expect(customize).toBeUndefined();
    });
  });

  describe("CopilotDeviceLogin callbacks", () => {
    it("should call onUpdate and goBack when onConnected fires", async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      const { container } = render(() => (
        <ProviderSelectContent
          agentName="test-agent"
          providers={[]}
          onUpdate={onUpdate}
        />
      ));

      // Click copilot provider in the subscription tab to open device login
      fireEvent.click(screen.getByText("GitHub Copilot"));

      // The CopilotDeviceLogin mock should now be visible
      await waitFor(() => {
        expect(container.querySelector('[data-testid="copilot-device-login"]')).not.toBeNull();
      });

      // Click the onConnected button
      fireEvent.click(screen.getByTestId("copilot-connected"));

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalled();
      });

      // After onConnected, goBack is called, returning to the list view
      await waitFor(() => {
        expect(container.querySelector('[data-testid="copilot-device-login"]')).toBeNull();
      });
    });

    it("should call onUpdate and goBack when onDisconnected fires", async () => {
      const onUpdate = vi.fn();
      const { container } = render(() => (
        <ProviderSelectContent
          agentName="test-agent"
          providers={[]}
          onUpdate={onUpdate}
        />
      ));

      // Click copilot provider to open device login view
      fireEvent.click(screen.getByText("GitHub Copilot"));

      await waitFor(() => {
        expect(container.querySelector('[data-testid="copilot-device-login"]')).not.toBeNull();
      });

      // Click the onDisconnected button
      fireEvent.click(screen.getByTestId("copilot-disconnected"));

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalled();
      });

      // After onDisconnected, goBack is called, returning to the list view
      await waitFor(() => {
        expect(container.querySelector('[data-testid="copilot-device-login"]')).toBeNull();
      });
    });
  });
});
