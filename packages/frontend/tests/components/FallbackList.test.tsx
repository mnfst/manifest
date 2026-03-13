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

vi.mock("../../src/components/AuthBadge.js", () => ({
  authBadgeFor: () => null,
}));

vi.mock("../../src/services/providers.js", () => ({
  PROVIDERS: [
    { id: "openai", name: "OpenAI" },
    { id: "anthropic", name: "Anthropic" },
  ],
}));

vi.mock("../../src/services/routing-utils.js", () => ({
  resolveProviderId: (p: string) => p.toLowerCase(),
  stripCustomPrefix: (m: string) => m.replace(/^custom:[^/]+\//, ""),
}));

vi.mock("../../src/services/provider-utils.js", () => ({
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
  connectedProviders: [
    { provider: "openai", auth_type: "api_key", is_active: true },
    { provider: "anthropic", auth_type: "subscription", is_active: true },
  ] as any[],
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

    expect(screen.getByText("No fallback")).toBeDefined();
    expect(container.querySelector(".fallback-list__empty")).not.toBeNull();
    expect(container.querySelector(".fallback-list__items")).toBeNull();
  });

  it("renders fallback items with numbered list", () => {
    const { container } = render(() => (
      <FallbackList {...defaultProps} fallbacks={["model-a", "model-b"]} />
    ));

    const ranks = container.querySelectorAll(".fallback-list__rank");
    expect(ranks.length).toBe(2);
    expect(ranks[0].textContent).toBe("1");
    expect(ranks[1].textContent).toBe("2");

    const modelLabels = container.querySelectorAll(".fallback-list__model");
    expect(modelLabels.length).toBe(2);
  });

  it("calls onAddFallback when add button in empty state clicked", () => {
    const onAddFallback = vi.fn();
    const { container } = render(() => (
      <FallbackList {...defaultProps} fallbacks={[]} onAddFallback={onAddFallback} />
    ));

    const addBtn = container.querySelector(".fallback-list__empty .fallback-list__add") as HTMLButtonElement;
    fireEvent.click(addBtn);
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

  it("reverts optimistic removal when setFallbacks rejects", async () => {
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
    // First call: optimistic removal, second call: revert with original list
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenNthCalledWith(1, ["model-b"]);
    expect(onUpdate).toHaveBeenNthCalledWith(2, ["model-a", "model-b"]);
  });

  it("reverts optimistic removal when clearFallbacks rejects", async () => {
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
    // First call: optimistic removal, second call: revert with original list
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenNthCalledWith(1, []);
    expect(onUpdate).toHaveBeenNthCalledWith(2, ["model-a"]);
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

  it("empty state uses fallback-list__empty class for consistent styling", () => {
    const { container } = render(() => (
      <FallbackList {...defaultProps} fallbacks={[]} />
    ));

    const emptyBtn = container.querySelector(".fallback-list__empty");
    expect(emptyBtn).not.toBeNull();
  });

  it("shows add button with fallback-list__add class when fallbacks exist", () => {
    const { container } = render(() => (
      <FallbackList {...defaultProps} fallbacks={["model-a"]} />
    ));

    const addBtn = container.querySelector(".fallback-list__add");
    expect(addBtn).not.toBeNull();
  });

  it("disables add button in empty state when adding prop is true", () => {
    const { container } = render(() => (
      <FallbackList {...defaultProps} fallbacks={[]} adding={true} />
    ));

    const addBtn = container.querySelector(".fallback-list__empty .fallback-list__add") as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
  });

  it("enables add button in empty state when adding is false", () => {
    const { container } = render(() => (
      <FallbackList {...defaultProps} fallbacks={[]} adding={false} />
    ));

    const addBtn = container.querySelector(".fallback-list__empty .fallback-list__add") as HTMLButtonElement;
    expect(addBtn.disabled).toBe(false);
  });

  it("disables all remove buttons during async removal", async () => {
    let resolveRemove: () => void;
    mockSetFallbacks.mockReturnValueOnce(new Promise<void>((r) => { resolveRemove = r; }));
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["model-a", "model-b"]}
      />
    ));

    const removeButtons = container.querySelectorAll(".fallback-list__remove");
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      const btns = container.querySelectorAll(".fallback-list__remove");
      // Both buttons should be disabled
      expect((btns[0] as HTMLButtonElement).disabled).toBe(true);
      expect((btns[1] as HTMLButtonElement).disabled).toBe(true);
      // The one being removed shows a spinner
      expect(btns[0].querySelector(".spinner")).not.toBeNull();
      // The other still shows a close (x) SVG
      expect(btns[1].querySelector("svg")).not.toBeNull();
    });

    resolveRemove!();

    await waitFor(() => {
      const btns = container.querySelectorAll(".fallback-list__remove");
      // After resolve, buttons should be re-enabled
      expect((btns[0] as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it("disables add button during removal", async () => {
    let resolveRemove: () => void;
    mockSetFallbacks.mockReturnValueOnce(new Promise<void>((r) => { resolveRemove = r; }));
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["model-a", "model-b"]}
      />
    ));

    const removeButtons = container.querySelectorAll(".fallback-list__remove");
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      const addBtn = screen.getByText("+ Add fallback");
      expect((addBtn as HTMLButtonElement).disabled).toBe(true);
    });

    resolveRemove!();
  });

  it("renders auth badge on fallback icon via authBadgeFor", () => {
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["model-a"]}
      />
    ));

    const iconSpan = container.querySelector(".fallback-list__icon");
    expect(iconSpan).not.toBeNull();
    // title should show "OpenAI (API Key)" since model-a → openai → api_key
    expect(iconSpan?.getAttribute("title")).toBe("OpenAI (API Key)");
  });

  it("renders subscription title on fallback icon", () => {
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["model-b"]}
      />
    ));

    const iconSpan = container.querySelector(".fallback-list__icon");
    expect(iconSpan?.getAttribute("title")).toBe("Anthropic (Subscription)");
  });

  it("returns null auth type when provider not in connectedProviders", () => {
    const modelsUnknown = [
      { model_name: "model-x", provider: "Unknown" },
    ] as any[];
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["model-x"]}
        models={modelsUnknown}
        connectedProviders={[]}
      />
    ));

    const iconSpan = container.querySelector(".fallback-list__icon");
    // Provider "unknown" not in PROVIDERS mock, so providerTitle falls back to providerId
    expect(iconSpan?.getAttribute("title")).toBe("unknown (API Key)");
  });

  it("clears removingIndex after failed removal", async () => {
    mockSetFallbacks.mockRejectedValueOnce(new Error("API error"));
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["model-a", "model-b"]}
      />
    ));

    const removeButtons = container.querySelectorAll(".fallback-list__remove");
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(mockSetFallbacks).toHaveBeenCalled();
    });

    // After error, buttons should be re-enabled (removingIndex cleared in finally)
    await waitFor(() => {
      const btns = container.querySelectorAll(".fallback-list__remove");
      expect((btns[0] as HTMLButtonElement).disabled).toBe(false);
    });
  });
});
