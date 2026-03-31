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
    expect(container.textContent).toContain("route each request");
  });

  it("shows model hint in description", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("manifest/auto");
  });

  it("shows full API key in CLI snippet by default when provided", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_test_key" />
    ));
    expect(container.textContent).toContain("mnfst_test_key");
  });

  it("hides full key in CLI snippet when hideFullKey is set", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_secret_key" keyPrefix="mnfst_abc" hideFullKey />
    ));
    expect(container.textContent).not.toContain("mnfst_secret_key");
    expect(container.textContent).toContain("mnfst_abc...");
  });

  it("shows eye toggle to reveal key in CLI tab when hideFullKey and apiKey are set", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_secret_key" keyPrefix="mnfst_abc" hideFullKey />
    ));
    const revealBtn = container.querySelector('[aria-label="Reveal API key in snippet"]');
    expect(revealBtn).not.toBeNull();
  });

  it("reveals key in CLI snippet when eye toggle is clicked", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_secret_key" keyPrefix="mnfst_abc" hideFullKey />
    ));
    expect(container.textContent).not.toContain("mnfst_secret_key");
    const revealBtn = container.querySelector('[aria-label="Reveal API key in snippet"]')!;
    fireEvent.click(revealBtn);
    expect(container.textContent).toContain("mnfst_secret_key");
  });

  it("hides key again in CLI snippet when eye toggle is clicked twice", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_secret_key" keyPrefix="mnfst_abc" hideFullKey />
    ));
    const revealBtn = container.querySelector('[aria-label="Reveal API key in snippet"]')!;
    fireEvent.click(revealBtn);
    expect(container.textContent).toContain("mnfst_secret_key");
    const hideBtn = container.querySelector('[aria-label="Hide API key in snippet"]')!;
    fireEvent.click(hideBtn);
    expect(container.textContent).not.toContain("mnfst_secret_key");
    expect(container.textContent).toContain("mnfst_abc...");
  });

  it("does not show eye toggle when no apiKey is available", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} keyPrefix="mnfst_abc" />
    ));
    expect(container.querySelector('[aria-label="Reveal API key in snippet"]')).toBeNull();
    expect(container.querySelector('[aria-label="Hide API key in snippet"]')).toBeNull();
  });

  it("shows eye toggle in Interactive wizard API Key row", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_secret_key" keyPrefix="mnfst_abc" hideFullKey />
    ));
    const tabs = container.querySelectorAll(".panel__tab");
    fireEvent.click(tabs[1]);
    const revealBtn = container.querySelector('[aria-label="Reveal API key in wizard"]');
    expect(revealBtn).not.toBeNull();
  });

  it("reveals key in wizard when eye toggle is clicked", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_secret_key" keyPrefix="mnfst_abc" hideFullKey />
    ));
    const tabs = container.querySelectorAll(".panel__tab");
    fireEvent.click(tabs[1]);
    expect(container.textContent).not.toContain("mnfst_secret_key");
    const revealBtn = container.querySelector('[aria-label="Reveal API key in wizard"]')!;
    fireEvent.click(revealBtn);
    expect(container.textContent).toContain("mnfst_secret_key");
  });

  it("does not show eye toggle in wizard when no apiKey", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} keyPrefix="mnfst_abc" />
    ));
    const tabs = container.querySelectorAll(".panel__tab");
    fireEvent.click(tabs[1]);
    expect(container.querySelector('[aria-label="Reveal API key in wizard"]')).toBeNull();
  });

  it("shows full key by default in wizard when hideFullKey is not set", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_visible_key" />
    ));
    const tabs = container.querySelectorAll(".panel__tab");
    fireEvent.click(tabs[1]);
    expect(container.textContent).toContain("mnfst_visible_key");
  });

  it("shows keyPrefix in CLI snippet when only prefix is provided", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} keyPrefix="mnfst_abc" />
    ));
    expect(container.textContent).toContain("mnfst_abc...");
  });

  it("shows CLI configuration tab active by default", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const activeTab = container.querySelector(".panel__tab--active");
    expect(activeTab).not.toBeNull();
    expect(activeTab!.textContent).toBe("CLI configuration");
  });

  it("shows CLI snippet content by default", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("models.providers.manifest");
    expect(container.textContent).toContain("openai-completions");
    expect(container.textContent).toContain("openclaw gateway restart");
  });

  it("CLI snippet includes baseUrl", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} baseUrl="https://app.manifest.build/v1" />
    ));
    expect(container.textContent).toContain("app.manifest.build/v1");
  });

  it("CLI snippet uses placeholder key when no apiKey or keyPrefix", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("mnfst_YOUR_KEY");
  });

  it("shows both tab buttons", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const tabs = container.querySelectorAll(".panel__tab");
    expect(tabs.length).toBe(2);
    expect(tabs[0].textContent).toBe("CLI configuration");
    expect(tabs[1].textContent).toBe("Interactive wizard");
  });

  it("switches to Interactive wizard tab on click", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const tabs = container.querySelectorAll(".panel__tab");
    fireEvent.click(tabs[1]);
    expect(container.textContent).toContain("openclaw onboard");
    expect(container.textContent).toContain("Custom Provider");
  });

  it("onboard tab shows field values to copy", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const tabs = container.querySelectorAll(".panel__tab");
    fireEvent.click(tabs[1]);
    expect(container.textContent).toContain("API Base URL");
    expect(container.textContent).toContain("http://localhost:3001/v1");
    expect(container.textContent).toContain("API Key");
    expect(container.textContent).toContain("Endpoint compatibility");
    expect(container.textContent).toContain("OpenAI-compatible");
    expect(container.textContent).toContain("Model ID");
    expect(container.textContent).toContain("Endpoint ID");
    expect(container.textContent).toContain("manifest");
  });

  it("has copy buttons for CLI snippet", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const copyButtons = container.querySelectorAll(".modal-terminal__copy");
    expect(copyButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders custom baseUrl correctly", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} baseUrl="https://custom.example.com/v1" />
    ));
    expect(container.textContent).toContain("https://custom.example.com/v1");
  });

  it("uses setup-step__heading class", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.querySelector(".setup-step__heading")).not.toBeNull();
  });

  it("uses setup-method-tabs class for method tabs", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.querySelector(".setup-method-tabs")).not.toBeNull();
  });

  it("uses setup-method-tabs container", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.querySelector(".setup-method-tabs")).not.toBeNull();
  });

  it("active tab changes on click", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const tabs = container.querySelectorAll(".panel__tab");
    expect(tabs[0].classList.contains("panel__tab--active")).toBe(true);
    expect(tabs[1].classList.contains("panel__tab--active")).toBe(false);
    fireEvent.click(tabs[1]);
    expect(tabs[0].classList.contains("panel__tab--active")).toBe(false);
    expect(tabs[1].classList.contains("panel__tab--active")).toBe(true);
  });
});
