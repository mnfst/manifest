import { describe, it, expect } from "vitest";
import {
  pricePerM,
  resolveProviderId,
  inferProviderFromModel,
  inferProviderName,
} from "../../src/services/routing-utils";

/* ── pricePerM ─────────────────────────────────── */

describe("pricePerM", () => {
  it('returns "Free" for zero price', () => {
    expect(pricePerM(0)).toBe("Free");
  });

  it('returns "$0.00" for very small non-zero price', () => {
    expect(pricePerM(0.000000000001)).toBe("$0.00");
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

  it("resolves by display name (case-insensitive)", () => {
    expect(resolveProviderId("Mistral AI")).toBe("mistral");
    expect(resolveProviderId("xAI")).toBe("xai");
    expect(resolveProviderId("Kimi")).toBe("moonshot");
  });

  it("returns undefined for unknown provider", () => {
    expect(resolveProviderId("nonexistent")).toBeUndefined();
  });
});

/* ── inferProviderFromModel ───────────────────── */

describe("inferProviderFromModel", () => {
  it("detects Ollama models by colon convention", () => {
    expect(inferProviderFromModel("qwen2.5:0.5b")).toBe("ollama");
    expect(inferProviderFromModel("llama3:latest")).toBe("ollama");
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

  it("detects DeepSeek models", () => {
    expect(inferProviderFromModel("deepseek-chat")).toBe("deepseek");
    expect(inferProviderFromModel("deepseek-r1")).toBe("deepseek");
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

  it("detects Qwen models", () => {
    expect(inferProviderFromModel("qwen3-235b-a22b")).toBe("qwen");
    expect(inferProviderFromModel("qwq-32b")).toBe("qwen");
  });

  it("detects openrouter/ prefixed models", () => {
    expect(inferProviderFromModel("openrouter/auto")).toBe("openrouter");
  });

  it("detects vendor-prefixed models as openrouter (catch-all)", () => {
    expect(inferProviderFromModel("anthropic/claude-opus-4")).toBe("openrouter");
    expect(inferProviderFromModel("meta-llama/llama-4-maverick")).toBe("openrouter");
  });

  it("returns undefined for unrecognized models", () => {
    expect(inferProviderFromModel("some-random-model")).toBeUndefined();
  });
});

/* ── inferProviderName ────────────────────────── */

describe("inferProviderName", () => {
  it("returns provider display name for known models", () => {
    expect(inferProviderName("gpt-4o")).toBe("OpenAI");
    expect(inferProviderName("claude-opus-4")).toBe("Anthropic");
    expect(inferProviderName("gemini-2.5-pro")).toBe("Gemini");
  });

  it("returns Ollama for colon-tagged models", () => {
    expect(inferProviderName("llama3:latest")).toBe("Ollama");
  });

  it("returns undefined for unrecognized models", () => {
    expect(inferProviderName("unknown-model")).toBeUndefined();
  });
});
