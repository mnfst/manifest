import { describe, it, expect } from "vitest";
import {
  pricePerM,
  resolveProviderId,
  inferProviderFromModel,
  inferProviderName,
  stripCustomPrefix,
  usedKeyLabelsForModelInTier,
  activeRouteKeys,
  availableRouteKeysForModel,
  routeKeySelectionForModel,
} from "../../src/services/routing-utils";
import type { RoutingProvider, TierAssignment } from "../../src/services/api";

/* ── pricePerM ─────────────────────────────────── */

describe("pricePerM", () => {
  it('returns "Free" for zero price', () => {
    expect(pricePerM(0)).toBe("Free");
  });

  it('returns "\u2014" for null price (unknown)', () => {
    expect(pricePerM(null)).toBe("\u2014");
  });

  it('returns "\u2014" for undefined price', () => {
    expect(pricePerM(undefined)).toBe("\u2014");
  });

  it('returns "< $0.01" for very small non-zero price', () => {
    expect(pricePerM(0.000000000001)).toBe("< $0.01");
  });

  it("formats a normal price", () => {
    expect(pricePerM(0.000015)).toBe("$15.00");
    expect(pricePerM(0.0000025)).toBe("$2.50");
  });

  it("handles large prices", () => {
    expect(pricePerM(0.0001)).toBe("$100.00");
  });
});

/* ── resolveProviderId ────────────────────────── */

describe("resolveProviderId", () => {
  it("resolves exact provider IDs", () => {
    expect(resolveProviderId("openai")).toBe("openai");
    expect(resolveProviderId("anthropic")).toBe("anthropic");
    expect(resolveProviderId("deepseek")).toBe("deepseek");
  });

  it("resolves aliased provider names", () => {
    expect(resolveProviderId("Google")).toBe("gemini");
    expect(resolveProviderId("Alibaba")).toBe("qwen");
    expect(resolveProviderId("OpenRouter")).toBe("openrouter");
    expect(resolveProviderId("Ollama")).toBe("ollama");
  });

  it("resolves Copilot provider", () => {
    expect(resolveProviderId("copilot")).toBe("copilot");
    expect(resolveProviderId("Copilot")).toBe("copilot");
  });

  it("resolves by display name (case-insensitive)", () => {
    expect(resolveProviderId("Mistral")).toBe("mistral");
    expect(resolveProviderId("xAI")).toBe("xai");
    expect(resolveProviderId("Moonshot")).toBe("moonshot");
    expect(resolveProviderId("MiniMax")).toBe("minimax");
  });

  it("returns undefined for unknown provider", () => {
    expect(resolveProviderId("nonexistent")).toBeUndefined();
  });

  it("returns custom: prefixed providers as-is", () => {
    expect(resolveProviderId("custom:abc-123")).toBe("custom:abc-123");
    expect(resolveProviderId("custom:some-uuid")).toBe("custom:some-uuid");
  });
});

/* ── inferProviderFromModel ───────────────────── */

describe("inferProviderFromModel", () => {
  it("detects Ollama models by colon convention", () => {
    expect(inferProviderFromModel("qwen2.5:0.5b")).toBe("ollama");
    expect(inferProviderFromModel("llama3:latest")).toBe("ollama");
  });

  it("does not misclassify :free suffix as Ollama", () => {
    expect(inferProviderFromModel("stepfun/step-3.5-flash:free")).toBe("openrouter");
    expect(inferProviderFromModel("arcee-ai/trinity-large-preview:free")).toBe("openrouter");
    expect(inferProviderFromModel("nvidia/nemotron-3-nano-30b-a3b:free")).toBe("openrouter");
  });

  it("still classifies :latest suffix as Ollama", () => {
    expect(inferProviderFromModel("llama3:latest")).toBe("ollama");
    expect(inferProviderFromModel("mistral:7b")).toBe("ollama");
  });

  it("detects Anthropic models", () => {
    expect(inferProviderFromModel("claude-opus-4")).toBe("anthropic");
    expect(inferProviderFromModel("claude-3-5-sonnet-latest")).toBe("anthropic");
  });

  it("detects OpenAI models", () => {
    expect(inferProviderFromModel("gpt-4o")).toBe("openai");
    expect(inferProviderFromModel("o3-mini")).toBe("openai");
    expect(inferProviderFromModel("o4-mini")).toBe("openai");
    expect(inferProviderFromModel("chatgpt-4o-latest")).toBe("openai");
  });

  it("detects Gemini models", () => {
    expect(inferProviderFromModel("gemini-2.5-pro")).toBe("gemini");
  });

  it("detects Gemma models as Gemini (Google) provider", () => {
    expect(inferProviderFromModel("gemma-3n-e2b-it")).toBe("gemini");
    expect(inferProviderFromModel("gemma-2-9b")).toBe("gemini");
    expect(inferProviderFromModel("gemma-7b")).toBe("gemini");
  });

  it("detects DeepSeek models", () => {
    expect(inferProviderFromModel("deepseek-chat")).toBe("deepseek");
    expect(inferProviderFromModel("deepseek-reasoner")).toBe("deepseek");
  });

  it("detects xAI models", () => {
    expect(inferProviderFromModel("grok-3")).toBe("xai");
  });

  it("detects Mistral models", () => {
    expect(inferProviderFromModel("mistral-large")).toBe("mistral");
    expect(inferProviderFromModel("codestral-latest")).toBe("mistral");
    expect(inferProviderFromModel("pixtral-12b-2409")).toBe("mistral");
    expect(inferProviderFromModel("open-mistral-nemo")).toBe("mistral");
  });

  it("detects Moonshot/Kimi models", () => {
    expect(inferProviderFromModel("kimi-k2")).toBe("moonshot");
    expect(inferProviderFromModel("moonshot-v1-128k")).toBe("moonshot");
  });

  it("detects MiniMax models", () => {
    expect(inferProviderFromModel("minimax-m2.5")).toBe("minimax");
    expect(inferProviderFromModel("MiniMax-M1")).toBe("minimax");
  });

  it("detects Z.ai GLM models", () => {
    expect(inferProviderFromModel("glm-5")).toBe("zai");
    expect(inferProviderFromModel("glm-4.7-flash")).toBe("zai");
    expect(inferProviderFromModel("glm-4.5")).toBe("zai");
  });

  it("detects Qwen models", () => {
    expect(inferProviderFromModel("qwen3-235b-a22b")).toBe("qwen");
    expect(inferProviderFromModel("qwq-32b")).toBe("qwen");
  });

  it("detects openrouter/ prefixed models", () => {
    expect(inferProviderFromModel("openrouter/auto")).toBe("openrouter");
  });

  it("detects Copilot models", () => {
    expect(inferProviderFromModel("copilot/claude-sonnet-4.6")).toBe("copilot");
    expect(inferProviderFromModel("copilot/gpt-4o")).toBe("copilot");
    expect(inferProviderFromModel("copilot/gemini-3.1-pro-preview")).toBe("copilot");
  });

  it("detects vendor-prefixed models as openrouter (catch-all)", () => {
    expect(inferProviderFromModel("anthropic/claude-opus-4")).toBe("openrouter");
    expect(inferProviderFromModel("meta-llama/llama-4-maverick")).toBe("openrouter");
  });

  it("does not misclassify OpenRouter colon-variant models as Ollama", () => {
    expect(inferProviderFromModel("anthropic/claude-sonnet-4:thinking")).toBe("openrouter");
    expect(inferProviderFromModel("nvidia/llama-3.1-nemotron-70b-instruct:extended")).toBe("openrouter");
  });

  it("returns undefined for unrecognized models", () => {
    expect(inferProviderFromModel("some-random-model")).toBeUndefined();
  });

  it("detects custom provider models", () => {
    expect(inferProviderFromModel("custom:abc-123/llama-3.1-70b")).toBe("custom");
    expect(inferProviderFromModel("custom:uuid/model-name")).toBe("custom");
  });
});

/* ── inferProviderName ────────────────────────── */

describe("inferProviderName", () => {
  it("returns provider display name for known models", () => {
    expect(inferProviderName("gpt-4o")).toBe("OpenAI");
    expect(inferProviderName("claude-opus-4")).toBe("Anthropic");
    expect(inferProviderName("gemini-2.5-pro")).toBe("Google");
  });

  it("returns Ollama for colon-tagged models", () => {
    expect(inferProviderName("llama3:latest")).toBe("Ollama");
  });

  it("returns MiniMax for minimax models", () => {
    expect(inferProviderName("minimax-m2.5")).toBe("MiniMax");
  });

  it("returns Z.ai for GLM models", () => {
    expect(inferProviderName("glm-5")).toBe("Z.ai");
  });

  it("returns undefined for unrecognized models", () => {
    expect(inferProviderName("unknown-model")).toBeUndefined();
  });
});

/* ── stripCustomPrefix ─────────────────────────── */

describe("stripCustomPrefix", () => {
  it("strips custom:<uuid>/ prefix from model name", () => {
    expect(stripCustomPrefix("custom:abc-123/llama-3.1-70b")).toBe("llama-3.1-70b");
    expect(stripCustomPrefix("custom:some-uuid/gpt-4o")).toBe("gpt-4o");
  });

  it("handles model names with slashes after the prefix", () => {
    expect(stripCustomPrefix("custom:uuid-456/openai/gpt-oss-120b")).toBe("openai/gpt-oss-120b");
  });

  it("returns the original string when no custom prefix", () => {
    expect(stripCustomPrefix("gpt-4o")).toBe("gpt-4o");
    expect(stripCustomPrefix("claude-opus-4")).toBe("claude-opus-4");
  });

  it("returns the original string for malformed custom prefix", () => {
    expect(stripCustomPrefix("custom:no-slash")).toBe("custom:no-slash");
  });
});

/* ── usedKeyLabelsForModelInTier ──────────────── */

describe("usedKeyLabelsForModelInTier", () => {
  const baseTier = (overrides: Partial<TierAssignment>): TierAssignment => ({
    id: "t1",
    agent_id: "a1",
    tier: "standard",
    override_route: null,
    auto_assigned_route: null,
    fallback_routes: null,
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  });

  it("returns an empty set for an undefined tier", () => {
    expect(usedKeyLabelsForModelInTier(undefined, "gpt-4o")).toEqual(new Set());
  });

  it("collects the primary's keyLabel (case-folded) when its model matches", () => {
    const tier = baseTier({
      override_route: {
        provider: "openai",
        authType: "api_key",
        model: "gpt-4o",
        keyLabel: "Work",
      },
    });
    expect(usedKeyLabelsForModelInTier(tier, "gpt-4o")).toEqual(new Set(["work"]));
  });

  it("falls back to defaultKeyLabel when primary has no explicit pin", () => {
    const tier = baseTier({
      auto_assigned_route: { provider: "openai", authType: "api_key", model: "gpt-4o" },
    });
    expect(usedKeyLabelsForModelInTier(tier, "gpt-4o", undefined, "Default")).toEqual(
      new Set(["default"]),
    );
  });

  it("does not include the primary slot when excludeSlot is 'primary'", () => {
    const tier = baseTier({
      override_route: {
        provider: "openai",
        authType: "api_key",
        model: "gpt-4o",
        keyLabel: "Work",
      },
    });
    expect(usedKeyLabelsForModelInTier(tier, "gpt-4o", "primary")).toEqual(new Set());
  });

  it("ignores the primary when its model does not match", () => {
    const tier = baseTier({
      override_route: {
        provider: "openai",
        authType: "api_key",
        model: "claude-opus-4",
        keyLabel: "Work",
      },
    });
    expect(usedKeyLabelsForModelInTier(tier, "gpt-4o")).toEqual(new Set());
  });

  it("collects keyLabels from matching fallback routes", () => {
    const tier = baseTier({
      fallback_routes: [
        { provider: "openai", authType: "api_key", model: "gpt-4o", keyLabel: "Work" },
        { provider: "openai", authType: "api_key", model: "gpt-4o", keyLabel: "Personal" },
        { provider: "openai", authType: "api_key", model: "claude-opus-4", keyLabel: "Other" },
        { provider: "openai", authType: "api_key", model: "gpt-4o" }, // no keyLabel
      ],
    });
    expect(usedKeyLabelsForModelInTier(tier, "gpt-4o")).toEqual(new Set(["work", "personal"]));
  });

  it("counts unpinned matching fallback routes as the default key when provided", () => {
    const tier = baseTier({
      fallback_routes: [
        { provider: "openai", authType: "api_key", model: "gpt-4o" },
        { provider: "openai", authType: "api_key", model: "gpt-4o", keyLabel: "Work" },
      ],
    });
    expect(usedKeyLabelsForModelInTier(tier, "gpt-4o", undefined, "Default")).toEqual(
      new Set(["default", "work"]),
    );
  });

  it("excludes a specific fallback index from collection", () => {
    const tier = baseTier({
      fallback_routes: [
        { provider: "openai", authType: "api_key", model: "gpt-4o", keyLabel: "Work" },
        { provider: "openai", authType: "api_key", model: "gpt-4o", keyLabel: "Personal" },
      ],
    });
    expect(usedKeyLabelsForModelInTier(tier, "gpt-4o", 0)).toEqual(new Set(["personal"]));
  });

  it("combines primary and fallback labels when both match", () => {
    const tier = baseTier({
      override_route: {
        provider: "openai",
        authType: "api_key",
        model: "gpt-4o",
        keyLabel: "Work",
      },
      fallback_routes: [
        { provider: "openai", authType: "api_key", model: "gpt-4o", keyLabel: "Personal" },
      ],
    });
    expect(usedKeyLabelsForModelInTier(tier, "gpt-4o")).toEqual(new Set(["work", "personal"]));
  });
});

/* ── route key selection ──────────────────────── */

describe("route key selection", () => {
  const providers: RoutingProvider[] = [
    {
      id: "p2",
      provider: "openai",
      auth_type: "api_key",
      is_active: true,
      has_api_key: true,
      label: "Personal",
      priority: 1,
      connected_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "p1",
      provider: "openai",
      auth_type: "api_key",
      is_active: true,
      has_api_key: true,
      label: "Default",
      priority: 0,
      connected_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "inactive",
      provider: "openai",
      auth_type: "api_key",
      is_active: false,
      has_api_key: true,
      label: "Inactive",
      priority: 2,
      connected_at: "2026-01-01T00:00:00Z",
    },
  ];

  it("returns active provider keys sorted by priority", () => {
    expect(activeRouteKeys(providers, "openai", "api_key").map((p) => p.label)).toEqual([
      "Default",
      "Personal",
    ]);
  });

  it("treats an unpinned primary as using the default key", () => {
    const tier: TierAssignment = {
      id: "t1",
      agent_id: "a1",
      tier: "simple",
      override_route: { provider: "openai", authType: "api_key", model: "gpt-4o" },
      auto_assigned_route: null,
      fallback_routes: null,
      updated_at: "2026-01-01T00:00:00Z",
    };

    expect(
      availableRouteKeysForModel(providers, tier, "gpt-4o", "openai", "api_key").map(
        (p) => p.label,
      ),
    ).toEqual(["Personal"]);
  });

  it("returns no available keys once every account is used for the model", () => {
    const tier: TierAssignment = {
      id: "t1",
      agent_id: "a1",
      tier: "simple",
      override_route: { provider: "openai", authType: "api_key", model: "gpt-4o" },
      auto_assigned_route: null,
      fallback_routes: [
        { provider: "openai", authType: "api_key", model: "gpt-4o", keyLabel: "Personal" },
      ],
      updated_at: "2026-01-01T00:00:00Z",
    };

    expect(availableRouteKeysForModel(providers, tier, "gpt-4o", "openai", "api_key")).toEqual(
      [],
    );
  });

  it("auto-selects the only remaining fallback key", () => {
    const tier: TierAssignment = {
      id: "t1",
      agent_id: "a1",
      tier: "simple",
      override_route: { provider: "openai", authType: "api_key", model: "gpt-4o" },
      auto_assigned_route: null,
      fallback_routes: null,
      updated_at: "2026-01-01T00:00:00Z",
    };

    expect(
      routeKeySelectionForModel({
        providers,
        tier,
        modelName: "gpt-4o",
        providerId: "openai",
        authType: "api_key",
        slot: "fallback",
      }),
    ).toMatchObject({
      autoLabel: "Personal",
      needsChoice: false,
      exhausted: false,
    });
  });
});
