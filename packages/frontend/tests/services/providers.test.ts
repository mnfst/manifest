import { describe, it, expect } from "vitest";
import { PROVIDERS, STAGES, getModelLabel, getProvider } from "../../src/services/providers";
import { validateApiKey, validateSubscriptionKey } from "../../src/services/provider-utils";

/* ── getProvider ────────────────────────────────── */

describe("getProvider", () => {
  it("returns the provider definition for a known ID", () => {
    const result = getProvider("openai");
    expect(result).toBeDefined();
    expect(result!.name).toBe("OpenAI");
  });

  it("returns undefined for an unknown ID", () => {
    expect(getProvider("nonexistent")).toBeUndefined();
  });
});

/* ── validateApiKey ─────────────────────────────── */

describe("validateApiKey", () => {
  it("returns valid for a provider that requires no key", () => {
    const ollama = getProvider("ollama")!;
    expect(validateApiKey(ollama, "")).toEqual({ valid: true });
  });

  it("returns invalid when key is empty", () => {
    const openai = getProvider("openai")!;
    expect(validateApiKey(openai, "")).toEqual({
      valid: false,
      error: "API key is required",
    });
  });

  it("returns invalid when key is only whitespace", () => {
    const openai = getProvider("openai")!;
    expect(validateApiKey(openai, "   ")).toEqual({
      valid: false,
      error: "API key is required",
    });
  });

  it("returns invalid when key does not match expected prefix", () => {
    const anthropic = getProvider("anthropic")!;
    expect(validateApiKey(anthropic, "wrong-prefix-key-that-is-long-enough-for-validation")).toEqual({
      valid: false,
      error: 'Anthropic keys start with "sk-ant-"',
    });
  });

  it("returns invalid when key is too short", () => {
    const openai = getProvider("openai")!;
    expect(validateApiKey(openai, "sk-short")).toEqual({
      valid: false,
      error: "Key is too short (minimum 50 characters)",
    });
  });

  it("returns valid for a correct key", () => {
    const openai = getProvider("openai")!;
    const validKey = "sk-" + "a".repeat(60);
    expect(validateApiKey(openai, validKey)).toEqual({ valid: true });
  });

  it("validates MiniMax key prefix and length", () => {
    const minimax = getProvider("minimax")!;
    expect(validateApiKey(minimax, "")).toEqual({
      valid: false,
      error: "API key is required",
    });
    expect(validateApiKey(minimax, "wrong-prefix-key-that-is-long-enough-for-validation")).toEqual({
      valid: false,
      error: 'MiniMax keys start with "sk-api-"',
    });
    expect(validateApiKey(minimax, "sk-api-short")).toEqual({
      valid: false,
      error: "Key is too short (minimum 30 characters)",
    });
    expect(validateApiKey(minimax, "sk-api-" + "a".repeat(30))).toEqual({ valid: true });
  });

  it("validates Z.ai key with no prefix and minimum length", () => {
    const zai = getProvider("zai")!;
    expect(validateApiKey(zai, "")).toEqual({
      valid: false,
      error: "API key is required",
    });
    expect(validateApiKey(zai, "short")).toEqual({
      valid: false,
      error: "Key is too short (minimum 30 characters)",
    });
    expect(validateApiKey(zai, "a".repeat(30))).toEqual({ valid: true });
  });
});

/* ── validateSubscriptionKey ────────────────────── */

describe("validateSubscriptionKey", () => {
  it("returns invalid when token is empty", () => {
    const anthropic = getProvider("anthropic")!;
    expect(validateSubscriptionKey(anthropic, "")).toEqual({
      valid: false,
      error: "Token is required",
    });
  });

  it("returns invalid when token is too short", () => {
    const anthropic = getProvider("anthropic")!;
    expect(validateSubscriptionKey(anthropic, "short")).toEqual({
      valid: false,
      error: "Token is too short (minimum 10 characters)",
    });
  });

  it("returns invalid when Anthropic token has wrong prefix", () => {
    const anthropic = getProvider("anthropic")!;
    expect(validateSubscriptionKey(anthropic, "sk-wrong-prefix-long-enough-token")).toEqual({
      valid: false,
      error: 'Anthropic subscription tokens start with "sk-ant-oat"',
    });
  });

  it("returns valid for a correct Anthropic subscription token", () => {
    const anthropic = getProvider("anthropic")!;
    expect(validateSubscriptionKey(anthropic, "sk-ant-oat01-valid-token-here")).toEqual({
      valid: true,
    });
  });

  it("returns valid for an OpenAI subscription token (JWT format)", () => {
    const openai = getProvider("openai")!;
    expect(validateSubscriptionKey(openai, "eyJhbGciOiJSUzI1NiIsInR5cCI6Ikp")).toEqual({
      valid: true,
    });
  });

  it("returns invalid for an empty OpenAI subscription token", () => {
    const openai = getProvider("openai")!;
    expect(validateSubscriptionKey(openai, "")).toEqual({
      valid: false,
      error: "Token is required",
    });
  });

  it("returns invalid for a too-short OpenAI subscription token", () => {
    const openai = getProvider("openai")!;
    expect(validateSubscriptionKey(openai, "short")).toEqual({
      valid: false,
      error: "Token is too short (minimum 10 characters)",
    });
  });

  it("rejects an OpenAI API key in subscription mode", () => {
    const openai = getProvider("openai")!;
    expect(validateSubscriptionKey(openai, "sk-proj-1234567890abcdef")).toEqual({
      valid: false,
      error: "This looks like an API key. Use the API Key tab instead.",
    });
  });

  it("does not reject non-API-key tokens for providers without API_KEY_PREFIXES", () => {
    const deepseek = getProvider("deepseek")!;
    expect(validateSubscriptionKey(deepseek, "some-valid-token-here")).toEqual({
      valid: true,
    });
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

  it("resolves vendor-prefixed model via cross-provider lookup", () => {
    // OpenRouter provider doesn't have this model, but Anthropic does
    expect(getModelLabel("openrouter", "anthropic/claude-opus-4-6")).toBe("Claude Opus 4.6");
    expect(getModelLabel("openrouter", "openai/gpt-4o")).toBe("GPT-4o");
  });

  it("returns bare name when vendor-prefixed model is not in any provider", () => {
    expect(getModelLabel("openrouter", "newvendor/unknown-model")).toBe("unknown-model");
  });

  it("normalizes dots to dashes for vendor-prefixed models (e.g. OpenRouter)", () => {
    // "anthropic/claude-opus-4.6" → bare "claude-opus-4.6" → not found →
    // normalized "claude-opus-4-6" → found as "Claude Opus 4.6"
    expect(getModelLabel("openrouter", "anthropic/claude-opus-4.6")).toBe("Claude Opus 4.6");
  });

  it("skips dot-to-dash normalization when bare name already matches", () => {
    // "anthropic/claude-opus-4-6" → bare "claude-opus-4-6" → found directly
    // No normalization needed
    expect(getModelLabel("openrouter", "anthropic/claude-opus-4-6")).toBe("Claude Opus 4.6");
  });

  it("falls through dot-to-dash normalization when normalized model is not found", () => {
    // "vendor/unknown.model.name" → bare "unknown.model.name" → not found →
    // normalized "unknown-model-name" → still not found → returns bare
    expect(getModelLabel("openrouter", "vendor/unknown.model.name")).toBe("unknown.model.name");
  });
});

/* ── PROVIDERS constant ────────────────────────── */

describe("PROVIDERS", () => {
  it("has 12 providers defined", () => {
    expect(PROVIDERS).toHaveLength(12);
  });

  it("providers are sorted alphabetically by name", () => {
    const names = PROVIDERS.map((p) => p.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it("Ollama is marked localOnly with no key required", () => {
    const ollama = PROVIDERS.find((p) => p.id === "ollama")!;
    expect(ollama).toBeDefined();
    expect(ollama.noKeyRequired).toBe(true);
    expect(ollama.localOnly).toBe(true);
    expect(ollama.models).toEqual([]);
    expect(ollama.minKeyLength).toBe(0);
  });

  it("each provider has required fields", () => {
    for (const p of PROVIDERS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.color).toBeTruthy();
      expect(p.initial).toBeTruthy();
      expect(p.subtitle).toBeTruthy();
      expect(Array.isArray(p.models)).toBe(true);
    }
  });

  it("OpenAI supports subscription with OAuth browser flow", () => {
    const openai = PROVIDERS.find((p) => p.id === "openai")!;
    expect(openai.supportsSubscription).toBe(true);
    expect(openai.subscriptionLabel).toBe("ChatGPT Plus/Pro/Team");
    expect(openai.subscriptionKeyPlaceholder).toBeUndefined();
    expect(openai.subscriptionCommand).toBeUndefined();
    expect(openai.subscriptionOAuth).toBe(true);
  });

  it("Anthropic supports subscription", () => {
    const anthropic = PROVIDERS.find((p) => p.id === "anthropic")!;
    expect(anthropic.supportsSubscription).toBe(true);
    expect(anthropic.subscriptionLabel).toBe("Claude Max / Pro subscription");
  });

  it("does not have API-key-specific fields", () => {
    for (const p of PROVIDERS) {
      expect(p).not.toHaveProperty("inputType");
      expect(p).not.toHaveProperty("inputLabel");
      expect(p).not.toHaveProperty("placeholder");
      expect(p).not.toHaveProperty("keyPattern");
      expect(p).not.toHaveProperty("keyHint");
      expect(p).not.toHaveProperty("docsUrl");
    }
  });
});

/* ── STAGES constant ───────────────────────────── */

describe("STAGES", () => {
  it("has 4 stages", () => {
    expect(STAGES).toHaveLength(4);
  });

  it("has correct stage IDs", () => {
    expect(STAGES.map((s) => s.id)).toEqual(["simple", "standard", "complex", "reasoning"]);
  });
});
