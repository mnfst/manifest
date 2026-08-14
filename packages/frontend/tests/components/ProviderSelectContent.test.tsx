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

// NOTE: The provider list/tile view (header, footer, Subscription/API Keys/Local
// tabs, and clickable provider tiles) was removed from ProviderSelectContent on
// this branch — connection now happens via deep links from the dedicated
// Subscriptions / Usage-based / Local provider pages. The component renders
// ONLY a detail view, driven by `providerDeepLink` or `customProviderPrefill`.
// These tests therefore enter every flow through a deep link / prefill rather
// than by clicking a tile that no longer exists.

describe("ProviderSelectContent", () => {
  const onUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when no deep link or prefill is provided", () => {
    const { container } = render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        onUpdate={onUpdate}
        onClose={vi.fn()}
      />
    ));
    // The list view is gone; with no deep link there is no detail view either.
    expect(container.querySelector(".provider-modal__view--from-right")).toBeNull();
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

  it("opens the Z.ai subscription detail directly via a deep link", async () => {
    const { container } = render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        providerDeepLink={{ providerId: 'zai', authType: 'subscription' }}
        onUpdate={onUpdate}
      />
    ));
    expect(screen.getByText("Z.ai")).toBeDefined();
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
        providerDeepLink={{ providerId: 'zai', authType: 'subscription' }}
        onUpdate={onUpdate}
      />
    ));
    await waitFor(() => {
      const link = container.querySelector<HTMLAnchorElement>(
        'a[href="https://z.ai/manage-apikey/apikey-list"]',
      );
      expect(link).not.toBeNull();
      expect(link!.textContent).toContain("Z.ai");
    });
  });

  it("shows 'Get Kimi Code API key' link to the Kimi Code console in the Moonshot subscription detail view", async () => {
    const { container } = render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        providerDeepLink={{ providerId: 'moonshot', authType: 'subscription' }}
        onUpdate={onUpdate}
      />
    ));
    expect(screen.getByText("Moonshot")).toBeDefined();
    await waitFor(() => {
      const link = container.querySelector<HTMLAnchorElement>(
        'a[href="https://www.kimi.com/code/console"]',
      );
      expect(link).not.toBeNull();
      expect(link!.textContent).toContain("Kimi Code");
    });
  });

  it("shows 'Get ModelArk Coding Plan API key' link to the BytePlus console", async () => {
    const { container } = render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        providerDeepLink={{ providerId: 'byteplus', authType: 'subscription' }}
        onUpdate={onUpdate}
      />
    ));
    expect(screen.getByText("BytePlus")).toBeDefined();
    await waitFor(() => {
      const link = container.querySelector<HTMLAnchorElement>(
        'a[href="https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey"]',
      );
      expect(link).not.toBeNull();
      expect(link!.textContent).toContain("ModelArk Coding Plan");
    });
  });

  it("shows only the Command Code key-form link to Studio", async () => {
    const { container } = render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        providerDeepLink={{ providerId: 'commandcode', authType: 'subscription' }}
        onUpdate={onUpdate}
      />
    ));
    expect(screen.getByText("Command Code")).toBeDefined();
    await waitFor(() => {
      const link = container.querySelector<HTMLAnchorElement>(
        'a[href="https://commandcode.ai/studio"]',
      );
      expect(link).not.toBeNull();
      expect(link!.textContent).toContain("Command Code");
    });
    // The Pro-or-higher requirement note is shown for the subscription view.
    expect(screen.getByText("Requires Command Code Pro or higher.")).toBeDefined();
    // No external sign-in button and no separate api-keys settings link — the
    // only link is the Studio key-form link asserted above.
    expect(container.querySelector(".provider-detail__signin-btn")).toBeNull();
    expect(
      container.querySelector('a[href="https://commandcode.ai/studio/settings/api-keys"]'),
    ).toBeNull();
  });

  it("calls onClose when the deep-link detail view's Back button is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        providerDeepLink={{ providerId: 'zai', authType: 'subscription' }}
        onUpdate={onUpdate}
        onClose={onClose}
      />
    ));
    const backBtn = container.querySelector(".modal-back-btn") as HTMLButtonElement;
    fireEvent.click(backBtn);
    // A deep-link entry has no list view to return to → Back dismisses the modal.
    expect(onClose).toHaveBeenCalled();
  });

  it("does not throw when onClose is omitted and Back is clicked", () => {
    const { container } = render(() => (
      <ProviderSelectContent
        agentName="test-agent"
        providers={[]}
        providerDeepLink={{ providerId: 'zai', authType: 'subscription' }}
        onUpdate={onUpdate}
      />
    ));
    const backBtn = container.querySelector(".modal-back-btn") as HTMLButtonElement;
    expect(() => fireEvent.click(backBtn)).not.toThrow();
  });

  describe("LocalServerDetailView flow", () => {
    // The LM Studio / llama.cpp local-server detail view is reached by editing
    // an existing local custom provider (its name maps to a defaultLocalPort
    // provider). The create-from-tile flow was removed with the list view.
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
          providerDeepLink={{ providerId: 'custom:cp-lms' }}
          onUpdate={onUpdate}
        />
      ));

      // Opening the custom: deep link for an LM Studio provider routes to
      // LocalServerDetailView in edit mode rather than the generic form.
      await waitFor(() => {
        expect(container.textContent).toContain("Edit provider");
      });
    });

    it("completes the Connect flow from edit mode: closes the detail view and calls onUpdate", async () => {
      const lmsCustom = {
        id: 'cp-lms',
        name: 'LM Studio',
        base_url: 'http://localhost:1234/v1',
        models: [{ model_name: 'llama-3.1-8b', input_price_per_million_tokens: 0, output_price_per_million_tokens: 0 }],
      };
      const onUpdateLocal = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      const { container } = render(() => (
        <ProviderSelectContent
          agentName="test-agent"
          providers={[]}
          customProviders={[lmsCustom]}
          providerDeepLink={{ providerId: 'custom:cp-lms' }}
          onUpdate={onUpdateLocal}
          onClose={onClose}
        />
      ));

      // In edit mode the primary action saves changes (the create-mode
      // "Connect N models" label only appears for a brand-new connection).
      const saveBtn = await waitFor(() => {
        const b = Array.from(container.querySelectorAll("button")).find((el) =>
          el.textContent?.trim() === "Save changes",
        );
        if (!b) throw new Error("Save changes button not yet rendered");
        return b as HTMLButtonElement;
      });
      fireEvent.click(saveBtn);

      // After a successful update, onConnected → onUpdate (and goBack → onClose
      // since a deep-link entry has no list view to return to).
      await waitFor(() => {
        expect(onUpdateLocal).toHaveBeenCalled();
      });
    });

    it("does not expose an Advanced / customize escape hatch from the local-server view", async () => {
      const lmsCustom = {
        id: 'cp-lms',
        name: 'LM Studio',
        base_url: 'http://localhost:1234/v1',
        models: [{ model_name: 'llama-3.1-8b', input_price_per_million_tokens: 0, output_price_per_million_tokens: 0 }],
      };
      const { container } = render(() => (
        <ProviderSelectContent
          agentName="test-agent"
          providers={[]}
          customProviders={[lmsCustom]}
          providerDeepLink={{ providerId: 'custom:cp-lms' }}
          onUpdate={onUpdate}
        />
      ));

      await waitFor(() => {
        expect(container.textContent).toContain("Edit provider");
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
    // onUpdate whenever the form fires onCreated or onDeleted. The form is now
    // reached via a customProviderPrefill (the "Add custom provider" list
    // button was removed with the list view).
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

    it("dismisses the form and calls onUpdate when the form fires onCreated", async () => {
      vi.resetModules();
      const { default: Fresh } = await import("../../src/components/ProviderSelectContent");
      const onUpdateLocal = vi.fn();
      const { container } = render(() => (
        <Fresh
          agentName="test-agent"
          providers={[]}
          customProviderPrefill={{ name: 'My Endpoint', baseUrl: 'https://api.example.com/v1' }}
          onUpdate={onUpdateLocal}
        />
      ));

      // A prefill opens the custom-provider form immediately.
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
          providerDeepLink={{ providerId: 'custom:cp-my-groq' }}
          onUpdate={onUpdate}
        />
      ));

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
      });
    });

    it("dismisses the form and calls onUpdate when the form fires onDeleted", async () => {
      vi.resetModules();
      const { default: Fresh } = await import("../../src/components/ProviderSelectContent");
      const onUpdateLocal = vi.fn();
      const { container } = render(() => (
        <Fresh
          agentName="test-agent"
          providers={[]}
          customProviderPrefill={{ name: 'My Endpoint', baseUrl: 'https://api.example.com/v1' }}
          onUpdate={onUpdateLocal}
        />
      ));

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
    // (b) open the generic custom-provider form. The local-server view is
    // reached by editing an existing llama.cpp custom provider.
    it("swaps the local-server view for the custom-provider form when the hint link is clicked", async () => {
      const api = await import("../../src/services/api.js");
      const probeMock = api.probeCustomProvider as ReturnType<typeof vi.fn>;
      // Force the llama.cpp probe to fail so FailureState renders its
      // notReachableHint. The global mock defaults to success for the
      // other tests, so we restore it afterwards.
      const defaultImpl = probeMock.getMockImplementation();
      probeMock.mockRejectedValue(new Error("returned 404"));
      try {
        const llamaCustom = {
          id: 'cp-llama',
          name: 'llama.cpp',
          base_url: 'http://localhost:8080/v1',
          models: [{ model_name: 'llama', input_price_per_million_tokens: 0, output_price_per_million_tokens: 0 }],
        };

        const { container } = render(() => (
          <ProviderSelectContent
            agentName="test-agent"
            providers={[]}
            customProviders={[llamaCustom]}
            providerDeepLink={{ providerId: 'custom:cp-llama' }}
            onUpdate={onUpdate}
          />
        ));

        // Wait for the probe to fail and the "Add custom provider" link to surface.
        const hintLink = await waitFor(() => {
          const b = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
            (el) => el.textContent?.trim() === "Add custom provider",
          );
          if (!b) throw new Error("notReachableHint link not yet rendered");
          return b;
        });
        fireEvent.click(hintLink);

        // After the click, the LocalServerDetailView must be gone and the
        // CustomProviderForm must be mounted. Both views share .modal-back-btn,
        // so verify a CustomProviderForm-specific surface (its inputs).
        await waitFor(() => {
          // LocalServerDetailView content must be gone
          expect(container.textContent).not.toContain("llama-server");
          // CustomProviderForm surfaces inputs for name + base URL.
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
    // The device-login view is reached via a copilot deep link (the
    // "GitHub Copilot" tile was removed with the list view).
    it("calls onUpdate and dismisses via onClose when onConnected fires", async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      const { container } = render(() => (
        <ProviderSelectContent
          agentName="test-agent"
          providers={[]}
          providerDeepLink={{ providerId: 'copilot', authType: 'subscription' }}
          onUpdate={onUpdate}
          onClose={onClose}
        />
      ));

      // The CopilotDeviceLogin mock is visible directly from the deep link.
      await waitFor(() => {
        expect(container.querySelector('[data-testid="copilot-device-login"]')).not.toBeNull();
      });

      // Click the onConnected button
      fireEvent.click(screen.getByTestId("copilot-connected"));

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalled();
      });

      // onConnected → goBack, which (with a deep-link entry) calls onClose.
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it("calls onUpdate and dismisses via onClose when onDisconnected fires", async () => {
      const onUpdate = vi.fn();
      const onClose = vi.fn();
      const { container } = render(() => (
        <ProviderSelectContent
          agentName="test-agent"
          providers={[]}
          providerDeepLink={{ providerId: 'copilot', authType: 'subscription' }}
          onUpdate={onUpdate}
          onClose={onClose}
        />
      ));

      await waitFor(() => {
        expect(container.querySelector('[data-testid="copilot-device-login"]')).not.toBeNull();
      });

      // Click the onDisconnected button
      fireEvent.click(screen.getByTestId("copilot-disconnected"));

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalled();
      });

      // onDisconnected → goBack, which (with a deep-link entry) calls onClose.
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });
});
