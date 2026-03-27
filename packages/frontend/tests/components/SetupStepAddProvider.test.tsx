import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

vi.stubGlobal("navigator", {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

vi.mock("../../src/components/ApiKeyDisplay.jsx", () => ({
  default: (props: any) => (
    <div data-testid="api-key-display" data-key={props.apiKey ?? ""} data-prefix={props.keyPrefix ?? ""}>
      ApiKeyDisplay
    </div>
  ),
}));

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

  it("shows base URL in the info grid", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("Base URL");
    expect(container.textContent).toContain("http://localhost:3001/v1");
  });

  it("shows Model in the info grid", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("Model");
  });

  it("renders ApiKeyDisplay component", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_test_key" />
    ));
    const display = container.querySelector('[data-testid="api-key-display"]');
    expect(display).not.toBeNull();
    expect(display!.getAttribute("data-key")).toBe("mnfst_test_key");
  });

  it("passes keyPrefix to ApiKeyDisplay", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} keyPrefix="mnfst_abc" />
    ));
    const display = container.querySelector('[data-testid="api-key-display"]');
    expect(display!.getAttribute("data-prefix")).toBe("mnfst_abc");
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

  it("CLI snippet includes apiKey when provided", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_test_key" />
    ));
    expect(container.textContent).toContain("mnfst_test_key");
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

  it("CLI snippet uses key prefix when only prefix provided", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} keyPrefix="mnfst_abc" />
    ));
    expect(container.textContent).toContain("mnfst_abc...");
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
  });

  it("has copy buttons for base URL and model", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const copyButtons = container.querySelectorAll(".modal-terminal__copy");
    expect(copyButtons.length).toBeGreaterThanOrEqual(3);
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

  it("uses setup-info-grid class for info cards", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.querySelector(".setup-info-grid")).not.toBeNull();
  });

  it("does not show recommended badge", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.querySelector(".setup-method__badge")).toBeNull();
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
