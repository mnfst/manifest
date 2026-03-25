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

  it("shows description mentioning OpenAI-compatible client", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("OpenAI-compatible client");
  });

  it("shows manifest/auto as the model", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("manifest/auto");
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

  it("shows Python SDK tab by default", () => {
    render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(screen.getByText("Python SDK")).toBeDefined();
  });

  it("shows SDK snippet by default with base_url and model", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain('base_url="http://localhost:3001/v1"');
    expect(container.textContent).toContain('model="manifest/auto"');
  });

  it("shows cURL tab and switches to cURL snippet", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    fireEvent.click(screen.getByText("cURL"));
    expect(container.textContent).toContain("curl http://localhost:3001/v1/chat/completions");
  });

  it("shows full API key with warning when provided", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_full_key_123" />
    ));
    expect(container.textContent).toContain("mnfst_full_key_123");
    expect(container.textContent).toContain("will not be shown again");
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

  it("has tab role on SDK and cURL buttons", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(2);
  });

  it("renders custom baseUrl correctly", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} baseUrl="https://custom.example.com/v1" />
    ));
    expect(container.textContent).toContain("https://custom.example.com/v1");
  });
});
