import { describe, it, expect } from "vitest";
import { render } from "@solidjs/testing-library";
import { providerIcon, customProviderLogo } from "../../src/components/ProviderIcon";

const KNOWN_PROVIDERS = [
  "openai",
  "anthropic",
  "copilot",
  "gemini",
  "deepseek",
  "mistral",
  "xai",
  "qwen",
  "moonshot",
  "openrouter",
  "ollama",
  "minimax",
  "zai",
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

describe("customProviderLogo", () => {
  it("returns an img for a known provider name (cohere)", () => {
    const { container } = render(() => <div>{customProviderLogo("cohere")}</div>);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("/icons/cohere.svg");
    expect(img!.getAttribute("alt")).toBe("cohere");
    expect(img!.getAttribute("width")).toBe("16");
    expect(img!.getAttribute("height")).toBe("16");
  });

  it("matches case-insensitively by name", () => {
    const { container } = render(() => <div>{customProviderLogo("Cohere")}</div>);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
  });

  it("returns null for an unknown provider name", () => {
    const { container } = render(() => <div>{customProviderLogo("unknown-provider")}</div>);
    const img = container.querySelector("img");
    expect(img).toBeNull();
  });

  it("uses custom size when provided", () => {
    const { container } = render(() => <div>{customProviderLogo("cohere", 24)}</div>);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("width")).toBe("24");
    expect(img!.getAttribute("height")).toBe("24");
  });

  it("resolves by base URL when name does not match", () => {
    const { container } = render(() => (
      <div>{customProviderLogo("my-cohere", 16, "https://api.cohere.ai/v1")}</div>
    ));
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("/icons/cohere.svg");
  });

  it("returns null when base URL does not match any pattern", () => {
    const { container } = render(() => (
      <div>{customProviderLogo("custom", 16, "https://api.example.com/v1")}</div>
    ));
    const img = container.querySelector("img");
    expect(img).toBeNull();
  });

  it("returns null when no base URL and name is unknown", () => {
    const { container } = render(() => <div>{customProviderLogo("random")}</div>);
    const img = container.querySelector("img");
    expect(img).toBeNull();
  });
});
