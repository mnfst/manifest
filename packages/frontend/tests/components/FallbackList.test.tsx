import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";

const mockSetFallbacks = vi.fn();
const mockClearFallbacks = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  setFallbacks: (...args: unknown[]) => mockSetFallbacks(...args),
  clearFallbacks: (...args: unknown[]) => mockClearFallbacks(...args),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../src/components/ProviderIcon.js", () => ({
  providerIcon: () => null,
}));

vi.mock("../../src/services/routing-utils.js", () => ({
  resolveProviderId: (p: string) => p.toLowerCase(),
  stripCustomPrefix: (m: string) => m.replace(/^custom:[^/]+\//, ""),
}));

vi.mock("../../src/services/providers.js", () => ({
  getModelLabel: (_providerId: string, model: string) => model,
}));

import FallbackList from "../../src/components/FallbackList";

const models = [
  { model_name: "model-a", provider: "OpenAI" },
  { model_name: "model-b", provider: "Anthropic" },
] as any[];

const defaultProps = {
  agentName: "test-agent",
  tier: "tier-1",
  fallbacks: [] as string[],
  models,
  customProviders: [] as any[],
  onUpdate: vi.fn(),
  onAddFallback: vi.fn(),
};

describe("FallbackList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetFallbacks.mockResolvedValue(undefined);
    mockClearFallbacks.mockResolvedValue(undefined);
  });

  it("renders empty state when no fallbacks", () => {
    const { container } = render(() => (
      <FallbackList {...defaultProps} fallbacks={[]} />
    ));

    expect(screen.getByText("+ Add fallback")).toBeDefined();
    expect(container.querySelector(".fallback-list__items")).toBeNull();
  });

  it("renders fallback items with numbered list", () => {
    const { container } = render(() => (
      <FallbackList {...defaultProps} fallbacks={["model-a", "model-b"]} />
    ));

    const ranks = container.querySelectorAll(".fallback-list__rank");
    expect(ranks.length).toBe(2);
    expect(ranks[0].textContent).toBe("1.");
    expect(ranks[1].textContent).toBe("2.");

    const modelLabels = container.querySelectorAll(".fallback-list__model");
    expect(modelLabels.length).toBe(2);
  });

  it("calls onAddFallback when add button clicked", () => {
    const onAddFallback = vi.fn();
    render(() => (
      <FallbackList {...defaultProps} fallbacks={[]} onAddFallback={onAddFallback} />
    ));

    fireEvent.click(screen.getByText("+ Add fallback"));
    expect(onAddFallback).toHaveBeenCalledTimes(1);
  });

  it("hides add button when 5 fallbacks exist", () => {
    const fiveFallbacks = ["m1", "m2", "m3", "m4", "m5"];
    render(() => (
      <FallbackList {...defaultProps} fallbacks={fiveFallbacks} />
    ));

    expect(screen.queryByText("+ Add fallback")).toBeNull();
  });

  it("calls setFallbacks on remove with remaining items", async () => {
    const onUpdate = vi.fn();
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["model-a", "model-b"]}
        onUpdate={onUpdate}
      />
    ));

    const removeButtons = container.querySelectorAll(".fallback-list__remove");
    expect(removeButtons.length).toBe(2);

    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(mockSetFallbacks).toHaveBeenCalledWith("test-agent", "tier-1", ["model-b"]);
      expect(onUpdate).toHaveBeenCalled();
    });
    expect(mockClearFallbacks).not.toHaveBeenCalled();
  });

  it("calls clearFallbacks on remove of last item", async () => {
    const onUpdate = vi.fn();
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["model-a"]}
        onUpdate={onUpdate}
      />
    ));

    const removeButtons = container.querySelectorAll(".fallback-list__remove");
    expect(removeButtons.length).toBe(1);

    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(mockClearFallbacks).toHaveBeenCalledWith("test-agent", "tier-1");
      expect(onUpdate).toHaveBeenCalled();
    });
    expect(mockSetFallbacks).not.toHaveBeenCalled();
  });

  it("does not call onUpdate when setFallbacks rejects", async () => {
    mockSetFallbacks.mockRejectedValue(new Error("API error"));
    const onUpdate = vi.fn();
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["model-a", "model-b"]}
        onUpdate={onUpdate}
      />
    ));

    const removeButtons = container.querySelectorAll(".fallback-list__remove");
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(mockSetFallbacks).toHaveBeenCalled();
    });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("does not call onUpdate when clearFallbacks rejects", async () => {
    mockClearFallbacks.mockRejectedValue(new Error("API error"));
    const onUpdate = vi.fn();
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["model-a"]}
        onUpdate={onUpdate}
      />
    ));

    const removeButtons = container.querySelectorAll(".fallback-list__remove");
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(mockClearFallbacks).toHaveBeenCalled();
    });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("displays display_name when model info has one", () => {
    const modelsWithDisplay = [
      { model_name: "model-a", provider: "OpenAI", display_name: "Model Alpha" },
    ] as any[];
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["model-a"]}
        models={modelsWithDisplay}
      />
    ));

    const modelLabel = container.querySelector(".fallback-list__model");
    expect(modelLabel?.textContent).toBe("Model Alpha");
  });

  it("falls back to getModelLabel when model has no display_name but has provider", () => {
    const modelsNoDisplay = [
      { model_name: "model-a", provider: "OpenAI" },
    ] as any[];
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["model-a"]}
        models={modelsNoDisplay}
      />
    ));

    const modelLabel = container.querySelector(".fallback-list__model");
    // getModelLabel mock returns model as-is
    expect(modelLabel?.textContent).toBe("model-a");
  });

  it("falls back to stripCustomPrefix when model not found in models list", () => {
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["custom:prov/unknown-model"]}
        models={[]}
      />
    ));

    const modelLabel = container.querySelector(".fallback-list__model");
    expect(modelLabel?.textContent).toBe("unknown-model");
  });

  it("shows custom provider icon letter for custom provider models", () => {
    const customProviders = [{ id: "cp-1", name: "Groq" }] as any[];
    const modelsWithCustom = [
      { model_name: "custom-model", provider: "custom:cp-1" },
    ] as any[];
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["custom-model"]}
        models={modelsWithCustom}
        customProviders={customProviders}
      />
    ));

    const letterIcon = container.querySelector(".provider-card__logo-letter");
    expect(letterIcon).not.toBeNull();
    expect(letterIcon?.textContent).toBe("G");
  });

  it("uses 'C' as default letter when custom provider not found", () => {
    const modelsWithCustom = [
      { model_name: "custom-model", provider: "custom:unknown-id" },
    ] as any[];
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["custom-model"]}
        models={modelsWithCustom}
        customProviders={[]}
      />
    ));

    const letterIcon = container.querySelector(".provider-card__logo-letter");
    expect(letterIcon).not.toBeNull();
    expect(letterIcon?.textContent).toBe("C");
  });

  it("shows provider icon for non-custom providers", () => {
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["model-a"]}
      />
    ));

    // Provider icon renders in .fallback-list__icon span (providerIcon returns null in mock,
    // but the wrapper span should exist since provId() is defined and not custom)
    const iconSpans = container.querySelectorAll(".fallback-list__icon");
    expect(iconSpans.length).toBeGreaterThanOrEqual(1);
  });

  it("shows add button when fewer than 5 fallbacks", () => {
    render(() => (
      <FallbackList {...defaultProps} fallbacks={["model-a", "model-b"]} />
    ));

    expect(screen.getByText("+ Add fallback")).toBeDefined();
  });

  it("sets aria-label on remove buttons with model label", () => {
    const modelsWithDisplay = [
      { model_name: "model-a", provider: "OpenAI", display_name: "Model Alpha" },
    ] as any[];
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["model-a"]}
        models={modelsWithDisplay}
      />
    ));

    const removeBtn = container.querySelector(".fallback-list__remove");
    expect(removeBtn?.getAttribute("aria-label")).toBe("Remove Model Alpha");
  });

  it("add button uses routing-action class for consistent styling", () => {
    const { container } = render(() => (
      <FallbackList {...defaultProps} fallbacks={[]} />
    ));

    const addBtn = container.querySelector(".fallback-list__add");
    expect(addBtn).not.toBeNull();
    expect(addBtn!.classList.contains("routing-action")).toBe(true);
  });
});
