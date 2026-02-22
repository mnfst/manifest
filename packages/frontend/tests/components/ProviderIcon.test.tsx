import { describe, it, expect } from "vitest";
import { render } from "@solidjs/testing-library";
import { providerIcon } from "../../src/components/ProviderIcon";

const KNOWN_PROVIDERS = [
  "openai",
  "anthropic",
  "gemini",
  "deepseek",
  "mistral",
  "xai",
  "qwen",
  "moonshot",
  "ollama",
];

describe("providerIcon", () => {
  for (const provider of KNOWN_PROVIDERS) {
    it(`returns an SVG for "${provider}"`, () => {
      const { container } = render(() => <div>{providerIcon(provider)}</div>);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
    });
  }

  it("returns null for unknown provider", () => {
    const { container } = render(() => <div>{providerIcon("unknown-provider")}</div>);
    const svg = container.querySelector("svg");
    expect(svg).toBeNull();
  });

  it("uses custom size when provided", () => {
    const { container } = render(() => <div>{providerIcon("openai", 32)}</div>);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.style.width).toBe("32px");
    expect(svg!.style.height).toBe("32px");
  });

  it("uses default size of 20 when size not provided", () => {
    const { container } = render(() => <div>{providerIcon("openai")}</div>);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.style.width).toBe("20px");
    expect(svg!.style.height).toBe("20px");
  });
});
