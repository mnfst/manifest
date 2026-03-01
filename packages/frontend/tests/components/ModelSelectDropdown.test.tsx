import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

const mockGetModelPrices = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getModelPrices: () => mockGetModelPrices(),
}));

import ModelSelectDropdown from "../../src/components/ModelSelectDropdown";
import { computeCliValue, labelForModel } from "../../src/components/ModelSelectDropdown";

const testModels = {
  models: [
    { model_name: "gpt-4o", provider: "OpenAI" },
    { model_name: "gpt-4o-mini", provider: "OpenAI" },
    { model_name: "claude-sonnet-4", provider: "Anthropic" },
    { model_name: "gemini-2.5-flash", provider: "Google" },
    { model_name: "deepseek-chat", provider: "DeepSeek" },
  ],
  lastSyncedAt: "2026-02-28T10:00:00Z",
};

async function renderAndWait(props?: Partial<{ selectedValue: string | null; onSelect: (v: string, l: string) => void }>) {
  const result = render(() => (
    <ModelSelectDropdown
      selectedValue={props?.selectedValue ?? null}
      onSelect={props?.onSelect ?? (() => {})}
    />
  ));
  await vi.waitFor(() => {
    expect(result.container.querySelector(".routing-modal__list")).not.toBeNull();
  });
  return result;
}

describe("ModelSelectDropdown", () => {
  beforeEach(() => {
    mockGetModelPrices.mockResolvedValue(testModels);
  });

  it("renders search input and model groups after load", async () => {
    const { container } = await renderAndWait();
    expect(container.querySelector(".routing-modal__search")).not.toBeNull();
    const groups = container.querySelectorAll(".routing-modal__group");
    expect(groups.length).toBeGreaterThanOrEqual(3);
  });

  it("filters models by model name", async () => {
    const { container } = await renderAndWait();
    const input = container.querySelector(".routing-modal__search") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "claude" } });

    await vi.waitFor(() => {
      const labels = container.querySelectorAll(".routing-modal__model-label");
      const labelTexts = Array.from(labels).map((el) => el.textContent);
      expect(labelTexts.some((t) => t?.toLowerCase().includes("claude") || t?.toLowerCase().includes("sonnet"))).toBe(true);
    });

    // Should not show unrelated models
    const allLabels = container.querySelectorAll(".routing-modal__model-label");
    const allTexts = Array.from(allLabels).map((el) => el.textContent);
    expect(allTexts.some((t) => t === "GPT-4o")).toBe(false);
  });

  it("filters models by provider name", async () => {
    const { container } = await renderAndWait();
    const input = container.querySelector(".routing-modal__search") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "deepseek" } });

    await vi.waitFor(() => {
      const groups = container.querySelectorAll(".routing-modal__group");
      expect(groups.length).toBe(1);
    });

    const models = container.querySelectorAll(".routing-modal__model");
    expect(models.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onSelect with correct CLI value when model is clicked", async () => {
    const onSelect = vi.fn();
    const { container } = await renderAndWait({ onSelect });

    const buttons = container.querySelectorAll(".routing-modal__model");
    const gpt4oButton = Array.from(buttons).find((btn) =>
      btn.textContent?.includes("GPT-4o") && !btn.textContent?.includes("Mini"),
    );
    expect(gpt4oButton).toBeDefined();
    fireEvent.click(gpt4oButton!);

    expect(onSelect).toHaveBeenCalledWith("openai/gpt-4o", "GPT-4o");
  });

  it("shows empty state when no models match search", async () => {
    const { container } = await renderAndWait();
    const input = container.querySelector(".routing-modal__search") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "zzzznonexistent" } });

    await vi.waitFor(() => {
      expect(container.querySelector(".routing-modal__empty")).not.toBeNull();
    });
    expect(container.querySelector(".routing-modal__empty")?.textContent).toContain("No models match");
  });

  it("shows loading state while fetching", () => {
    mockGetModelPrices.mockReturnValue(new Promise(() => {}));
    const { container } = render(() => (
      <ModelSelectDropdown selectedValue={null} onSelect={() => {}} />
    ));
    expect(container.textContent).toContain("Loading models...");
  });

  it("shows selected display after selecting a model, and reopens on click", async () => {
    const onSelect = vi.fn();
    const { container } = await renderAndWait({ onSelect });

    // Click a model to select it
    const buttons = container.querySelectorAll(".routing-modal__model");
    const gpt4oButton = Array.from(buttons).find((btn) =>
      btn.textContent?.includes("GPT-4o") && !btn.textContent?.includes("Mini"),
    );
    fireEvent.click(gpt4oButton!);

    // After selection, the dropdown closes and shows the selected display
    // Re-render with selectedValue set (simulating parent state update)
    const { container: container2 } = render(() => (
      <ModelSelectDropdown selectedValue="openai/gpt-4o" onSelect={onSelect} />
    ));

    // Wait for data to load, then select a model to close the picker
    await vi.waitFor(() => {
      expect(container2.querySelector(".routing-modal__list")).not.toBeNull();
    });
    const btns2 = container2.querySelectorAll(".routing-modal__model");
    fireEvent.click(btns2[0]!);

    // Now the selected display should be visible
    await vi.waitFor(() => {
      expect(container2.querySelector(".routing-modal__selected-display")).not.toBeNull();
    });
    expect(container2.textContent).toContain("Click to change");

    // Click it to reopen
    fireEvent.click(container2.querySelector(".routing-modal__selected-display")!);
    await vi.waitFor(() => {
      expect(container2.querySelector(".routing-modal__search")).not.toBeNull();
    });
  });
});

describe("computeCliValue", () => {
  it("prefixes provider for regular models", () => {
    expect(computeCliValue("gpt-4o", "OpenAI")).toBe("openai/gpt-4o");
  });

  it("keeps model as-is when it already contains a slash", () => {
    expect(computeCliValue("openrouter/auto", "OpenRouter")).toBe("openrouter/auto");
  });
});

describe("labelForModel", () => {
  it("resolves known model names to display labels", () => {
    expect(labelForModel("gpt-4o")).toBe("GPT-4o");
    expect(labelForModel("claude-sonnet-4")).toBe("Claude Sonnet 4");
  });

  it("returns the name as-is for unknown models", () => {
    expect(labelForModel("unknown-model-xyz")).toBe("unknown-model-xyz");
  });

  it("resolves slash-prefixed model names by stripping the prefix", () => {
    expect(labelForModel("openai/gpt-4o")).toBe("GPT-4o");
    expect(labelForModel("anthropic/claude-sonnet-4")).toBe("Claude Sonnet 4");
  });

  it("returns bare name for unknown slash-prefixed models", () => {
    expect(labelForModel("vendor/unknown-xyz")).toBe("unknown-xyz");
  });
});
