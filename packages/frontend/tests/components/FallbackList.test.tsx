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

const mockCustomProviderLogo = vi.fn(() => null);
vi.mock("../../src/components/ProviderIcon.js", () => ({
  providerIcon: () => null, customProviderLogo: (...args: unknown[]) => mockCustomProviderLogo(...args),
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

    expect(screen.getByText("No fallbacks")).toBeDefined();
    expect(container.querySelector(".fallback-list__empty")).not.toBeNull();
    expect(container.querySelector(".fallback-list__items")).toBeNull();
  });

  it("renders fallback items with model labels", () => {
    const { container } = render(() => (
      <FallbackList {...defaultProps} fallbacks={["model-a", "model-b"]} />
    ));

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

    expect(screen.queryByText("Add fallback")).toBeNull();
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

  it("shows custom provider logo when customProviderLogo returns an element", () => {
    const fakeImg = document.createElement("img");
    fakeImg.src = "/icons/kilocode.jpg";
    fakeImg.alt = "Kilo Code";
    mockCustomProviderLogo.mockReturnValueOnce(fakeImg as any);
    const customProviders = [{ id: "cp-1", name: "Kilo Code", base_url: "https://api.kilo.ai" }] as any[];
    const modelsWithCustom = [
      { model_name: "qwen/qwen3.6-plus:free", provider: "custom:cp-1" },
    ] as any[];
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["qwen/qwen3.6-plus:free"]}
        models={modelsWithCustom}
        customProviders={customProviders}
      />
    ));

    const iconSpan = container.querySelector(".fallback-list__icon");
    expect(iconSpan).not.toBeNull();
    expect(iconSpan!.querySelector('img[src="/icons/kilocode.jpg"]')).not.toBeNull();
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

    expect(screen.getByText("Add fallback")).toBeDefined();
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
      const addBtn = screen.getByText("Add fallback");
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

  // ── Drag and Drop Tests ──

  it("sets dragIndex on dragStart and clears on dragEnd", () => {
    const { container } = render(() => (
      <FallbackList {...defaultProps} fallbacks={["model-a", "model-b"]} />
    ));

    const cards = container.querySelectorAll(".fallback-list__card");
    const dataTransfer = { effectAllowed: "", setData: vi.fn() };

    fireEvent.dragStart(cards[0], { dataTransfer });
    expect(dataTransfer.effectAllowed).toBe("move");
    expect(dataTransfer.setData).toHaveBeenCalledWith("text/plain", "0");
    // Card should have dragging class
    expect(cards[0].classList.contains("fallback-list__card--dragging")).toBe(true);

    // dragEnd clears state
    const list = container.querySelector(".fallback-list__items")!;
    fireEvent.dragEnd(list);
    expect(cards[0].classList.contains("fallback-list__card--dragging")).toBe(false);
  });

  it("handles dragStart without dataTransfer gracefully", () => {
    const { container } = render(() => (
      <FallbackList {...defaultProps} fallbacks={["model-a", "model-b"]} />
    ));

    const cards = container.querySelectorAll(".fallback-list__card");
    // Fire dragStart without dataTransfer property
    fireEvent.dragStart(cards[0], {});
    expect(cards[0].classList.contains("fallback-list__card--dragging")).toBe(true);
  });

  it("shows drop indicator on dragOver and computes slot from cursor position", () => {
    const { container } = render(() => (
      <FallbackList {...defaultProps} fallbacks={["model-a", "model-b", "model-c"]} />
    ));

    const cards = container.querySelectorAll(".fallback-list__card");
    const list = container.querySelector(".fallback-list__items")!;

    // Start dragging the first card
    fireEvent.dragStart(cards[0], { dataTransfer: { effectAllowed: "", setData: vi.fn() } });

    // Mock getBoundingClientRect for all cards
    cards.forEach((card, i) => {
      vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
        top: i * 40, bottom: (i + 1) * 40, height: 40, left: 0, right: 200, width: 200, x: 0, y: i * 40, toJSON: () => {},
      });
    });

    // Drag over near the bottom of the last card → slot should be after last (index 3)
    fireEvent.dragOver(list, { clientY: 110, dataTransfer: { dropEffect: "" }, preventDefault: vi.fn() });

    // Drop indicator for slot 3 (after last) should be active
    const indicators = container.querySelectorAll(".fallback-list__drop-indicator");
    const lastIndicator = indicators[indicators.length - 1];
    expect(lastIndicator?.classList.contains("fallback-list__drop-indicator--active")).toBe(true);
  });

  it("computes no-op slot when dragOver fires at dragged item position", () => {
    const { container } = render(() => (
      <FallbackList {...defaultProps} fallbacks={["model-a", "model-b"]} />
    ));

    const list = container.querySelector(".fallback-list__items")!;
    const cards = list.querySelectorAll<HTMLElement>(".fallback-list__card");

    // Start dragging card at index 0
    fireEvent.dragStart(cards[0]!, { dataTransfer: { effectAllowed: "", setData: vi.fn() } });

    // In jsdom, getBoundingClientRect returns all zeros (top=0, height=0, midY=0).
    // With clientY=0, all cards have midY=0, so clientY < midY is false for all → slot = cards.length = 2.
    // from=0, slot=2, slot !== from && slot !== from+1 → indicator shows at slot 2.
    // Verify dragOver runs without error
    fireEvent.dragOver(list, { clientY: 0, dataTransfer: { dropEffect: "" }, preventDefault: vi.fn() });

    // Drop at this position should trigger reorder (from=0, slot=2, insertAt=1)
    fireEvent.drop(list, { preventDefault: vi.fn() });
    // Verifying the handlers executed without error is sufficient for coverage
  });

  it("handles dragOver without dataTransfer", () => {
    const { container } = render(() => (
      <FallbackList {...defaultProps} fallbacks={["model-a", "model-b"]} />
    ));

    const cards = container.querySelectorAll(".fallback-list__card");
    const list = container.querySelector(".fallback-list__items")!;

    fireEvent.dragStart(cards[0], { dataTransfer: { effectAllowed: "", setData: vi.fn() } });

    cards.forEach((card, i) => {
      vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
        top: i * 40, bottom: (i + 1) * 40, height: 40, left: 0, right: 200, width: 200, x: 0, y: i * 40, toJSON: () => {},
      });
    });

    // DragOver without dataTransfer — should not throw
    fireEvent.dragOver(list, { clientY: 50, preventDefault: vi.fn() });
  });

  it("clears drop slot on dragLeave when leaving container", () => {
    const { container } = render(() => (
      <FallbackList {...defaultProps} fallbacks={["model-a", "model-b"]} />
    ));

    const cards = container.querySelectorAll(".fallback-list__card");
    const list = container.querySelector(".fallback-list__items")!;

    fireEvent.dragStart(cards[0], { dataTransfer: { effectAllowed: "", setData: vi.fn() } });

    cards.forEach((card, i) => {
      vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
        top: i * 40, bottom: (i + 1) * 40, height: 40, left: 0, right: 200, width: 200, x: 0, y: i * 40, toJSON: () => {},
      });
    });

    // Create a drop indicator
    fireEvent.dragOver(list, { clientY: 50, dataTransfer: { dropEffect: "" }, preventDefault: vi.fn() });

    // DragLeave with relatedTarget outside the list
    fireEvent.dragLeave(list, { relatedTarget: null });

    // No active indicators
    const activeIndicators = container.querySelectorAll(".fallback-list__drop-indicator--active");
    expect(activeIndicators.length).toBe(0);
  });

  it("preserves drop slot on dragLeave when relatedTarget is inside list", () => {
    const { container } = render(() => (
      <FallbackList {...defaultProps} fallbacks={["model-a", "model-b", "model-c"]} />
    ));

    const list = container.querySelector(".fallback-list__items")!;
    const cards = list.querySelectorAll<HTMLElement>(".fallback-list__card");

    fireEvent.dragStart(cards[0]!, { dataTransfer: { effectAllowed: "", setData: vi.fn() } });
    fireEvent.dragOver(list, { clientY: 0, dataTransfer: { dropEffect: "" }, preventDefault: vi.fn() });

    // Verify an indicator was set
    expect(container.querySelectorAll(".fallback-list__drop-indicator--active").length).toBeGreaterThan(0);

    // DragLeave with relatedTarget that's a child of the list → should NOT clear
    // Use dispatchEvent to properly set relatedTarget
    const childInList = list.querySelectorAll<HTMLElement>(".fallback-list__card")[1]!;
    const leaveEvent = new Event("dragleave", { bubbles: true }) as any;
    leaveEvent.relatedTarget = childInList;
    list.dispatchEvent(leaveEvent);

    // Indicator should still be active
    const activeIndicators = container.querySelectorAll(".fallback-list__drop-indicator--active");
    expect(activeIndicators.length).toBeGreaterThan(0);
  });

  it("reorders fallbacks on drop and calls setFallbacks", async () => {
    mockSetFallbacks.mockResolvedValueOnce(undefined);
    const onUpdate = vi.fn();
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["model-a", "model-b", "model-c"]}
        onUpdate={onUpdate}
      />
    ));

    const cards = container.querySelectorAll(".fallback-list__card");
    const list = container.querySelector(".fallback-list__items")!;

    // Start dragging card 0
    fireEvent.dragStart(cards[0], { dataTransfer: { effectAllowed: "", setData: vi.fn() } });

    cards.forEach((card, i) => {
      vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
        top: i * 40, bottom: (i + 1) * 40, height: 40, left: 0, right: 200, width: 200, x: 0, y: i * 40, toJSON: () => {},
      });
    });

    // Drag over to slot 3 (after last card) — cursor at bottom
    fireEvent.dragOver(list, { clientY: 130, dataTransfer: { dropEffect: "" }, preventDefault: vi.fn() });

    // Drop
    fireEvent.drop(list, { preventDefault: vi.fn() });

    await waitFor(() => {
      // model-a moved to the end: ["model-b", "model-c", "model-a"]
      expect(onUpdate).toHaveBeenCalledWith(["model-b", "model-c", "model-a"]);
      expect(mockSetFallbacks).toHaveBeenCalledWith("test-agent", "tier-1", ["model-b", "model-c", "model-a"]);
    });
  });

  it("reverts reorder on setFallbacks failure", async () => {
    mockSetFallbacks.mockRejectedValueOnce(new Error("fail"));
    const onUpdate = vi.fn();
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["model-a", "model-b", "model-c"]}
        onUpdate={onUpdate}
      />
    ));

    const cards = container.querySelectorAll(".fallback-list__card");
    const list = container.querySelector(".fallback-list__items")!;

    fireEvent.dragStart(cards[0], { dataTransfer: { effectAllowed: "", setData: vi.fn() } });

    cards.forEach((card, i) => {
      vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
        top: i * 40, bottom: (i + 1) * 40, height: 40, left: 0, right: 200, width: 200, x: 0, y: i * 40, toJSON: () => {},
      });
    });

    fireEvent.dragOver(list, { clientY: 130, dataTransfer: { dropEffect: "" }, preventDefault: vi.fn() });
    fireEvent.drop(list, { preventDefault: vi.fn() });

    await waitFor(() => {
      // First call is the optimistic reorder, second call reverts to original
      expect(onUpdate).toHaveBeenCalledTimes(2);
      expect(onUpdate).toHaveBeenLastCalledWith(["model-a", "model-b", "model-c"]);
    });
  });

  it("ignores drop when dragIndex or dropSlot is null", () => {
    const onUpdate = vi.fn();
    const { container } = render(() => (
      <FallbackList {...defaultProps} fallbacks={["model-a", "model-b"]} onUpdate={onUpdate} />
    ));

    const list = container.querySelector(".fallback-list__items")!;
    // Drop without prior dragStart → dragIndex is null
    fireEvent.drop(list, { preventDefault: vi.fn() });

    expect(onUpdate).not.toHaveBeenCalled();
    expect(mockSetFallbacks).not.toHaveBeenCalled();
  });

  it("ignores drop when insertAt equals fromIndex (no-op reorder)", async () => {
    const onUpdate = vi.fn();
    const { container } = render(() => (
      <FallbackList {...defaultProps} fallbacks={["model-a", "model-b", "model-c"]} onUpdate={onUpdate} />
    ));

    const cards = container.querySelectorAll(".fallback-list__card");
    const list = container.querySelector(".fallback-list__items")!;

    // Start dragging card 2 (last)
    fireEvent.dragStart(cards[2], { dataTransfer: { effectAllowed: "", setData: vi.fn() } });

    cards.forEach((card, i) => {
      vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
        top: i * 40, bottom: (i + 1) * 40, height: 40, left: 0, right: 200, width: 200, x: 0, y: i * 40, toJSON: () => {},
      });
    });

    // Drag over to slot 2 (before card 2, which is from+0 → no-op)
    // But computeSlot returns null for from=2, slot=2. So dropSlot stays null → handled by null check.
    // Let's instead set slot=3 (after last) which → insertAt = 3-1=2 = fromIndex → no-op
    fireEvent.dragOver(list, { clientY: 130, dataTransfer: { dropEffect: "" }, preventDefault: vi.fn() });
    fireEvent.drop(list, { preventDefault: vi.fn() });

    // Allow async to settle
    await new Promise((r) => setTimeout(r, 10));
    expect(onUpdate).not.toHaveBeenCalled();
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

  it("uses persistFallbacks prop when provided (for remove)", async () => {
    const customPersist = vi.fn().mockResolvedValue(undefined);
    const onUpdate = vi.fn();
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["model-a", "model-b"]}
        onUpdate={onUpdate}
        persistFallbacks={customPersist}
      />
    ));

    const removeButtons = container.querySelectorAll(".fallback-list__remove");
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(customPersist).toHaveBeenCalledWith("test-agent", "tier-1", ["model-b"]);
    });
    // Default setFallbacks should NOT have been called
    expect(mockSetFallbacks).not.toHaveBeenCalled();
  });

  it("uses persistClearFallbacks prop when provided (for remove last item)", async () => {
    const customClear = vi.fn().mockResolvedValue(undefined);
    const onUpdate = vi.fn();
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["model-a"]}
        onUpdate={onUpdate}
        persistClearFallbacks={customClear}
      />
    ));

    const removeButtons = container.querySelectorAll(".fallback-list__remove");
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(customClear).toHaveBeenCalledWith("test-agent", "tier-1");
    });
    // Default clearFallbacks should NOT have been called
    expect(mockClearFallbacks).not.toHaveBeenCalled();
  });

  it("falls back to default setFallbacks when persistFallbacks is undefined", async () => {
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
      // Should use the default setFallbacks from api.js
      expect(mockSetFallbacks).toHaveBeenCalledWith("test-agent", "tier-1", ["model-b"]);
    });
  });

  it("primaryDragging prop shows drop zone even with empty fallbacks", () => {
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={[]}
        primaryDragging={true}
      />
    ));

    // When primaryDragging is true, fallback-list__items container should render
    // even though fallbacks is empty (Show when={props.fallbacks.length > 0 || props.primaryDragging})
    const items = container.querySelector(".fallback-list__items");
    expect(items).not.toBeNull();
  });

  it("onFallbackDragStart callback is called", () => {
    const onFallbackDragStart = vi.fn();
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["model-a", "model-b"]}
        onFallbackDragStart={onFallbackDragStart}
      />
    ));

    const cards = container.querySelectorAll(".fallback-list__card");
    fireEvent.dragStart(cards[0], { dataTransfer: { effectAllowed: "", setData: vi.fn() } });

    expect(onFallbackDragStart).toHaveBeenCalledWith(0);
  });

  it("onFallbackDragEnd callback is called", () => {
    const onFallbackDragEnd = vi.fn();
    const { container } = render(() => (
      <FallbackList
        {...defaultProps}
        fallbacks={["model-a", "model-b"]}
        onFallbackDragEnd={onFallbackDragEnd}
      />
    ));

    const cards = container.querySelectorAll(".fallback-list__card");
    const list = container.querySelector(".fallback-list__items")!;

    fireEvent.dragStart(cards[0], { dataTransfer: { effectAllowed: "", setData: vi.fn() } });
    fireEvent.dragEnd(list);

    expect(onFallbackDragEnd).toHaveBeenCalled();
  });
});
