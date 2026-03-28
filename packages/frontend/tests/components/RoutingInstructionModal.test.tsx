import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

vi.stubGlobal("navigator", {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

const mockGetModelPrices = vi.fn();
const mockGetAgentKey = vi.fn();
const mockGetHealth = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getModelPrices: () => mockGetModelPrices(),
  getAgentKey: (n: string) => mockGetAgentKey(n),
  getHealth: () => mockGetHealth(),
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
    mockGetAgentKey.mockResolvedValue({ keyPrefix: "mnfst_abc", apiKey: "mnfst_abc123", pluginEndpoint: null });
    mockGetHealth.mockResolvedValue({ mode: "cloud" });
  });

  it("renders nothing when open is false", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={false} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    expect(container.querySelector(".modal-overlay")).toBeNull();
  });

  it("shows 'Activate routing' title in enable mode", () => {
    render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    expect(screen.getByText("Activate routing")).toBeDefined();
  });

  it("shows manifest/auto command in enable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    expect(container.textContent).toContain("manifest/auto");
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

  it("shows connected provider name in enable mode when connectedProvider is set", () => {
    render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" connectedProvider="openai" onClose={() => {}} />
    ));
    expect(screen.getByText("OpenAI")).toBeDefined();
    expect(screen.getByText("is now connected.")).toBeDefined();
  });

  it("does not show provider name when connectedProvider is null", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" connectedProvider={null} onClose={() => {}} />
    ));
    expect(container.textContent).not.toContain("is now connected.");
  });

  it("falls back to raw provider id when provider is not in PROVIDERS list", () => {
    render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" connectedProvider="custom:my-provider" onClose={() => {}} />
    ));
    expect(screen.getByText("custom:my-provider")).toBeDefined();
  });

  it("shows restart command in disable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="disable" agentName="test-agent" onClose={() => {}} />
    ));
    expect(container.textContent).toContain("openclaw gateway restart");
  });

  it("shows restart command in enable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    expect(container.textContent).toContain("openclaw gateway restart");
  });

  it("calls onClose when Done is clicked", () => {
    const onClose = vi.fn();
    render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={onClose} />
    ));
    fireEvent.click(screen.getByText("Done"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("has a copy button in enable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    expect(container.querySelector(".modal-terminal__copy")).not.toBeNull();
  });

  it("shows terminal UI in enable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    expect(container.querySelector(".modal-terminal")).not.toBeNull();
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

  it("shows provider JSON with baseUrl and apiKey in enable mode", async () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    await vi.waitFor(() => {
      expect(container.textContent).toContain("openai-completions");
    });
    expect(container.textContent).toContain("models.providers.manifest");
    expect(container.textContent).toContain("mnfst_abc123");
  });

  it("shows unset command in disable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="disable" agentName="test-agent" onClose={() => {}} />
    ));
    expect(container.textContent).toContain("openclaw config unset models.providers.manifest");
  });

  it("shows truncated key warning when full apiKey is unavailable", async () => {
    mockGetAgentKey.mockResolvedValue({ keyPrefix: "mnfst_abc", apiKey: null, pluginEndpoint: null });
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    await vi.waitFor(() => {
      expect(container.textContent).toContain("mnfst_abc...");
    });
    expect(container.textContent).toContain("with your full Manifest API key");
  });

  it("does not show truncated key warning when full apiKey is available", async () => {
    mockGetAgentKey.mockResolvedValue({ keyPrefix: "mnfst_abc", apiKey: "mnfst_abc123full", pluginEndpoint: null });
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    await vi.waitFor(() => {
      expect(container.textContent).toContain("mnfst_abc123full");
    });
    expect(container.textContent).not.toContain("with your full Manifest API key");
  });

  it("uses pluginEndpoint as baseUrl when available", async () => {
    mockGetAgentKey.mockResolvedValue({ keyPrefix: "mnfst_abc", apiKey: "mnfst_key", pluginEndpoint: "https://custom.endpoint/v1" });
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    await vi.waitFor(() => {
      expect(container.textContent).toContain("https://custom.endpoint/v1");
    });
  });

  it("uses origin/v1 as baseUrl in local mode", async () => {
    mockGetHealth.mockResolvedValue({ mode: "local" });
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    await vi.waitFor(() => {
      expect(container.textContent).toContain("/v1");
    });
  });

  it("copies the enable command with full provider JSON via copy button", async () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    await vi.waitFor(() => {
      expect(container.textContent).toContain("openai-completions");
    });
    const copyBtn = container.querySelector(".modal-terminal__copy");
    expect(copyBtn).not.toBeNull();
    fireEvent.click(copyBtn!);
    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
    const calls = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls;
    const copiedText = calls[calls.length - 1][0];
    expect(copiedText).toContain("models.providers.manifest");
    expect(copiedText).toContain("openai-completions");
    expect(copiedText).toContain("mnfst_abc123");
    expect(copiedText).toContain("manifest/auto");
    expect(copiedText).toContain("openclaw gateway restart");
  });

  it("shows mnfst_YOUR_KEY when no keyPrefix or apiKey", async () => {
    mockGetAgentKey.mockResolvedValue({ keyPrefix: null, apiKey: null, pluginEndpoint: null });
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" agentName="test-agent" onClose={() => {}} />
    ));
    await vi.waitFor(() => {
      expect(container.textContent).toContain("mnfst_YOUR_KEY");
    });
  });
});
