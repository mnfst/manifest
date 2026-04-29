import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
    const toggle = ollamaTile.querySelector(".provider-toggle__switch") as HTMLElement;
    expect(toggle.classList.contains("provider-toggle__switch--on")).toBe(true);
    fireEvent.click(toggle);
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
    const toggle = ollamaTile.querySelector(".provider-toggle__switch") as HTMLElement;
    fireEvent.click(toggle);
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
      const backBtn = container.querySelector(".modal-back-btn") as HTMLButtonElement;
      fireEvent.click(backBtn);
      await waitFor(() => {
        expect(container.querySelector(".modal-back-btn")).toBeNull();
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
        expect(container.querySelector(".modal-back-btn")).toBeNull();
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

  describe("CustomProviderForm callbacks", () => {
    // The form itself is tested in its own spec; here we only verify the
    // wiring: ProviderSelectContent must dismiss the form view and call
    // onUpdate whenever the form fires onCreated or onDeleted.
    beforeEach(() => {
      vi.doMock("../../src/components/CustomProviderForm.js", () => ({
        default: (p: {
          agentName: string;
          onCreated: () => void;
          onDeleted?: () => void;
          onBack: () => void;
          initialData?: { id: string; name: string };
          prefill?: unknown;
        }) => (
          // Read every prop on render so JSX getters fire — otherwise
          // Solid's lazy prop evaluation leaves the prefill ternary
          // branches unexercised in coverage.
          <div
            data-testid="custom-provider-form"
            data-agent={p.agentName}
            data-has-initial={p.initialData ? "yes" : "no"}
            data-has-prefill={p.prefill !== undefined ? "yes" : "no"}
          >
            <button data-testid="form-created" onClick={() => p.onCreated()}>
              fire onCreated
            </button>
            <button data-testid="form-deleted" onClick={() => p.onDeleted?.()}>
              fire onDeleted
            </button>
            <button data-testid="form-back" onClick={() => p.onBack()}>
              fire onBack
            </button>
          </div>
        ),
      }));
    });

    afterEach(() => {
      vi.doUnmock("../../src/components/CustomProviderForm.js");
    });

    it("returns to the list and calls onUpdate when the form fires onCreated", async () => {
      vi.resetModules();
      const { default: Fresh } = await import("../../src/components/ProviderSelectContent");
      const onUpdateLocal = vi.fn();
      const { container } = render(() => (
        <Fresh agentName="test-agent" providers={[]} onUpdate={onUpdateLocal} />
      ));

      fireEvent.click(screen.getByText("API Keys"));
      const addBtn = await waitFor(() => {
        const b = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
          (el) => el.textContent?.trim() === "Add custom provider",
        );
        if (!b) throw new Error("Add custom provider button not rendered");
        return b;
      });
      fireEvent.click(addBtn);

      await waitFor(() => {
        expect(container.querySelector('[data-testid="custom-provider-form"]')).not.toBeNull();
      });

      fireEvent.click(screen.getByTestId("form-created"));

      await waitFor(() => {
        expect(onUpdateLocal).toHaveBeenCalled();
        expect(container.querySelector('[data-testid="custom-provider-form"]')).toBeNull();
      });
    });

    it("opens the form in edit mode (initialData set, prefill suppressed) for a non-local custom provider", async () => {
      vi.resetModules();
      const { default: Fresh } = await import("../../src/components/ProviderSelectContent");
      const customRow = {
        id: 'cp-my-groq',
        name: 'My Groq',
        base_url: 'https://api.groq.example/v1',
        models: [{ model_name: 'llama-3.1-70b', input_price_per_million_tokens: 0, output_price_per_million_tokens: 0 }],
      };

      const { container } = render(() => (
        <Fresh
          agentName="test-agent"
          providers={[]}
          customProviders={[customRow]}
          onUpdate={onUpdate}
        />
      ));

      fireEvent.click(screen.getByText("API Keys"));

      const editBtn = await waitFor(() => {
        const b = Array.from(container.querySelectorAll<HTMLButtonElement>("button.provider-toggle")).find(
          (el) => el.textContent?.includes("My Groq"),
        );
        if (!b) throw new Error("My Groq tile not rendered");
        return b;
      });
      fireEvent.click(editBtn);

      // The mocked CustomProviderForm is mounted (not the LocalServerDetailView),
      // confirming the edit path falls through to the generic form for a
      // name that doesn't map to any defaultLocalPort provider.
      await waitFor(() => {
        const form = container.querySelector('[data-testid="custom-provider-form"]');
        expect(form).not.toBeNull();
        // Edit mode: initialData must be forwarded and prefill must be
        // suppressed (the form shouldn't receive a partial prefill on top
        // of an existing row).
        expect(form!.getAttribute('data-has-initial')).toBe('yes');
        expect(form!.getAttribute('data-has-prefill')).toBe('no');
        expect(container.querySelector('.modal-back-btn')).toBeNull();
      });
    });

    it("returns to the list and calls onUpdate when the form fires onDeleted", async () => {
      vi.resetModules();
      const { default: Fresh } = await import("../../src/components/ProviderSelectContent");
      const onUpdateLocal = vi.fn();
      const { container } = render(() => (
        <Fresh agentName="test-agent" providers={[]} onUpdate={onUpdateLocal} />
      ));

      fireEvent.click(screen.getByText("API Keys"));
      const addBtn = await waitFor(() => {
        const b = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
          (el) => el.textContent?.trim() === "Add custom provider",
        );
        if (!b) throw new Error("Add custom provider button not rendered");
        return b;
      });
      fireEvent.click(addBtn);

      await waitFor(() => {
        expect(container.querySelector('[data-testid="custom-provider-form"]')).not.toBeNull();
      });

      fireEvent.click(screen.getByTestId("form-deleted"));

      await waitFor(() => {
        expect(onUpdateLocal).toHaveBeenCalled();
        expect(container.querySelector('[data-testid="custom-provider-form"]')).toBeNull();
      });
    });
  });

  describe("onOpenCustomForm wiring from LocalServerDetailView", () => {
    // Exercises the llama.cpp escape hatch: when the probe fails and the
    // user clicks the "Add custom provider" link inside LocalServerDetailView,
    // ProviderSelectContent must (a) dismiss the local-server view and
    // (b) open the generic custom-provider form.
    it("swaps the local-server view for the custom-provider form when the hint link is clicked", async () => {
      const api = await import("../../src/services/api.js");
      const probeMock = api.probeCustomProvider as ReturnType<typeof vi.fn>;
      // Force the llama.cpp probe to fail so FailureState renders its
      // notReachableHint. The global mock defaults to success for the
      // other tests in this describe, so we restore it afterwards.
      const defaultImpl = probeMock.getMockImplementation();
      probeMock.mockRejectedValue(new Error("returned 404"));
      try {

      const { container } = render(() => (
        <ProviderSelectContent
          agentName="test-agent"
          providers={[]}
          onUpdate={onUpdate}
        />
      ));

      await waitFor(() => screen.getByText("Local"));
      fireEvent.click(screen.getByText("Local"));

      const llamaBtn = await waitFor(() => {
        const b = Array.from(container.querySelectorAll<HTMLButtonElement>("button.provider-toggle")).find(
          (el) => el.textContent?.includes("llama.cpp") && !el.disabled,
        );
        if (!b) throw new Error("llama.cpp tile not yet enabled");
        return b;
      });
      fireEvent.click(llamaBtn);

      // Wait for the probe to fail and the "Add custom provider" link to surface.
      const hintLink = await waitFor(() => {
        const b = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
          (el) => el.textContent?.trim() === "Add custom provider",
        );
        if (!b) throw new Error("notReachableHint link not yet rendered");
        return b;
      });
      fireEvent.click(hintLink);

      // After the click, the LocalServerDetailView must be gone (we're no
      // longer on that view) and the CustomProviderForm must be mounted.
      // Both views share the .modal-back-btn class, so instead verify
      // that a CustomProviderForm-specific element is present (name input).
      await waitFor(() => {
        // LocalServerDetailView content must be gone
        expect(container.textContent).not.toContain("llama-server");
        // CustomProviderForm surfaces inputs for name + base URL — check
        // for a text input with a placeholder or label that belongs to it.
        const inputs = container.querySelectorAll("input");
        expect(inputs.length).toBeGreaterThan(0);
      });
      } finally {
        if (defaultImpl) probeMock.mockImplementation(defaultImpl);
        else probeMock.mockResolvedValue({ models: [{ model_name: 'llama-3.1-8b' }] });
      }
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
