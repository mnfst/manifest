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
      expect(mockOverrideTier).toHaveBeenCalledWith("demo", "simple", "new-model", "openai", "api_key");
      expect(mockToastSuccess).toHaveBeenCalledWith("Routing updated");
      expect(actions.getTier("simple")?.override_route?.model).toBe("new-model");
    });

    it("clears changingTier on rejection without throwing", async () => {
      mockOverrideTier.mockRejectedValue(new Error("boom"));
      const { actions } = setupActions();
      await actions.handleOverride("simple", "x", "openai");
      expect(actions.changingTier()).toBeNull();
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
      expect(mockSetFallbacks).toHaveBeenCalledWith("demo", "simple", ["fb-1", "fb-2", "fb-new"]);
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
