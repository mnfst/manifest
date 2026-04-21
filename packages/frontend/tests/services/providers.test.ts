import { describe, it, expect } from "vitest";
import { PROVIDERS, STAGES, getModelLabel, getProvider } from "../../src/services/providers";
import { validateApiKey, validateSubscriptionKey } from "../../src/services/provider-utils";
import { ROUTING_PROVIDER_API_KEY_URLS, EMAIL_PROVIDER_API_KEY_URLS, SUBSCRIPTION_PROVIDER_KEY_URLS, getRoutingProviderApiKeyUrl, getEmailProviderApiKeyUrl, getSubscriptionProviderKeyUrl } from "../../src/services/provider-api-key-urls";

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
      error: 'MiniMax keys start with "sk-"',
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
  it("returns the static label for known models", () => {
    // OpenAI has a static models list, so exact match returns the label
    expect(getModelLabel("openai", "gpt-4o")).toBe("GPT-4o");
    // Anthropic has empty models[], so getModelLabel falls back to formatModelSlug
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

  it("returns prefix-matched label for extended model names", () => {
    // OpenAI has gpt-4o in its models list; prefix match returns that label
    expect(getModelLabel("openai", "gpt-4o-something-custom")).toBe("GPT-4o");
  });

  it("formats via formatModelSlug as fallback when nothing matches", () => {
    expect(getModelLabel("openai", "completely-unknown-model")).toBe("Completely Unknown Model");
  });

  it("returns static label for dated model variant", () => {
    expect(getModelLabel("openai", "gpt-4o-2024-11-20")).toBe("GPT-4o (2024-11-20)");
  });

  it("formats anthropic dated models via formatModelSlug", () => {
    // No models in PROVIDERS, so all paths fall through to formatModelSlug
    expect(getModelLabel("anthropic", "claude-opus-4-20250514")).toBe("Claude Opus 4 20250514");
    expect(getModelLabel("anthropic", "claude-opus-4-20260101")).toBe("Claude Opus 4 20260101");
  });

  it("resolves vendor-prefixed model names via cross-provider lookup", () => {
    // Anthropic has empty models[], so formatModelSlug on bare name
    expect(getModelLabel("openrouter", "anthropic/claude-opus-4-6")).toBe("Claude Opus 4 6");
    // OpenAI has gpt-4o in its models list, so cross-provider lookup finds it
    expect(getModelLabel("openrouter", "openai/gpt-4o")).toBe("GPT-4o");
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

  it("falls through dot-to-dash normalization when normalized model is not found", () => {
    // "vendor/unknown.model.name" → bare "unknown.model.name" → not found →
    // normalized "unknown-model-name" → still not found → returns bare
    expect(getModelLabel("openrouter", "vendor/unknown.model.name")).toBe("Unknown.Model.Name");
  });
});

/* ── PROVIDERS constant ────────────────────────── */

describe("PROVIDERS", () => {
  it("has 16 providers defined", () => {
    expect(PROVIDERS).toHaveLength(16);
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
    expect(openai.subscriptionAuthMode).toBe("popup_oauth");
  });

  it("Anthropic supports subscription", () => {
    const anthropic = PROVIDERS.find((p) => p.id === "anthropic")!;
    expect(anthropic.supportsSubscription).toBe(true);
    expect(anthropic.subscriptionLabel).toBe("Claude Max / Pro subscription");
    expect(anthropic.subscriptionAuthMode).toBe("token");
  });

  it("GitHub Copilot is subscription-only", () => {
    const copilot = PROVIDERS.find((p) => p.id === "copilot")!;
    expect(copilot.supportsSubscription).toBe(true);
    expect(copilot.subscriptionOnly).toBe(true);
    expect(copilot.deviceLogin).toBe(true);
    expect(copilot.subscriptionAuthMode).toBe("device_code");
  });

  it("MiniMax supports subscription with device-code flow", () => {
    const minimax = PROVIDERS.find((p) => p.id === "minimax")!;
    expect(minimax.supportsSubscription).toBe(true);
    expect(minimax.subscriptionLabel).toBe("MiniMax Coding Plan");
    expect(minimax.subscriptionAuthMode).toBe("device_code");
  });

  it("Ollama Cloud is subscription-only with token paste flow", () => {
    const cloud = PROVIDERS.find((p) => p.id === "ollama-cloud")!;
    expect(cloud).toBeDefined();
    expect(cloud.name).toBe("Ollama Cloud");
    expect(cloud.supportsSubscription).toBe(true);
    expect(cloud.subscriptionOnly).toBe(true);
    expect(cloud.subscriptionLabel).toBe("Ollama Cloud subscription");
    expect(cloud.subscriptionAuthMode).toBe("token");
    expect(cloud.subscriptionKeyPlaceholder).toBe("Paste your Ollama Cloud API key");
    expect(cloud.subscriptionCredentialKind).toBe("api-key");
    expect(cloud.localOnly).toBeUndefined();
    expect(cloud.noKeyRequired).toBeUndefined();
    expect(cloud.subscriptionCommand).toBeUndefined();
  });

  it("provides an API key URL for ollama-cloud in both the API-key and subscription maps", () => {
    expect(getRoutingProviderApiKeyUrl("ollama-cloud")).toBe(
      "https://ollama.com/settings/keys",
    );
    expect(getSubscriptionProviderKeyUrl("ollama-cloud")).toBe(
      "https://ollama.com/settings/keys",
    );
  });

  it("exposes a subscription-key URL for every token-mode subscription-only provider", () => {
    const missing = PROVIDERS.filter(
      (p) =>
        p.subscriptionOnly &&
        p.subscriptionAuthMode === "token" &&
        !p.subscriptionSignInUrl &&
        !SUBSCRIPTION_PROVIDER_KEY_URLS[p.id],
    ).map((p) => p.id);
    expect(missing).toEqual([]);
  });

  it("Z.ai supports GLM Coding Plan subscription with token flow", () => {
    const zai = PROVIDERS.find((p) => p.id === "zai")!;
    expect(zai.supportsSubscription).toBe(true);
    expect(zai.subscriptionLabel).toBe("GLM Coding Plan");
    expect(zai.subscriptionAuthMode).toBe("token");
    expect(zai.subscriptionKeyPlaceholder).toBe("Paste your Z.ai API key");
    expect(zai.subscriptionOnly).toBeUndefined();
  });

  it("provides a subscription-key URL for Z.ai pointing at the API key dashboard", () => {
    expect(getSubscriptionProviderKeyUrl("zai")).toBe(
      "https://z.ai/manage-apikey/apikey-list",
    );
  });

  it("OpenCode Go is subscription-only with a sign-in URL", () => {
    const og = PROVIDERS.find((p) => p.id === "opencode-go")!;
    expect(og).toBeDefined();
    expect(og.supportsSubscription).toBe(true);
    expect(og.subscriptionOnly).toBe(true);
    expect(og.subscriptionAuthMode).toBe("token");
    expect(og.subscriptionLabel).toBe("OpenCode Go (beta)");
    expect(og.subscriptionKeyPlaceholder).toBe("Paste your OpenCode API key");
    expect(og.subscriptionSignInUrl).toBe("https://opencode.ai/auth");
    expect(og.subscriptionSignInLabel).toBe("Sign in to OpenCode Go");
    expect(og.subscriptionSignInHint).toMatch(/Sign in to OpenCode Go/);
    expect(og.subscriptionSignInHint).not.toMatch(/Zen/i);
    expect(og.beta).toBe(true);
  });

  it("OpenCode Go has no hardcoded model list (catalog is dynamic)", () => {
    const og = PROVIDERS.find((p) => p.id === "opencode-go")!;
    expect(og.models).toEqual([]);
  });

  it("OpenCode Go subscription key is validated with generic min-length check", () => {
    const og = PROVIDERS.find((p) => p.id === "opencode-go")!;
    expect(validateSubscriptionKey(og, "")).toEqual({
      valid: false,
      error: "Token is required",
    });
    expect(validateSubscriptionKey(og, "short")).toEqual({
      valid: false,
      error: "Token is too short (minimum 10 characters)",
    });
    expect(validateSubscriptionKey(og, "a-valid-opencode-token-1234")).toEqual({
      valid: true,
    });
  });

  it("requires an API key URL for every provider that needs one", () => {
    const missingProviderIds = PROVIDERS.filter(
      (provider) =>
        !provider.noKeyRequired &&
        !provider.deviceLogin &&
        !provider.subscriptionOnly &&
        !ROUTING_PROVIDER_API_KEY_URLS[provider.id],
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

/* ── getSubscriptionProviderKeyUrl ─────────── */

describe("getSubscriptionProviderKeyUrl", () => {
  it("returns the Ollama settings page URL for ollama-cloud", () => {
    expect(getSubscriptionProviderKeyUrl("ollama-cloud")).toBe(
      "https://ollama.com/settings/keys",
    );
  });

  it("returns undefined for subscription providers whose token comes from elsewhere (e.g. anthropic setup-token via CLI)", () => {
    expect(getSubscriptionProviderKeyUrl("anthropic")).toBeUndefined();
  });

  it("returns undefined for an unknown provider", () => {
    expect(getSubscriptionProviderKeyUrl("unknown")).toBeUndefined();
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
