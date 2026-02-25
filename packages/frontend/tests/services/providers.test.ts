import { describe, it, expect } from "vitest";
import {
  getModelLabel,
  PROVIDERS,
  STAGES,
} from "../../src/services/providers";

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

/* ── PROVIDERS constant ────────────────────────── */

describe("PROVIDERS", () => {
  it("has 9 providers defined", () => {
    expect(PROVIDERS).toHaveLength(9);
  });

  it("Ollama provider requires no API key and has dynamic models", () => {
    const ollama = PROVIDERS.find((p) => p.id === "ollama");
    expect(ollama).toBeDefined();
    expect(ollama!.noKeyRequired).toBe(true);
    expect(ollama!.models).toEqual([]);
    expect(ollama!.minKeyLength).toBe(0);
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
