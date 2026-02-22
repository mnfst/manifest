import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadRouting,
  saveRouting,
  isProviderActive,
  activeProviderIds,
  getModelLabel,
  getAutoAssignment,
  PROVIDERS,
  STAGES,
  type RoutingData,
} from "../../src/services/providers";

/* ── localStorage stub ──────────────────────────── */

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    store[key] = val;
  }),
});

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  vi.clearAllMocks();
});

/* ── loadRouting ────────────────────────────────── */

describe("loadRouting", () => {
  it("returns defaults when key is missing from localStorage", () => {
    const result = loadRouting("test-agent");
    expect(result).toEqual({ providers: {}, pipeline: {} });
    expect(localStorage.getItem).toHaveBeenCalledWith("manifest_routing_test-agent");
  });

  it("parses stored JSON and returns providers + pipeline", () => {
    const data = {
      providers: { openai: { apiKey: "sk-abc" } },
      pipeline: { simple: { providerId: "openai", model: "gpt-4o" } },
    };
    store["manifest_routing_my-agent"] = JSON.stringify(data);

    const result = loadRouting("my-agent");
    expect(result.providers).toEqual({ openai: { apiKey: "sk-abc" } });
    expect(result.pipeline).toEqual({ simple: { providerId: "openai", model: "gpt-4o" } });
  });

  it("returns defaults when stored JSON is malformed", () => {
    store["manifest_routing_bad"] = "NOT-JSON{{{";
    const result = loadRouting("bad");
    expect(result).toEqual({ providers: {}, pipeline: {} });
  });

  it("defaults missing providers/pipeline fields to empty objects", () => {
    store["manifest_routing_partial"] = JSON.stringify({ providers: null });
    const result = loadRouting("partial");
    expect(result).toEqual({ providers: {}, pipeline: {} });
  });

  it("handles empty string value in localStorage", () => {
    store["manifest_routing_empty"] = "";
    const result = loadRouting("empty");
    // empty string is falsy, so the `if (raw)` check returns defaults
    expect(result).toEqual({ providers: {}, pipeline: {} });
  });
});

/* ── saveRouting ────────────────────────────────── */

describe("saveRouting", () => {
  it("writes serialised RoutingData to localStorage", () => {
    const data: RoutingData = {
      providers: { anthropic: { apiKey: "sk-ant-xyz" } },
      pipeline: { complex: { providerId: "anthropic", model: "claude-opus-4" } },
    };
    saveRouting("my-agent", data);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "manifest_routing_my-agent",
      JSON.stringify(data),
    );
  });

  it("round-trips with loadRouting", () => {
    const data: RoutingData = {
      providers: { gemini: { apiKey: "AIzaABC123" } },
      pipeline: {},
    };
    saveRouting("roundtrip", data);
    // Manually put the setItem value into store for loadRouting to read
    const call = (localStorage.setItem as ReturnType<typeof vi.fn>).mock.calls[0];
    store[call[0]] = call[1];
    expect(loadRouting("roundtrip")).toEqual(data);
  });
});

/* ── isProviderActive ───────────────────────────── */

describe("isProviderActive", () => {
  it("returns true when provider has an apiKey", () => {
    const data: RoutingData = {
      providers: { openai: { apiKey: "sk-test" } },
      pipeline: {},
    };
    expect(isProviderActive(data, "openai")).toBe(true);
  });

  it("returns true when provider has a baseUrl", () => {
    const data: RoutingData = {
      providers: { ollama: { baseUrl: "http://localhost:11434" } },
      pipeline: {},
    };
    expect(isProviderActive(data, "ollama")).toBe(true);
  });

  it("returns true when provider has both apiKey and baseUrl", () => {
    const data: RoutingData = {
      providers: { openai: { apiKey: "sk-x", baseUrl: "https://custom" } },
      pipeline: {},
    };
    expect(isProviderActive(data, "openai")).toBe(true);
  });

  it("returns false when provider is not in providers map", () => {
    const data: RoutingData = { providers: {}, pipeline: {} };
    expect(isProviderActive(data, "openai")).toBe(false);
  });

  it("returns false when provider config is empty (no apiKey or baseUrl)", () => {
    const data: RoutingData = { providers: { openai: {} }, pipeline: {} };
    expect(isProviderActive(data, "openai")).toBe(false);
  });

  it("returns false when apiKey is an empty string", () => {
    const data: RoutingData = {
      providers: { openai: { apiKey: "" } },
      pipeline: {},
    };
    expect(isProviderActive(data, "openai")).toBe(false);
  });
});

/* ── activeProviderIds ──────────────────────────── */

describe("activeProviderIds", () => {
  it("returns empty array when no providers are configured", () => {
    const data: RoutingData = { providers: {}, pipeline: {} };
    expect(activeProviderIds(data)).toEqual([]);
  });

  it("returns only IDs of providers that are active", () => {
    const data: RoutingData = {
      providers: {
        openai: { apiKey: "sk-abc" },
        anthropic: {},
        gemini: { apiKey: "AIzaXYZ" },
      },
      pipeline: {},
    };
    const result = activeProviderIds(data);
    expect(result).toContain("openai");
    expect(result).toContain("gemini");
    expect(result).not.toContain("anthropic");
  });

  it("only includes IDs present in the PROVIDERS constant", () => {
    const data: RoutingData = {
      providers: {
        openai: { apiKey: "sk-abc" },
        unknown_provider: { apiKey: "key-123" },
      },
      pipeline: {},
    };
    const result = activeProviderIds(data);
    expect(result).toContain("openai");
    // unknown_provider is not in PROVIDERS, so it is filtered out
    expect(result).not.toContain("unknown_provider");
  });

  it("preserves PROVIDERS ordering", () => {
    const data: RoutingData = {
      providers: {
        anthropic: { apiKey: "sk-ant-abc" },
        openai: { apiKey: "sk-abc" },
        deepseek: { apiKey: "sk-ds" },
      },
      pipeline: {},
    };
    const result = activeProviderIds(data);
    const providerOrder = PROVIDERS.map((p) => p.id);
    // Verify result order matches PROVIDERS definition order
    const resultIndices = result.map((id) => providerOrder.indexOf(id));
    for (let i = 1; i < resultIndices.length; i++) {
      expect(resultIndices[i]).toBeGreaterThan(resultIndices[i - 1]);
    }
  });
});

/* ── getModelLabel ──────────────────────────────── */

describe("getModelLabel", () => {
  it("returns the label for an exact model match", () => {
    expect(getModelLabel("openai", "gpt-4o")).toBe("GPT-4o");
    expect(getModelLabel("anthropic", "claude-opus-4")).toBe("Claude Opus 4");
  });

  it("returns modelValue when providerId is not found", () => {
    expect(getModelLabel("nonexistent", "some-model")).toBe("some-model");
  });

  it("strips an 8-digit date suffix and matches", () => {
    // "claude-sonnet-4" is a known model; "claude-sonnet-4-20261231" should strip to it
    expect(getModelLabel("anthropic", "claude-sonnet-4-20261231")).toBe("Claude Sonnet 4");
  });

  it("does not strip suffix when it is not exactly 8 digits", () => {
    // 7 digits should not be stripped
    const result = getModelLabel("anthropic", "claude-sonnet-4-1234567");
    // No exact match, no valid 8-digit strip, tries prefix match
    // "claude-sonnet-4-1234567" starts with "claude-sonnet-4" + "-", so prefix matches
    expect(result).toBe("Claude Sonnet 4");
  });

  it("does prefix match when modelValue starts with known value + hyphen", () => {
    // "gpt-4o-something-custom" starts with "gpt-4o" + "-"
    expect(getModelLabel("openai", "gpt-4o-something-custom")).toBe("GPT-4o");
  });

  it("returns modelValue as fallback when nothing matches", () => {
    expect(getModelLabel("openai", "completely-unknown-model")).toBe("completely-unknown-model");
  });

  it("handles exact match for a dated model variant", () => {
    expect(getModelLabel("openai", "gpt-4o-2024-11-20")).toBe("GPT-4o (2024-11-20)");
  });

  it("returns label via date-suffix stripping for anthropic dated models", () => {
    // "claude-opus-4-20250514" is an exact match in the list
    expect(getModelLabel("anthropic", "claude-opus-4-20250514")).toBe(
      "Claude Opus 4 (2025-05-14)",
    );
    // A new date that is NOT in the list triggers stripping -> "claude-opus-4"
    expect(getModelLabel("anthropic", "claude-opus-4-20260101")).toBe("Claude Opus 4");
  });
});

/* ── getAutoAssignment ──────────────────────────── */

describe("getAutoAssignment", () => {
  it("returns empty object when no providers are active", () => {
    const data: RoutingData = { providers: {}, pipeline: {} };
    expect(getAutoAssignment(data)).toEqual({});
  });

  it("assigns all stages to the single active provider", () => {
    const data: RoutingData = {
      providers: { anthropic: { apiKey: "sk-ant-test" } },
      pipeline: {},
    };
    const result = getAutoAssignment(data);
    expect(Object.keys(result)).toHaveLength(STAGES.length);
    for (const stage of STAGES) {
      expect(result[stage.id].providerId).toBe("anthropic");
    }
    expect(result.simple.model).toBe("claude-haiku-4-5");
    expect(result.reasoning.model).toBe("claude-opus-4");
  });

  it("picks the cheapest provider per COST_ORDER when multiple are active", () => {
    const data: RoutingData = {
      providers: {
        openai: { apiKey: "sk-openai" },
        deepseek: { apiKey: "sk-ds" },
        anthropic: { apiKey: "sk-ant-test" },
      },
      pipeline: {},
    };
    const result = getAutoAssignment(data);
    // deepseek is cheapest in COST_ORDER, so it should be picked for all stages
    for (const stage of STAGES) {
      expect(result[stage.id].providerId).toBe("deepseek");
    }
  });

  it("assigns correct tier models for deepseek", () => {
    const data: RoutingData = {
      providers: { deepseek: { apiKey: "sk-ds" } },
      pipeline: {},
    };
    const result = getAutoAssignment(data);
    expect(result.simple.model).toBe("deepseek-chat");
    expect(result.standard.model).toBe("deepseek-chat");
    expect(result.complex.model).toBe("deepseek-chat");
    expect(result.reasoning.model).toBe("deepseek-reasoner");
  });

  it("covers all four stages", () => {
    const data: RoutingData = {
      providers: { gemini: { apiKey: "AIzaXYZ" } },
      pipeline: {},
    };
    const result = getAutoAssignment(data);
    expect(result.simple).toEqual({ providerId: "gemini", model: "gemini-2.0-flash-lite" });
    expect(result.standard).toEqual({ providerId: "gemini", model: "gemini-2.0-flash" });
    expect(result.complex).toEqual({ providerId: "gemini", model: "gemini-2.5-flash" });
    expect(result.reasoning).toEqual({ providerId: "gemini", model: "gemini-2.5-pro" });
  });

  it("ignores providers not in COST_ORDER (e.g. ollama has no TIER_PICKS)", () => {
    const data: RoutingData = {
      providers: {
        ollama: { baseUrl: "http://localhost:11434" },
      },
      pipeline: {},
    };
    const result = getAutoAssignment(data);
    // ollama is not in COST_ORDER, so nothing is assigned
    expect(result).toEqual({});
  });

  it("falls through to next cheapest provider when first has no tier pick", () => {
    // ollama is active (baseUrl) but has no TIER_PICKS, openai does
    const data: RoutingData = {
      providers: {
        ollama: { baseUrl: "http://localhost:11434" },
        openai: { apiKey: "sk-test" },
      },
      pipeline: {},
    };
    const result = getAutoAssignment(data);
    for (const stage of STAGES) {
      expect(result[stage.id].providerId).toBe("openai");
    }
  });
});
