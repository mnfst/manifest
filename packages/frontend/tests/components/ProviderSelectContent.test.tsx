import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";

vi.mock("../../src/services/api.js", () => ({
  connectProvider: vi.fn(),
  disconnectProvider: vi.fn().mockResolvedValue({ notifications: [] }),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../src/components/ProviderIcon.js", () => ({
  providerIcon: () => null, customProviderLogo: () => null,
}));

vi.mock("../../src/services/local-mode.js", () => ({
  isLocalMode: () => false,
  checkLocalMode: () => Promise.resolve(false),
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
