import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

vi.stubGlobal("navigator", {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

const mockGetModelPrices = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getModelPrices: () => mockGetModelPrices(),
}));

import RoutingInstructionModal from "../../src/components/RoutingInstructionModal";

const testModels = {
  models: [
    { model_name: "gpt-4o", provider: "OpenAI" },
    { model_name: "claude-sonnet-4", provider: "Anthropic" },
    { model_name: "gemini-2.5-flash", provider: "Google" },
  ],
  lastSyncedAt: "2026-02-28T10:00:00Z",
};

describe("RoutingInstructionModal", () => {
  beforeEach(() => {
    mockGetModelPrices.mockResolvedValue(testModels);
  });

  it("renders nothing when open is false", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={false} mode="enable" onClose={() => {}} />
    ));
    expect(container.querySelector(".modal-overlay")).toBeNull();
  });

  it("shows 'Activate routing' title in enable mode", () => {
    render(() => (
      <RoutingInstructionModal open={true} mode="enable" onClose={() => {}} />
    ));
    expect(screen.getByText("Activate routing")).toBeDefined();
  });

  it("shows manifest/auto command in enable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" onClose={() => {}} />
    ));
    expect(container.textContent).toContain("manifest/auto");
  });

  it("shows 'Deactivate routing' title in disable mode", () => {
    render(() => (
      <RoutingInstructionModal open={true} mode="disable" onClose={() => {}} />
    ));
    expect(screen.getByText("Deactivate routing")).toBeDefined();
  });

  it("shows search input instead of model buttons in disable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="disable" onClose={() => {}} />
    ));
    expect(container.querySelector(".routing-modal__search")).not.toBeNull();
    expect(container.querySelector(".routing-modal__inline-picker")).not.toBeNull();
  });

  it("does not show terminal until a model is selected in disable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="disable" onClose={() => {}} />
    ));
    expect(container.querySelector(".modal-terminal")).toBeNull();
    expect(container.textContent).toContain("Select a model above to see the command");
  });

  it("updates command when a model is selected from dropdown", async () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="disable" onClose={() => {}} />
    ));

    await vi.waitFor(() => {
      expect(container.querySelector(".routing-modal__list")).not.toBeNull();
    });

    const buttons = container.querySelectorAll(".routing-modal__model");
    const gpt4oButton = Array.from(buttons).find((btn) =>
      btn.textContent?.includes("GPT-4o") && !btn.textContent?.includes("Mini"),
    );
    expect(gpt4oButton).toBeDefined();
    fireEvent.click(gpt4oButton!);

    await vi.waitFor(() => {
      expect(container.querySelector(".modal-terminal")).not.toBeNull();
    });
    expect(container.textContent).toContain("openai/gpt-4o");
  });

  it("does not show model picker in enable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" onClose={() => {}} />
    ));
    expect(container.querySelector(".routing-modal__inline-picker")).toBeNull();
  });

  it("shows restart command in enable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" onClose={() => {}} />
    ));
    expect(container.textContent).toContain("openclaw gateway restart");
  });

  it("calls onClose when Done is clicked", () => {
    const onClose = vi.fn();
    render(() => (
      <RoutingInstructionModal open={true} mode="enable" onClose={onClose} />
    ));
    fireEvent.click(screen.getByText("Done"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("has a copy button in enable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" onClose={() => {}} />
    ));
    expect(container.querySelector(".modal-terminal__copy")).not.toBeNull();
  });

  it("shows terminal UI in enable mode", () => {
    const { container } = render(() => (
      <RoutingInstructionModal open={true} mode="enable" onClose={() => {}} />
    ));
    expect(container.querySelector(".modal-terminal")).not.toBeNull();
  });
});
