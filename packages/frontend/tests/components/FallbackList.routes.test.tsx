import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@solidjs/testing-library";

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
  customProviderLogo: () => null,
}));

vi.mock("../../src/components/AuthBadge.js", () => ({
  authBadgeFor: (t: string | null | undefined) =>
    t ? <span data-testid={`auth-${t}`} /> : null,
  authLabel: (authType: string | null | undefined) =>
    authType === "subscription" ? "Subscription" : authType === "local" ? "Local" : "API Key",
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
import type { ModelRoute } from "../../src/services/api/routing";

/**
 * Route-aware behaviors for FallbackList:
 *   1. Auth badge per row uses fallbackRoutes[i].authType when present,
 *      otherwise falls back to the legacy lookup against connectedProviders.
 *   2. Drag-drop reorder must keep `fallbacks` and `fallbackRoutes` in
 *      lockstep — both arrays reorder together and both pass through
 *      persistFallbacks + onUpdate.
 *   3. Remove must drop the same index from BOTH arrays.
 */

const sharedModels = [
  { model_name: "gpt-4o", provider: "OpenAI" },
  { model_name: "claude-opus-4-6", provider: "Anthropic" },
] as never[];

// Connected providers default to api_key only — that lets us prove the
// route's authType wins over the legacy provider-table lookup, since the
// legacy lookup would always return "api_key" here.
const apiKeyOnlyProviders = [
  { provider: "openai", auth_type: "api_key", is_active: true },
  { provider: "anthropic", auth_type: "api_key", is_active: true },
] as never[];

const baseProps = {
  agentName: "test-agent",
  tier: "simple",
  models: sharedModels,
  customProviders: [] as never[],
  connectedProviders: apiKeyOnlyProviders,
  onAddFallback: vi.fn(),
};

describe("FallbackList route-aware behaviors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetFallbacks.mockResolvedValue(undefined);
    mockClearFallbacks.mockResolvedValue(undefined);
  });

  it("renders auth badge from fallbackRoutes[i].authType when provided", () => {
    const fallbackRoutes: ModelRoute[] = [
      { provider: "openai", authType: "subscription", model: "gpt-4o" },
    ];
    const { container } = render(() => (
      <FallbackList
        {...baseProps}
        fallbacks={["gpt-4o"]}
        fallbackRoutes={fallbackRoutes}
        onUpdate={vi.fn()}
      />
    ));

    // The route's authType (subscription) wins, even though the only
    // connected provider for openai is api_key.
    expect(container.querySelector('[data-testid="auth-subscription"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="auth-api_key"]')).toBeNull();
    // Title reflects the same precedence.
    const iconSpan = container.querySelector(".fallback-list__icon");
    expect(iconSpan?.getAttribute("title")).toBe("OpenAI (Subscription)");
  });

  it("falls back to legacy provider-table auth when fallbackRoutes is null", () => {
    const { container } = render(() => (
      <FallbackList
        {...baseProps}
        fallbacks={["gpt-4o"]}
        fallbackRoutes={null}
        onUpdate={vi.fn()}
      />
    ));

    // No route, so the api_key from connectedProviders is what we render.
    expect(container.querySelector('[data-testid="auth-api_key"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="auth-subscription"]')).toBeNull();
  });

  it("reorders fallbacks AND fallbackRoutes in lockstep on drop", async () => {
    const onUpdate = vi.fn();
    const persist = vi.fn().mockResolvedValue(undefined);
    const fallbacks = ["gpt-4o", "claude-opus-4-6"];
    const fallbackRoutes: ModelRoute[] = [
      { provider: "openai", authType: "api_key", model: "gpt-4o" },
      { provider: "anthropic", authType: "api_key", model: "claude-opus-4-6" },
    ];

    const { container } = render(() => (
      <FallbackList
        {...baseProps}
        fallbacks={fallbacks}
        fallbackRoutes={fallbackRoutes}
        onUpdate={onUpdate}
        persistFallbacks={persist}
      />
    ));

    const cards = container.querySelectorAll(".fallback-list__card");
    const list = container.querySelector(".fallback-list__items")!;

    // Drag card 0 (gpt-4o) to the end.
    fireEvent.dragStart(cards[0], {
      dataTransfer: { effectAllowed: "", setData: vi.fn() },
    });
    cards.forEach((card, i) => {
      vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
        top: i * 40,
        bottom: (i + 1) * 40,
        height: 40,
        left: 0,
        right: 200,
        width: 200,
        x: 0,
        y: i * 40,
        toJSON: () => {},
      });
    });
    fireEvent.dragOver(list, {
      clientY: 130,
      dataTransfer: { dropEffect: "" },
      preventDefault: vi.fn(),
    });
    fireEvent.drop(list, { preventDefault: vi.fn() });

    await waitFor(() => {
      // Optimistic onUpdate carries BOTH arrays, in lockstep.
      expect(onUpdate).toHaveBeenCalledWith(
        ["claude-opus-4-6", "gpt-4o"],
        [
          { provider: "anthropic", authType: "api_key", model: "claude-opus-4-6" },
          { provider: "openai", authType: "api_key", model: "gpt-4o" },
        ],
      );
      // Same lockstep persists to the API.
      expect(persist).toHaveBeenCalledWith(
        "test-agent",
        "simple",
        ["claude-opus-4-6", "gpt-4o"],
        [
          { provider: "anthropic", authType: "api_key", model: "claude-opus-4-6" },
          { provider: "openai", authType: "api_key", model: "gpt-4o" },
        ],
      );
    });
  });

  it("remove drops the same index from fallbacks AND fallbackRoutes", async () => {
    const onUpdate = vi.fn();
    const persist = vi.fn().mockResolvedValue(undefined);
    const fallbackRoutes: ModelRoute[] = [
      { provider: "openai", authType: "api_key", model: "gpt-4o" },
      { provider: "anthropic", authType: "subscription", model: "claude-opus-4-6" },
    ];
    const { container } = render(() => (
      <FallbackList
        {...baseProps}
        fallbacks={["gpt-4o", "claude-opus-4-6"]}
        fallbackRoutes={fallbackRoutes}
        onUpdate={onUpdate}
        persistFallbacks={persist}
      />
    ));

    const removeButtons = container.querySelectorAll(".fallback-list__remove");
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        ["claude-opus-4-6"],
        [{ provider: "anthropic", authType: "subscription", model: "claude-opus-4-6" }],
      );
      expect(persist).toHaveBeenCalledWith(
        "test-agent",
        "simple",
        ["claude-opus-4-6"],
        [{ provider: "anthropic", authType: "subscription", model: "claude-opus-4-6" }],
      );
    });
  });

  it("removing the last item clears both arrays via persistClearFallbacks", async () => {
    const onUpdate = vi.fn();
    const persistClear = vi.fn().mockResolvedValue(undefined);
    const fallbackRoutes: ModelRoute[] = [
      { provider: "openai", authType: "api_key", model: "gpt-4o" },
    ];
    const { container } = render(() => (
      <FallbackList
        {...baseProps}
        fallbacks={["gpt-4o"]}
        fallbackRoutes={fallbackRoutes}
        onUpdate={onUpdate}
        persistClearFallbacks={persistClear}
      />
    ));

    const removeButtons = container.querySelectorAll(".fallback-list__remove");
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      // onUpdate is called with empty fallbacks AND null routes.
      expect(onUpdate).toHaveBeenCalledWith([], null);
      expect(persistClear).toHaveBeenCalledWith("test-agent", "simple");
    });
    expect(mockSetFallbacks).not.toHaveBeenCalled();
  });

  it("reverting after drop failure restores both arrays to the original", async () => {
    const onUpdate = vi.fn();
    const persist = vi.fn().mockRejectedValue(new Error("boom"));
    const fallbacks = ["gpt-4o", "claude-opus-4-6"];
    const fallbackRoutes: ModelRoute[] = [
      { provider: "openai", authType: "api_key", model: "gpt-4o" },
      { provider: "anthropic", authType: "api_key", model: "claude-opus-4-6" },
    ];

    const { container } = render(() => (
      <FallbackList
        {...baseProps}
        fallbacks={fallbacks}
        fallbackRoutes={fallbackRoutes}
        onUpdate={onUpdate}
        persistFallbacks={persist}
      />
    ));

    const cards = container.querySelectorAll(".fallback-list__card");
    const list = container.querySelector(".fallback-list__items")!;
    fireEvent.dragStart(cards[0], {
      dataTransfer: { effectAllowed: "", setData: vi.fn() },
    });
    cards.forEach((card, i) => {
      vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
        top: i * 40,
        bottom: (i + 1) * 40,
        height: 40,
        left: 0,
        right: 200,
        width: 200,
        x: 0,
        y: i * 40,
        toJSON: () => {},
      });
    });
    fireEvent.dragOver(list, {
      clientY: 130,
      dataTransfer: { dropEffect: "" },
      preventDefault: vi.fn(),
    });
    fireEvent.drop(list, { preventDefault: vi.fn() });

    await waitFor(() => {
      // Two onUpdate calls: optimistic reorder, then revert with the original
      // fallbacks AND original routes.
      expect(onUpdate).toHaveBeenCalledTimes(2);
      expect(onUpdate).toHaveBeenLastCalledWith(fallbacks, fallbackRoutes);
    });
  });
});
