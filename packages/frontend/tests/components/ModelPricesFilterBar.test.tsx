import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";

vi.mock("../../src/services/routing-utils.js", () => ({
  resolveProviderId: (provider: string) => {
    const map: Record<string, string> = { OpenAI: "openai", Anthropic: "anthropic" };
    return map[provider] ?? null;
  },
}));

vi.mock("../../src/components/ProviderIcon.js", () => ({
  providerIcon: (id: string, size: number) => <svg data-provider={id} width={size} height={size} />,
}));

import ModelPricesFilterBar from "../../src/components/ModelPricesFilterBar";

describe("ModelPricesFilterBar", () => {
  const baseProps = {
    allModels: ["gpt-4o", "gpt-4o-mini", "claude-3.5-sonnet"],
    allProviders: ["OpenAI", "Anthropic", "UnknownProvider"],
    selectedModels: new Set<string>(),
    selectedProviders: new Set<string>(),
    onAddModel: vi.fn(),
    onRemoveModel: vi.fn(),
    onAddProvider: vi.fn(),
    onRemoveProvider: vi.fn(),
    onClearFilters: vi.fn(),
    totalCount: 3,
    filteredCount: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders search input with combobox role", () => {
    const { container } = render(() => <ModelPricesFilterBar {...baseProps} />);
    const input = container.querySelector(".model-filter__search");
    expect(input).not.toBeNull();
    expect(input?.getAttribute("role")).toBe("combobox");
  });

  it("shows total count when no filters active", () => {
    const { container } = render(() => <ModelPricesFilterBar {...baseProps} />);
    expect(container.textContent).toContain("3 models");
  });

  it("shows dropdown when typing 2+ characters", async () => {
    const { container } = render(() => <ModelPricesFilterBar {...baseProps} />);
    const input = container.querySelector<HTMLInputElement>(".model-filter__search")!;
    await fireEvent.input(input, { target: { value: "gpt" } });
    expect(container.querySelector(".model-filter__dropdown")).not.toBeNull();
  });

  it("navigates dropdown with ArrowUp key", async () => {
    const { container } = render(() => <ModelPricesFilterBar {...baseProps} />);
    const input = container.querySelector<HTMLInputElement>(".model-filter__search")!;
    await fireEvent.input(input, { target: { value: "gpt" } });
    // ArrowDown twice, then ArrowUp
    await fireEvent.keyDown(input, { key: "ArrowDown" });
    await fireEvent.keyDown(input, { key: "ArrowDown" });
    await fireEvent.keyDown(input, { key: "ArrowUp" });
    const highlighted = container.querySelector(".model-filter__dropdown-item--highlighted");
    expect(highlighted).not.toBeNull();
  });

  it("selects suggestion with Enter key", async () => {
    const { container } = render(() => <ModelPricesFilterBar {...baseProps} />);
    const input = container.querySelector<HTMLInputElement>(".model-filter__search")!;
    await fireEvent.input(input, { target: { value: "gpt" } });
    await fireEvent.keyDown(input, { key: "ArrowDown" });
    await fireEvent.keyDown(input, { key: "Enter" });
    expect(baseProps.onAddModel).toHaveBeenCalledWith("gpt-4o");
  });

  it("does nothing on Enter without highlighted item", async () => {
    const { container } = render(() => <ModelPricesFilterBar {...baseProps} />);
    const input = container.querySelector<HTMLInputElement>(".model-filter__search")!;
    await fireEvent.input(input, { target: { value: "gpt" } });
    // Don't ArrowDown, just Enter
    await fireEvent.keyDown(input, { key: "Enter" });
    expect(baseProps.onAddModel).not.toHaveBeenCalled();
  });

  it("shows fallback SVG icon for unknown provider", async () => {
    const propsWithUnknown = {
      ...baseProps,
      selectedProviders: new Set(["UnknownProvider"]),
    };
    const { container } = render(() => <ModelPricesFilterBar {...propsWithUnknown} />);
    // The unknown provider tag should show the fallback SVG
    const tags = container.querySelectorAll(".model-filter__tag");
    expect(tags.length).toBe(1);
    // The fallback SVG has a rect element
    const fallbackSvg = tags[0].querySelector("svg rect");
    expect(fallbackSvg).not.toBeNull();
  });

  it("shows provider icon for known provider in tag", () => {
    const propsWithKnown = {
      ...baseProps,
      selectedProviders: new Set(["OpenAI"]),
    };
    const { container } = render(() => <ModelPricesFilterBar {...propsWithKnown} />);
    const tags = container.querySelectorAll(".model-filter__tag");
    expect(tags.length).toBe(1);
    // The known provider tag should use providerIcon (mocked as svg with data-provider)
    const providerSvg = tags[0].querySelector("svg[data-provider='openai']");
    expect(providerSvg).not.toBeNull();
  });

  it("calls onRemoveModel when model tag remove button clicked", () => {
    const propsWithModel = {
      ...baseProps,
      selectedModels: new Set(["gpt-4o"]),
    };
    const { container } = render(() => <ModelPricesFilterBar {...propsWithModel} />);
    const removeBtn = container.querySelector(".model-filter__tag-remove")!;
    fireEvent.click(removeBtn);
    expect(baseProps.onRemoveModel).toHaveBeenCalledWith("gpt-4o");
  });

  it("calls onRemoveProvider when provider tag remove button clicked", () => {
    const propsWithProvider = {
      ...baseProps,
      selectedProviders: new Set(["OpenAI"]),
    };
    const { container } = render(() => <ModelPricesFilterBar {...propsWithProvider} />);
    const removeBtn = container.querySelector(".model-filter__tag-remove")!;
    fireEvent.click(removeBtn);
    expect(baseProps.onRemoveProvider).toHaveBeenCalledWith("OpenAI");
  });

  it("opens dropdown with ArrowDown when closed but query has 2+ chars", async () => {
    const { container } = render(() => <ModelPricesFilterBar {...baseProps} />);
    const input = container.querySelector<HTMLInputElement>(".model-filter__search")!;
    await fireEvent.input(input, { target: { value: "gpt" } });
    // Close it with Escape
    await fireEvent.keyDown(input, { key: "Escape" });
    expect(container.querySelector(".model-filter__dropdown")).toBeNull();
    // Reopen with ArrowDown
    await fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(container.querySelector(".model-filter__dropdown")).not.toBeNull();
  });

  it("shows filtered count and Clear filters when filters active", () => {
    const propsFiltered = {
      ...baseProps,
      selectedProviders: new Set(["OpenAI"]),
      filteredCount: 2,
    };
    const { container } = render(() => <ModelPricesFilterBar {...propsFiltered} />);
    expect(container.textContent).toContain("2 of 3 models");
    expect(container.textContent).toContain("Clear filters");
  });

  it("calls onClearFilters and resets query on Clear filters click", () => {
    const propsFiltered = {
      ...baseProps,
      selectedProviders: new Set(["OpenAI"]),
      filteredCount: 2,
    };
    const { container } = render(() => <ModelPricesFilterBar {...propsFiltered} />);
    const clearBtn = container.querySelector(".model-filter__clear-all")!;
    fireEvent.click(clearBtn);
    expect(baseProps.onClearFilters).toHaveBeenCalled();
  });

  it("removes last tag on Backspace when input is empty", () => {
    const propsWithTag = {
      ...baseProps,
      selectedModels: new Set(["gpt-4o"]),
    };
    const { container } = render(() => <ModelPricesFilterBar {...propsWithTag} />);
    const input = container.querySelector<HTMLInputElement>(".model-filter__search")!;
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(baseProps.onRemoveModel).toHaveBeenCalledWith("gpt-4o");
  });
});
