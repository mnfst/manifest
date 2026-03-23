import { describe, it, expect } from "vitest";
import {
  pricePerM,
  resolveProviderId,
  inferProviderFromModel,
  inferProviderName,
  stripCustomPrefix,
} from "../../src/services/routing-utils";

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
    expect(inferProviderFromModel("copilot/claude-sonnet-4")).toBe("copilot");
    expect(inferProviderFromModel("copilot/gpt-4o")).toBe("copilot");
    expect(inferProviderFromModel("copilot/gemini-2.5-pro")).toBe("copilot");
  });

  it("detects vendor-prefixed models as openrouter (catch-all)", () => {
    expect(inferProviderFromModel("anthropic/claude-opus-4")).toBe("openrouter");
    expect(inferProviderFromModel("meta-llama/llama-4-maverick")).toBe("openrouter");
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
