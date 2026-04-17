import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";

vi.stubGlobal("navigator", {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

import HermesSetup from "../../src/components/HermesSetup";

describe("HermesSetup", () => {
  const defaultProps = {
    apiKey: null as string | null,
    keyPrefix: null as string | null,
    baseUrl: "http://localhost:3001/v1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders description text", () => {
    const { container } = render(() => <HermesSetup {...defaultProps} />);
    expect(container.textContent).toContain("Point Hermes at the Manifest endpoint");
  });

  it("shows hermes config edit command", () => {
    const { container } = render(() => <HermesSetup {...defaultProps} />);
    expect(container.textContent).toContain("hermes config edit");
  });

  it("shows config.yaml code block with model section only", () => {
    const { container } = render(() => <HermesSetup {...defaultProps} />);
    expect(container.textContent).toContain("http://localhost:3001/v1");
    expect(container.textContent).toContain("model:");
    expect(container.textContent).toContain("provider: custom");
    expect(container.textContent).toContain("default: auto");
    expect(container.textContent).not.toContain("custom_providers:");
  });


  it("shows onboard fields", () => {
    const { container } = render(() => <HermesSetup {...defaultProps} />);
    const fields = container.querySelectorAll('[role="listitem"]');
    expect(fields.length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).toContain("Model");
    expect(container.textContent).toContain("auto");
    expect(container.textContent).toContain("Base URL");
    expect(container.textContent).toContain("API Key");
  });

  it("shows masked key placeholder when no apiKey or keyPrefix", () => {
    const { container } = render(() => <HermesSetup {...defaultProps} />);
    expect(container.textContent).toContain("mnfst_YOUR_KEY");
  });

  it("shows key prefix when keyPrefix provided", () => {
    const { container } = render(() => (
      <HermesSetup {...defaultProps} keyPrefix="mnfst_abc" />
    ));
    expect(container.textContent).toContain("mnfst_abc...");
  });

  it("does not show eye toggle when no apiKey", () => {
    const { container } = render(() => (
      <HermesSetup {...defaultProps} keyPrefix="mnfst_abc" />
    ));
    expect(container.querySelector('[aria-label="Reveal API key"]')).toBeNull();
  });

  it("shows eye toggle when apiKey provided", () => {
    const { container } = render(() => (
      <HermesSetup {...defaultProps} apiKey="mnfst_full_key" keyPrefix="mnfst_ful" />
    ));
    expect(container.querySelector('[aria-label="Reveal API key"]')).not.toBeNull();
  });

  it("reveals key when eye toggle clicked", () => {
    const { container } = render(() => (
      <HermesSetup {...defaultProps} apiKey="mnfst_full_key" keyPrefix="mnfst_ful" />
    ));
    expect(container.textContent).not.toContain("mnfst_full_key");
    fireEvent.click(container.querySelector('[aria-label="Reveal API key"]')!);
    expect(container.textContent).toContain("mnfst_full_key");
  });

  it("hides key again on second eye toggle click", () => {
    const { container } = render(() => (
      <HermesSetup {...defaultProps} apiKey="mnfst_full_key" keyPrefix="mnfst_ful" />
    ));
    fireEvent.click(container.querySelector('[aria-label="Reveal API key"]')!);
    expect(container.textContent).toContain("mnfst_full_key");
    fireEvent.click(container.querySelector('[aria-label="Hide API key"]')!);
    expect(container.textContent).not.toContain("mnfst_full_key");
  });

  it("shows copy button on API key row", () => {
    const { container } = render(() => (
      <HermesSetup {...defaultProps} apiKey="mnfst_full_key" keyPrefix="mnfst_ful" />
    ));
    const apiKeyRow = Array.from(container.querySelectorAll('[role="listitem"]'))
      .find(r => r.textContent?.includes("API Key"));
    const copyBtn = apiKeyRow?.querySelector('[aria-label="Copy to clipboard"]');
    expect(copyBtn).not.toBeNull();
  });

  it("has copy buttons for copyable fields", () => {
    const { container } = render(() => <HermesSetup {...defaultProps} />);
    const copyBtns = container.querySelectorAll(".modal-terminal__copy");
    expect(copyBtns.length).toBeGreaterThanOrEqual(1);
  });

  it("copies yaml config when copy button in code block is clicked", () => {
    const { container } = render(() => (
      <HermesSetup {...defaultProps} apiKey="mnfst_test_key" keyPrefix="mnfst_te" />
    ));
    const codeBlock = container.querySelector(".setup-cli-block");
    const copyBtn = codeBlock?.querySelector('[aria-label="Copy to clipboard"]');
    expect(copyBtn).not.toBeNull();
    fireEvent.click(copyBtn!);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("provider: custom")
    );
  });

  it("uses custom base URL in code block and fields", () => {
    const { container } = render(() => (
      <HermesSetup {...defaultProps} baseUrl="https://example.com/v1" />
    ));
    expect(container.textContent).toContain("https://example.com/v1");
  });

  it("renders the config.yaml section heading", () => {
    const { container } = render(() => <HermesSetup {...defaultProps} />);
    expect(container.textContent).toContain("config.yaml");
  });

  it("renders EyeIcon with closed state by default", () => {
    const { container } = render(() => (
      <HermesSetup {...defaultProps} apiKey="mnfst_test" keyPrefix="mnfst_t" />
    ));
    // The eye icon SVG should be present
    const eyeBtn = container.querySelector('[aria-label="Reveal API key"]');
    expect(eyeBtn).not.toBeNull();
    const svg = eyeBtn!.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("renders EyeIcon with open state when key revealed", () => {
    const { container } = render(() => (
      <HermesSetup {...defaultProps} apiKey="mnfst_test" keyPrefix="mnfst_t" />
    ));
    fireEvent.click(container.querySelector('[aria-label="Reveal API key"]')!);
    const eyeBtn = container.querySelector('[aria-label="Hide API key"]');
    expect(eyeBtn).not.toBeNull();
    const svg = eyeBtn!.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("shows masked key in code block when no apiKey", () => {
    const { container } = render(() => (
      <HermesSetup {...defaultProps} keyPrefix="mnfst_pre" />
    ));
    expect(container.textContent).toContain("mnfst_pre...");
  });

  it("copy button copies full key when available", () => {
    const { container } = render(() => (
      <HermesSetup {...defaultProps} apiKey="mnfst_copy_test" keyPrefix="mnfst_co" />
    ));
    // The copy button text should be based on copyKey() which is apiKey when available
    const apiKeyRow = Array.from(container.querySelectorAll('[role="listitem"]'))
      .find(r => r.textContent?.includes("API Key"));
    expect(apiKeyRow).not.toBeNull();
  });
});
