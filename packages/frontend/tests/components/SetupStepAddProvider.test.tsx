import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

vi.stubGlobal("navigator", {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

import SetupStepAddProvider from "../../src/components/SetupStepAddProvider";

describe("SetupStepAddProvider", () => {
  const defaultProps = {
    apiKey: null as string | null,
    keyPrefix: null as string | null,
    baseUrl: "http://localhost:3001/v1",
  };

  it("renders heading", () => {
    render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(screen.getByText("Add Manifest as a provider")).toBeDefined();
  });

  it("shows description with manifest/auto model", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("manifest/auto");
    expect(container.textContent).toContain("routes each request");
  });

  it("shows base URL in the info grid", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("Base URL");
    expect(container.textContent).toContain("http://localhost:3001/v1");
  });

  it("shows Model in the info grid", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("Model");
  });

  it("shows OpenClaw tab by default", () => {
    render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(screen.getByText("OpenClaw")).toBeDefined();
  });

  it("shows OpenClaw snippet with direct models.providers config as single JSON", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_test_key" />
    ));
    expect(container.textContent).toContain("models.providers.manifest");
    expect(container.textContent).toContain("openai-completions");
    expect(container.textContent).toContain("mnfst_test_key");
    expect(container.textContent).toContain("agents.defaults.model.primary");
    expect(container.textContent).toContain("openclaw gateway restart");
  });

  it("includes full baseUrl in OpenClaw snippet JSON", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} baseUrl="https://app.manifest.build/v1" />
    ));
    const snippet = container.querySelector(".modal-terminal__code")!;
    expect(snippet.textContent).toContain("app.manifest.build/v1");
  });

  it("switches to Python SDK tab", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    fireEvent.click(screen.getByText("Python SDK"));
    expect(container.textContent).toContain('base_url="http://localhost:3001/v1"');
    expect(container.textContent).toContain('model="manifest/auto"');
  });

  it("switches to cURL tab", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    fireEvent.click(screen.getByText("cURL"));
    expect(container.textContent).toContain("curl http://localhost:3001/v1/chat/completions");
  });

  it("shows full API key with warning when provided", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_full_key_123" />
    ));
    expect(container.textContent).toContain("mnfst_full_key_123");
    expect(container.textContent).toContain("won't see it again");
  });

  it("shows key prefix hint when no full key", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} keyPrefix="mnfst_abc" />
    ));
    expect(container.textContent).toContain("mnfst_abc...");
    expect(container.textContent).toContain("Replace");
  });

  it("uses placeholder key when no apiKey or keyPrefix", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("mnfst_YOUR_KEY");
  });

  it("includes apiKey in SDK snippet when provided", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_real_key" />
    ));
    fireEvent.click(screen.getByText("Python SDK"));
    expect(container.textContent).toContain('api_key="mnfst_real_key"');
  });

  it("includes apiKey in cURL snippet when provided", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_real_key" />
    ));
    fireEvent.click(screen.getByText("cURL"));
    expect(container.textContent).toContain("Bearer mnfst_real_key");
  });

  it("has copy buttons for base URL and model", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const copyButtons = container.querySelectorAll(".modal-terminal__copy");
    // At least one for base URL, one for model, and one for code snippet
    expect(copyButtons.length).toBeGreaterThanOrEqual(3);
  });

  it("shows terminal UI", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.querySelector(".modal-terminal")).not.toBeNull();
  });

  it("has tab role on all three tab buttons", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(3);
  });

  it("renders custom baseUrl correctly", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} baseUrl="https://custom.example.com/v1" />
    ));
    expect(container.textContent).toContain("https://custom.example.com/v1");
  });
});
