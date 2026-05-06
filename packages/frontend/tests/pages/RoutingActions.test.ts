import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSignal, createRoot } from "solid-js";
import type { TierAssignment } from "../../src/services/api";

const mockOverrideTier = vi.fn();
const mockResetTier = vi.fn();
const mockResetAllTiers = vi.fn();
const mockSetFallbacks = vi.fn();

vi.mock("../../src/services/api.js", () => ({
  overrideTier: (...args: unknown[]) => mockOverrideTier(...args),
  resetTier: (...args: unknown[]) => mockResetTier(...args),
  resetAllTiers: (...args: unknown[]) => mockResetAllTiers(...args),
  setFallbacks: (...args: unknown[]) => mockSetFallbacks(...args),
}));

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock("../../src/services/toast-store.js", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
    warning: vi.fn(),
  },
}));

import { createRoutingActions } from "../../src/pages/RoutingActions";

const baseTier: TierAssignment = {
  id: "t1",
  agent_id: "agent-1",
  tier: "simple",
  override_route: null,
  auto_assigned_route: { provider: "openai", authType: "api_key", model: "auto-1" },
  fallback_routes: [
    { provider: "openai", authType: "api_key", model: "fb-1" },
    { provider: "anthropic", authType: "api_key", model: "fb-2" },
  ],
  updated_at: "2025-01-01",
};

function setupActions(initial: TierAssignment[] | undefined = [baseTier]) {
  const dispose = vi.fn();
  let actions: ReturnType<typeof createRoutingActions>;
  let setTiers: (next: TierAssignment[] | undefined) => void;
  createRoot((d) => {
    dispose.mockImplementation(d);
    const [tiers, mutateTiers] = createSignal<TierAssignment[] | undefined>(initial);
    setTiers = mutateTiers;
    actions = createRoutingActions({
      agentName: () => "demo",
      tiers,
      mutateTiers,
      refetchAll: vi.fn().mockResolvedValue(undefined),
      setInstructionModal: vi.fn(),
    });
  });
  return { actions: actions!, setTiers: setTiers!, dispose };
}

describe("createRoutingActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTier / getFallbacksFor", () => {
    it("returns the matching tier from the resource", () => {
      const { actions } = setupActions();
      expect(actions.getTier("simple")?.id).toBe("t1");
    });

    it("returns undefined for unknown tier ids", () => {
      const { actions } = setupActions();
      expect(actions.getTier("unknown")).toBeUndefined();
    });

    it("derives fallback model names from fallback_routes when no overrides exist", () => {
      const { actions } = setupActions();
      expect(actions.getFallbacksFor("simple")).toEqual(["fb-1", "fb-2"]);
    });

    it("returns [] when the tier has no fallback_routes", () => {
      const tier = { ...baseTier, fallback_routes: null };
      const { actions } = setupActions([tier]);
      expect(actions.getFallbacksFor("simple")).toEqual([]);
    });
  });

  describe("handleOverride", () => {
    it("calls overrideTier and updates the tier in place on success", async () => {
      mockOverrideTier.mockResolvedValue({
        ...baseTier,
        override_route: { provider: "openai", authType: "api_key", model: "new-model" },
      });
      const { actions } = setupActions();
      await actions.handleOverride("simple", "new-model", "openai", "api_key");
      // 6th arg is the optional providerKeyLabel; undefined here because the
      // caller didn't pin a specific multi-key label.
      expect(mockOverrideTier).toHaveBeenCalledWith(
        "demo",
        "simple",
        "new-model",
        "openai",
        "api_key",
        undefined,
      );
      expect(mockToastSuccess).toHaveBeenCalledWith("Routing updated");
      expect(actions.getTier("simple")?.override_route?.model).toBe("new-model");
    });

    it("clears changingTier on rejection without throwing", async () => {
      mockOverrideTier.mockRejectedValue(new Error("boom"));
      const { actions } = setupActions();
      await actions.handleOverride("simple", "x", "openai");
      expect(actions.changingTier()).toBeNull();
    });

    it("auto-removes conflicting fallback when its full tuple matches the new primary", async () => {
      // Tier starts with two fallbacks. The override returns a primary whose
      // full (model, provider, authType, keyLabel) tuple matches the second
      // fallback ("fb-2" / anthropic). The handler should call setFallbacks
      // with the cleaned route list (only "fb-1" remains).
      const tier = {
        ...baseTier,
        fallback_routes: [
          { provider: "openai", authType: "api_key" as const, model: "fb-1" },
          {
            provider: "anthropic",
            authType: "api_key" as const,
            model: "claude-opus",
            keyLabel: "Work",
          },
        ],
      };
      mockOverrideTier.mockResolvedValue({
        ...tier,
        override_route: {
          provider: "Anthropic", // case differs — must still match
          authType: "api_key",
          model: "claude-opus",
          keyLabel: "Work",
        },
        fallback_routes: tier.fallback_routes,
      });
      mockSetFallbacks.mockResolvedValue([
        { provider: "openai", authType: "api_key", model: "fb-1" },
      ]);
      const { actions } = setupActions([tier]);
      await actions.handleOverride("simple", "claude-opus", "anthropic", "api_key", "Work");
      expect(mockSetFallbacks).toHaveBeenCalledWith(
        "demo",
        "simple",
        ["fb-1"],
        [{ provider: "openai", authType: "api_key", model: "fb-1" }],
      );
      expect(actions.getTier("simple")?.fallback_routes?.length).toBe(1);
    });

    it("does not call setFallbacks when no fallback conflicts with the new primary", async () => {
      mockOverrideTier.mockResolvedValue({
        ...baseTier,
        override_route: { provider: "openai", authType: "api_key", model: "non-conflicting" },
      });
      const { actions } = setupActions();
      await actions.handleOverride("simple", "non-conflicting", "openai", "api_key");
      expect(mockSetFallbacks).not.toHaveBeenCalled();
    });

    it("does not filter fallbacks when override returns no override_route (primary null)", async () => {
      // Primary is null after override (e.g. server cleared it). Filter logic
      // treats `cleanedRoutes` as the original routes — no setFallbacks call.
      mockOverrideTier.mockResolvedValue({
        ...baseTier,
        override_route: null,
      });
      const { actions } = setupActions();
      await actions.handleOverride("simple", "anything", "openai");
      expect(mockSetFallbacks).not.toHaveBeenCalled();
    });

    it("sets and clears changingTier around the override call", async () => {
      let resolveCall: (v: TierAssignment) => void = () => {};
      mockOverrideTier.mockReturnValue(
        new Promise<TierAssignment>((r) => {
          resolveCall = r;
        }),
      );
      const { actions } = setupActions();
      const p = actions.handleOverride("simple", "x", "openai");
      expect(actions.changingTier()).toBe("simple");
      resolveCall(baseTier);
      await p;
      expect(actions.changingTier()).toBeNull();
    });
  });

  describe("handleReset", () => {
    it("clears the override_route on success", async () => {
      mockResetTier.mockResolvedValue(undefined);
      const tier = {
        ...baseTier,
        override_route: { provider: "openai", authType: "api_key" as const, model: "prev" },
      };
      const { actions } = setupActions([tier]);
      await actions.handleReset("simple");
      expect(mockResetTier).toHaveBeenCalledWith("demo", "simple");
      expect(actions.getTier("simple")?.override_route).toBeNull();
      expect(mockToastSuccess).toHaveBeenCalledWith("Tier reset to auto");
    });

    it("clears resettingTier even when reset fails", async () => {
      mockResetTier.mockRejectedValue(new Error("boom"));
      const { actions } = setupActions();
      await actions.handleReset("simple");
      expect(actions.resettingTier()).toBeNull();
    });
  });

  describe("handleResetAll", () => {
    it("clears override_route and fallback_routes on every tier on success", async () => {
      mockResetAllTiers.mockResolvedValue(undefined);
      const tier = {
        ...baseTier,
        override_route: { provider: "openai", authType: "api_key" as const, model: "x" },
      };
      const { actions } = setupActions([tier]);
      await actions.handleResetAll();
      expect(mockResetAllTiers).toHaveBeenCalledWith("demo");
      const t = actions.getTier("simple");
      expect(t?.override_route).toBeNull();
      expect(t?.fallback_routes).toBeNull();
      expect(mockToastSuccess).toHaveBeenCalledWith("All tiers reset to auto");
    });

    it("clears resettingAll even when reset fails", async () => {
      mockResetAllTiers.mockRejectedValue(new Error("boom"));
      const { actions } = setupActions();
      await actions.handleResetAll();
      expect(actions.resettingAll()).toBe(false);
    });
  });

  describe("handleAddFallback", () => {
    it("ignores duplicate fallback adds for the same model", async () => {
      const { actions } = setupActions();
      await actions.handleAddFallback("simple", "fb-1", "openai", "api_key");
      expect(mockSetFallbacks).not.toHaveBeenCalled();
    });

    it("appends the new model and persists via setFallbacks", async () => {
      mockSetFallbacks.mockResolvedValue([
        { provider: "openai", authType: "api_key", model: "fb-1" },
        { provider: "anthropic", authType: "api_key", model: "fb-2" },
        { provider: "openai", authType: "api_key", model: "fb-new" },
      ]);
      const { actions } = setupActions();
      await actions.handleAddFallback("simple", "fb-new", "openai", "api_key");
      // setFallbacks now receives the parallel route array as its 4th arg so
      // multi-key pins (route.keyLabel) ride along with the persist. Existing
      // fallbacks here have no pin, so each route is the bare (provider,
      // authType, model) triple.
      expect(mockSetFallbacks).toHaveBeenCalledWith(
        "demo",
        "simple",
        ["fb-1", "fb-2", "fb-new"],
        [
          { provider: "openai", authType: "api_key", model: "fb-1" },
          { provider: "anthropic", authType: "api_key", model: "fb-2" },
          { provider: "openai", authType: "api_key", model: "fb-new" },
        ],
      );
      expect(actions.getTier("simple")?.fallback_routes?.map((r) => r.model)).toEqual([
        "fb-1",
        "fb-2",
        "fb-new",
      ]);
      expect(mockToastSuccess).toHaveBeenCalledWith("Fallback added");
    });

    it("rolls back the optimistic state on failure", async () => {
      mockSetFallbacks.mockRejectedValue(new Error("boom"));
      const { actions } = setupActions();
      await actions.handleAddFallback("simple", "fb-new", "openai", "api_key");
      // Final state matches the persisted backend (still original 2 fallbacks)
      expect(actions.getFallbacksFor("simple")).toEqual(["fb-1", "fb-2"]);
      expect(actions.addingFallback()).toBeNull();
    });
  });

  describe("handlePinKey", () => {
    it("re-overrides with the same model + new keyLabel when a tier has an explicit override", async () => {
      const tier = {
        ...baseTier,
        override_route: {
          provider: "openai",
          authType: "api_key" as const,
          model: "gpt-4o",
        },
      };
      mockOverrideTier.mockResolvedValue({
        ...tier,
        override_route: {
          provider: "openai",
          authType: "api_key" as const,
          model: "gpt-4o",
          keyLabel: "Work",
        },
      });
      const { actions } = setupActions([tier]);
      await actions.handlePinKey("simple", "openai", "Work", "api_key");
      expect(mockOverrideTier).toHaveBeenCalledWith(
        "demo",
        "simple",
        "gpt-4o",
        "openai",
        "api_key",
        "Work",
      );
      expect(mockToastSuccess).toHaveBeenCalledWith('Pinned to "Work" key');
      expect(actions.getTier("simple")?.override_route?.keyLabel).toBe("Work");
    });

    it("falls back to auto_assigned_route's model when the tier has no override", async () => {
      mockOverrideTier.mockResolvedValue({ ...baseTier });
      const { actions } = setupActions();
      await actions.handlePinKey("simple", "openai", "Personal");
      // baseTier.auto_assigned_route.model = "auto-1"
      expect(mockOverrideTier).toHaveBeenCalledWith(
        "demo",
        "simple",
        "auto-1",
        "openai",
        "api_key",
        "Personal",
      );
    });

    it("emits a 'Key pin cleared' toast when providerKeyLabel is null", async () => {
      mockOverrideTier.mockResolvedValue({ ...baseTier });
      const { actions } = setupActions();
      await actions.handlePinKey("simple", "openai", null);
      expect(mockToastSuccess).toHaveBeenCalledWith("Key pin cleared");
    });

    it("returns silently when the tier has neither override nor auto_assigned route (no model to re-pin)", async () => {
      const tier = { ...baseTier, auto_assigned_route: null };
      const { actions } = setupActions([tier]);
      await actions.handlePinKey("simple", "openai", "Work");
      expect(mockOverrideTier).not.toHaveBeenCalled();
    });

    it("returns silently when providerId is empty", async () => {
      const { actions } = setupActions();
      await actions.handlePinKey("simple", "", "Work");
      expect(mockOverrideTier).not.toHaveBeenCalled();
    });

    it("returns silently when the tier id is unknown", async () => {
      const { actions } = setupActions();
      await actions.handlePinKey("unknown", "openai", "Work");
      expect(mockOverrideTier).not.toHaveBeenCalled();
    });

    it("clears changingTier even when the override call rejects", async () => {
      mockOverrideTier.mockRejectedValue(new Error("boom"));
      const { actions } = setupActions();
      await actions.handlePinKey("simple", "openai", "Work");
      expect(actions.changingTier()).toBeNull();
    });
  });

  describe("handleAddFallback with provider key labels", () => {
    it("includes the keyLabel on the new fallback route when supplied", async () => {
      mockSetFallbacks.mockResolvedValue([
        { provider: "openai", authType: "api_key", model: "fb-1" },
        { provider: "anthropic", authType: "api_key", model: "fb-2" },
        {
          provider: "openai",
          authType: "api_key",
          model: "fb-new",
          keyLabel: "Work",
        },
      ]);
      const { actions } = setupActions();
      await actions.handleAddFallback("simple", "fb-new", "openai", "api_key", "Work");
      expect(mockSetFallbacks).toHaveBeenCalledWith(
        "demo",
        "simple",
        ["fb-1", "fb-2", "fb-new"],
        [
          { provider: "openai", authType: "api_key", model: "fb-1" },
          { provider: "anthropic", authType: "api_key", model: "fb-2" },
          {
            provider: "openai",
            authType: "api_key",
            model: "fb-new",
            keyLabel: "Work",
          },
        ],
      );
    });

    it("allows the same model under a different keyLabel (not deduped)", async () => {
      mockSetFallbacks.mockResolvedValue([]);
      const { actions } = setupActions();
      // fb-1 already exists without a keyLabel; adding it with keyLabel "Work"
      // is a different routing slot and must persist.
      await actions.handleAddFallback("simple", "fb-1", "openai", "api_key", "Work");
      expect(mockSetFallbacks).toHaveBeenCalled();
    });
  });

  describe("handleFallbackUpdate", () => {
    it("merges fallback_routes into the matching tier when routes are passed", () => {
      const { actions } = setupActions();
      actions.handleFallbackUpdate("simple", ["fb-1"], [
        { provider: "openai", authType: "api_key", model: "fb-1" },
      ]);
      expect(actions.getTier("simple")?.fallback_routes?.length).toBe(1);
    });

    it("leaves fallback_routes untouched when routes is undefined (legacy callers)", () => {
      const { actions } = setupActions();
      actions.handleFallbackUpdate("simple", ["fb-1"]);
      expect(actions.getTier("simple")?.fallback_routes?.length).toBe(2);
    });

    it("ignores updates for unknown tier ids", () => {
      const { actions } = setupActions();
      actions.handleFallbackUpdate("unknown", ["fb-1"], []);
      // Existing tier not modified
      expect(actions.getFallbacksFor("simple")).toEqual(["fb-1", "fb-2"]);
    });
  });
});
