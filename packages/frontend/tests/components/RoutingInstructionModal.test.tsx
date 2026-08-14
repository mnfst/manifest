import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

vi.stubGlobal("navigator", {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

const mockGetModelPrices = vi.fn();
const mockGetAgentKey = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getModelPrices: () => mockGetModelPrices(),
  getAgentKey: (n: string) => mockGetAgentKey(n),
}));

vi.mock("../../src/services/agent-platform-store.js", () => ({
  agentPlatform: () => "openclaw",
  agentCategory: () => null,
}));

vi.mock("manifest-shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("manifest-shared")>();
  return { ...actual, platformIcon: () => undefined };
});

vi.mock("../../src/components/SetupStepAddProvider.jsx", () => ({
  default: (props: any) => (
    <div data-testid="setup-add-provider" data-base-url={props.baseUrl ?? ""} data-api-key={props.apiKey ?? ""} data-platform={props.platform ?? ""} data-key-prefix={props.keyPrefix ?? ""}>
      SetupStepAddProvider
    </div>
  ),
}));

import RoutingInstructionModal from "../../src/components/RoutingInstructionModal";

const testModels = {
  models: [
    { model_name: "gpt-4o", provider: "OpenAI" },
    { model_name: "claude-sonnet-4", provider: "Anthropic" },
    { model_name: "gemini-2.5-flash", provider: "Google" },
    { model_name: "z-ai/glm-5", provider: "OpenRouter" },
  ],
  lastSyncedAt: "2026-02-28T10:00:00Z",
};

describe("RoutingInstructionModal", () => {
  beforeEach(() => {
    mockGetModelPrices.mockResolvedValue(testModels);
    mockGetAgentKey.mockResolvedValue({ keyPrefix: "mnfst_abc", apiKey: "mnfst_abc123" });
  });

  it("renders nothing when open is false", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={false} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    expect(container.querySelector(".modal-overlay")).toBeNull();
  });

  it("shows 'Set up agent' title in enable mode", () => {
    render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    expect(screen.getByText("test-agent")).toBeDefined();
  });

  it("shows SetupStepAddProvider in enable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    expect(container.querySelector('[data-testid="setup-add-provider"]')).not.toBeNull();
  });

  it("shows 'Deactivate routing' title in disable mode", () => {
    render(() => (
      <RoutingInstructionModal open={true} mode="disable" agentName="test-agent" onClose={() => {}} />
    ));
    expect(screen.getByText("Deactivate routing")).toBeDefined();
  });

  it("shows search input instead of model buttons in disable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="disable" agentName="test-agent" onClose={() => {}} />
    ));
    expect(container.querySelector(".routing-modal__search")).not.toBeNull();
    expect(container.querySelector(".routing-modal__inline-picker")).not.toBeNull();
  });

  it("shows terminal with placeholder before model is selected in disable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="disable" agentName="test-agent" onClose={() => {}} />
    ));
    expect(container.querySelector(".modal-terminal")).not.toBeNull();
    expect(container.textContent).toContain("<provider/model>");
    expect(container.textContent).toContain("openclaw config unset models.providers.manifest");
    expect(container.textContent).toContain("openclaw config unset agents.defaults.models.manifest/auto");
  });

  it("explains that this restores direct model access in disable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="disable" agentName="test-agent" onClose={() => {}} />
    ));
    expect(container.textContent).toContain("restore direct model access");
  });

  it("updates command when a model is selected from dropdown", async () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="disable" agentName="test-agent" onClose={() => {}} />
    ));

    await vi.waitFor(() => {
      expect(container.querySelector(".routing-modal__list")).not.toBeNull();
    });

    const buttons = container.querySelectorAll(".routing-modal__model");
    const gpt4oButton = Array.from(buttons).find((btn) =>
      btn.textContent?.includes("gpt-4o") && !btn.textContent?.includes("mini"),
    );
    expect(gpt4oButton).toBeDefined();
    fireEvent.click(gpt4oButton!);

    await vi.waitFor(() => {
      expect(container.textContent).toContain("openai/gpt-4o");
    });
    expect(container.textContent).not.toContain("<provider/model>");
  });

  it("uses the provider heading for OpenRouter vendor-prefixed models", async () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="disable" agentName="test-agent" onClose={() => {}} />
    ));

    await vi.waitFor(() => {
      expect(container.querySelector(".routing-modal__list")).not.toBeNull();
    });

    const groups = Array.from(container.querySelectorAll(".routing-modal__group"));
    const openRouterGroup = groups.find((group) =>
      group.querySelector(".routing-modal__group-name")?.textContent?.includes("OpenRouter"),
    );

    expect(openRouterGroup).toBeDefined();

    const glmButton = Array.from(openRouterGroup!.querySelectorAll(".routing-modal__model")).find(
      (button) => button.textContent?.includes("z-ai/glm-5"),
    );

    expect(glmButton).toBeDefined();
    fireEvent.click(glmButton!);

    await vi.waitFor(() => {
      expect(container.textContent).toContain("openrouter/z-ai/glm-5");
    });
  });

  it("does not show model picker in enable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    expect(container.querySelector(".routing-modal__inline-picker")).toBeNull();
  });

  it("renders SetupStepAddProvider even when connectedProvider is set", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" connectedProvider="openai" onClose={() => {}} />
    ));
    expect(container.querySelector('[data-testid="setup-add-provider"]')).not.toBeNull();
  });

  it("renders SetupStepAddProvider when connectedProvider is null", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" connectedProvider={null} onClose={() => {}} />
    ));
    expect(container.querySelector('[data-testid="setup-add-provider"]')).not.toBeNull();
  });

  it("shows restart command in disable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="disable" agentName="test-agent" onClose={() => {}} />
    ));
    expect(container.textContent).toContain("openclaw gateway restart");
  });

  it("renders SetupStepAddProvider with platform in enable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    const el = container.querySelector('[data-testid="setup-add-provider"]');
    expect(el).not.toBeNull();
    expect(el!.getAttribute("data-platform")).toBe("openclaw");
  });

  it("calls onClose when Done is clicked", () => {
    const onClose = vi.fn();
    render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={onClose} />
    ));
    fireEvent.click(screen.getByText("Done"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not show terminal UI in enable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    expect(container.querySelector(".modal-terminal")).toBeNull();
  });

  it("builds the disable command with placeholder model by default", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="disable" agentName="test-agent" onClose={() => {}} />
    ));
    // The disableCmd function interpolates the selected model (or placeholder)
    expect(container.textContent).toContain("openclaw config unset models.providers.manifest");
    expect(container.textContent).toContain("openclaw config unset agents.defaults.models.manifest/auto");
    expect(container.textContent).toContain("openclaw config set agents.defaults.model.primary <provider/model>");
    expect(container.textContent).toContain("openclaw gateway restart");
  });

  it("copies the disable command via copy button", async () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="disable" agentName="test-agent" onClose={() => {}} />
    ));
    const copyBtn = container.querySelector(".modal-terminal__copy");
    expect(copyBtn).not.toBeNull();
    fireEvent.click(copyBtn!);
    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
    // Verify the copied text contains all four disable commands
    const copiedText = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(copiedText).toContain("openclaw config unset models.providers.manifest");
    expect(copiedText).toContain("openclaw config unset agents.defaults.models.manifest/auto");
    expect(copiedText).toContain("openclaw config set agents.defaults.model.primary");
    expect(copiedText).toContain("openclaw gateway restart");
  });

  it("closes on Escape key", () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="disable" agentName="test-agent" onClose={onClose} />
    ));
    const overlay = container.querySelector(".modal-overlay")!;
    fireEvent.keyDown(overlay, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on overlay click", () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="disable" agentName="test-agent" onClose={onClose} />
    ));
    const overlay = container.querySelector(".modal-overlay")!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it("closes when close button is clicked in disable mode", () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="disable" agentName="test-agent" onClose={onClose} />
    ));
    const closeBtn = container.querySelector('[aria-label="Close"]')!;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("passes apiKey to SetupStepAddProvider in enable mode", async () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    await vi.waitFor(() => {
      const el = container.querySelector('[data-testid="setup-add-provider"]');
      expect(el).not.toBeNull();
      expect(el!.getAttribute("data-api-key")).toBe("mnfst_abc123");
    });
  });

  it("shows unset command in disable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="disable" agentName="test-agent" onClose={() => {}} />
    ));
    expect(container.textContent).toContain("openclaw config unset models.providers.manifest");
  });

  it("passes null apiKey to SetupStepAddProvider when full key unavailable", async () => {
    mockGetAgentKey.mockResolvedValue({ keyPrefix: "mnfst_abc", apiKey: null });
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    await vi.waitFor(() => {
      const el = container.querySelector('[data-testid="setup-add-provider"]');
      expect(el).not.toBeNull();
      expect(el!.getAttribute("data-api-key")).toBe("");
    });
  });

  it("passes full apiKey to SetupStepAddProvider when available", async () => {
    mockGetAgentKey.mockResolvedValue({ keyPrefix: "mnfst_abc", apiKey: "mnfst_abc123full" });
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    await vi.waitFor(() => {
      const el = container.querySelector('[data-testid="setup-add-provider"]');
      expect(el).not.toBeNull();
      expect(el!.getAttribute("data-api-key")).toBe("mnfst_abc123full");
    });
  });

  it("renders SetupStepAddProvider with correct props in enable mode", async () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    await vi.waitFor(() => {
      const el = container.querySelector('[data-testid="setup-add-provider"]');
      expect(el).not.toBeNull();
      expect(el!.getAttribute("data-api-key")).toBe("mnfst_abc123");
      expect(el!.getAttribute("data-platform")).toBe("openclaw");
    });
  });

  it("passes null apiKey and keyPrefix when no key data", async () => {
    mockGetAgentKey.mockResolvedValue({ keyPrefix: null, apiKey: null });
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    await vi.waitFor(() => {
      const el = container.querySelector('[data-testid="setup-add-provider"]');
      expect(el).not.toBeNull();
      expect(el!.getAttribute("data-api-key")).toBe("");
      expect(el!.getAttribute("data-key-prefix")).toBe("");
    });
  });
});
