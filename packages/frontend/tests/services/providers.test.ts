import { describe, it, expect } from "vitest";
import {
  getModelLabel,
  getProvider,
  validateApiKey,
  validateSubscriptionKey,
  PROVIDERS,
  STAGES,
} from "../../src/services/providers";
import { ROUTING_PROVIDER_API_KEY_URLS, EMAIL_PROVIDER_API_KEY_URLS, getRoutingProviderApiKeyUrl, getEmailProviderApiKeyUrl } from "../../src/services/provider-api-key-urls";

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
});

/* ── getModelLabel ──────────────────────────────── */

describe("getModelLabel", () => {
  it("falls back to formatModelSlug for unknown models", () => {
    // PROVIDERS have empty models[], so getModelLabel always falls back to formatModelSlug
    // formatModelSlug replaces dashes with spaces and capitalizes each word
    expect(getModelLabel("openai", "gpt-4o")).toBe("Gpt 4o");
    expect(getModelLabel("anthropic", "claude-opus-4")).toBe("Claude Opus 4");
  });

  it("returns modelValue when providerId is not found", () => {
    expect(getModelLabel("nonexistent", "some-model")).toBe("some-model");
  });

  it("formats via formatModelSlug when date suffix is present", () => {
    // No models in PROVIDERS, so date-suffix stripping finds nothing;
    // falls back to formatModelSlug on the full slug
    expect(getModelLabel("anthropic", "claude-sonnet-4-20261231")).toBe("Claude Sonnet 4 20261231");
  });

  it("formats via formatModelSlug for non-8-digit suffixes", () => {
    // No models in PROVIDERS to match; formatModelSlug processes the full slug
    expect(getModelLabel("anthropic", "claude-sonnet-4-1234567")).toBe("Claude Sonnet 4 1234567");
  });

  it("formats via formatModelSlug for extended model names", () => {
    // No prefix match since models are empty; formatModelSlug processes full slug
    expect(getModelLabel("openai", "gpt-4o-something-custom")).toBe("Gpt 4o Something Custom");
  });

  it("formats via formatModelSlug as fallback when nothing matches", () => {
    expect(getModelLabel("openai", "completely-unknown-model")).toBe("Completely Unknown Model");
  });

  it("formats dated model variant via formatModelSlug", () => {
    expect(getModelLabel("openai", "gpt-4o-2024-11-20")).toBe("Gpt 4o 2024 11 20");
  });

  it("formats anthropic dated models via formatModelSlug", () => {
    // No models in PROVIDERS, so all paths fall through to formatModelSlug
    expect(getModelLabel("anthropic", "claude-opus-4-20250514")).toBe("Claude Opus 4 20250514");
    expect(getModelLabel("anthropic", "claude-opus-4-20260101")).toBe("Claude Opus 4 20260101");
  });

  it("formats vendor-prefixed model bare name via formatModelSlug", () => {
    // No cross-provider lookup succeeds (models are empty), so formatModelSlug on bare name
    expect(getModelLabel("openrouter", "anthropic/claude-opus-4-6")).toBe("Claude Opus 4 6");
    expect(getModelLabel("openrouter", "openai/gpt-4o")).toBe("Gpt 4o");
  });

  it("formats bare name via formatModelSlug when vendor-prefixed model is unknown", () => {
    expect(getModelLabel("openrouter", "newvendor/unknown-model")).toBe("Unknown Model");
  });

  it("formats vendor-prefixed model with dots via formatModelSlug", () => {
    // No models to find, formatModelSlug on bare name "claude-opus-4.6"
    // formatModelSlug replaces dashes with spaces (dots are untouched)
    expect(getModelLabel("openrouter", "anthropic/claude-opus-4.6")).toBe("Claude Opus 4.6");
  });

  it("formats vendor-prefixed model with dashes via formatModelSlug", () => {
    // "anthropic/claude-opus-4-6" → bare "claude-opus-4-6" → formatModelSlug → "Claude Opus 4 6"
    expect(getModelLabel("openrouter", "anthropic/claude-opus-4-6")).toBe("Claude Opus 4 6");
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

  it("requires an API key URL for every provider that needs one", () => {
    const missingProviderIds = PROVIDERS.filter(
      (provider) => !provider.noKeyRequired && !ROUTING_PROVIDER_API_KEY_URLS[provider.id],
    ).map((provider) => provider.id);
    expect(missingProviderIds).toEqual([]);
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

/* ── EMAIL_PROVIDER_API_KEY_URLS ─────────────── */

describe("EMAIL_PROVIDER_API_KEY_URLS", () => {
  it("has a URL for every email provider", () => {
    expect(EMAIL_PROVIDER_API_KEY_URLS).toHaveProperty("resend");
    expect(EMAIL_PROVIDER_API_KEY_URLS).toHaveProperty("mailgun");
    expect(EMAIL_PROVIDER_API_KEY_URLS).toHaveProperty("sendgrid");
  });
});

/* ── getRoutingProviderApiKeyUrl ─────────────── */

describe("getRoutingProviderApiKeyUrl", () => {
  it("returns a URL for a known provider", () => {
    expect(getRoutingProviderApiKeyUrl("openai")).toBe("https://platform.openai.com/api-keys");
  });

  it("returns undefined for an unknown provider", () => {
    expect(getRoutingProviderApiKeyUrl("unknown")).toBeUndefined();
  });
});

/* ── getEmailProviderApiKeyUrl ───────────────── */

describe("getEmailProviderApiKeyUrl", () => {
  it("returns a URL for a known email provider", () => {
    expect(getEmailProviderApiKeyUrl("resend")).toBe("https://resend.com/api-keys");
  });

  it("returns undefined for an unknown provider", () => {
    expect(getEmailProviderApiKeyUrl("unknown")).toBeUndefined();
  });
});
