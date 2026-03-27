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

  // Accordion order: CLI (expanded), Interactive wizard, Environment variable
  it("shows CLI method expanded by default", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.querySelector("#method-cli")).not.toBeNull();
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

  // Accordion: interactive wizard (collapsed by default)
  it("shows interactive wizard section (collapsed)", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("Interactive wizard");
    expect(container.querySelector("#method-onboard")).toBeNull();
  });

  it("expands onboard method and collapses CLI on click", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const headers = container.querySelectorAll(".setup-method__header");
    fireEvent.click(headers[1]); // second = onboard
    expect(container.querySelector("#method-onboard")).not.toBeNull();
    expect(container.textContent).toContain("openclaw onboard");
    // CLI should be collapsed
    expect(container.querySelector("#method-cli")).toBeNull();
  });

  it("onboard section mentions Custom Provider", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const headers = container.querySelectorAll(".setup-method__header");
    fireEvent.click(headers[1]);
    expect(container.textContent).toContain("Custom Provider");
  });

  it("onboard section shows field values to copy", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const headers = container.querySelectorAll(".setup-method__header");
    fireEvent.click(headers[1]);
    expect(container.textContent).toContain("API Base URL");
    expect(container.textContent).toContain("http://localhost:3001/v1");
    expect(container.textContent).toContain("API Key");
    expect(container.textContent).toContain("Endpoint compatibility");
    expect(container.textContent).toContain("OpenAI-compatible");
    expect(container.textContent).toContain("Model ID");
  });

  // Accordion: env var (collapsed by default)
  it("shows env var section (collapsed)", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("Environment variable");
    expect(container.querySelector("#method-env")).toBeNull();
  });

  it("expands env var method on click", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const headers = container.querySelectorAll(".setup-method__header");
    fireEvent.click(headers[2]); // third = env
    expect(container.querySelector("#method-env")).not.toBeNull();
    expect(container.textContent).toContain("MANIFEST_API_KEY");
  });

  it("env snippet with full key when provided", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_real_key" />
    ));
    const headers = container.querySelectorAll(".setup-method__header");
    fireEvent.click(headers[2]);
    expect(container.textContent).toContain('MANIFEST_API_KEY="mnfst_real_key"');
  });

  it("includes MANIFEST_ENDPOINT in env snippet for non-production baseUrl", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const headers = container.querySelectorAll(".setup-method__header");
    fireEvent.click(headers[2]);
    expect(container.textContent).toContain("MANIFEST_ENDPOINT");
  });

  it("omits MANIFEST_ENDPOINT for app.manifest.build baseUrl", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} baseUrl="https://app.manifest.build/v1" />
    ));
    const headers = container.querySelectorAll(".setup-method__header");
    fireEvent.click(headers[2]);
    expect(container.querySelector("#method-env")?.textContent).not.toContain("MANIFEST_ENDPOINT");
  });

  // General accordion behavior
  it("collapses open method when clicking its header again", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const headers = container.querySelectorAll(".setup-method__header");
    fireEvent.click(headers[0]); // CLI is open, click to close
    expect(container.querySelector("#method-cli")).toBeNull();
  });

  it("has aria-expanded on method headers", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const headers = container.querySelectorAll(".setup-method__header");
    expect(headers[0].getAttribute("aria-expanded")).toBe("true");  // CLI expanded
    expect(headers[1].getAttribute("aria-expanded")).toBe("false"); // onboard collapsed
    expect(headers[2].getAttribute("aria-expanded")).toBe("false"); // env collapsed
  });

  it("has aria-controls on method headers", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const headers = container.querySelectorAll(".setup-method__header");
    expect(headers[0].getAttribute("aria-controls")).toBe("method-cli");
    expect(headers[1].getAttribute("aria-controls")).toBe("method-onboard");
    expect(headers[2].getAttribute("aria-controls")).toBe("method-env");
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
});
