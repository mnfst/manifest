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

  // Accordion: env var method is expanded by default
  it("shows env var method expanded by default", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("Set an environment variable");
    expect(container.textContent).toContain("Recommended");
    expect(container.textContent).toContain("MANIFEST_API_KEY");
  });

  it("shows env var snippet with placeholder key", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain('MANIFEST_API_KEY="mnfst_YOUR_KEY"');
  });

  it("shows env var snippet with full key when provided", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_real_key" />
    ));
    expect(container.textContent).toContain('MANIFEST_API_KEY="mnfst_real_key"');
  });

  it("includes MANIFEST_ENDPOINT in env snippet for non-production baseUrl", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("MANIFEST_ENDPOINT");
  });

  it("omits MANIFEST_ENDPOINT for app.manifest.build baseUrl", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} baseUrl="https://app.manifest.build/v1" />
    ));
    // env method is open by default — should not have MANIFEST_ENDPOINT
    expect(container.querySelector("#method-env")?.textContent).not.toContain("MANIFEST_ENDPOINT");
  });

  it("shows env var key prefix snippet when only prefix provided", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} keyPrefix="mnfst_abc" />
    ));
    expect(container.textContent).toContain('MANIFEST_API_KEY="mnfst_abc..."');
  });

  // Accordion: onboard method (collapsed by default)
  it("shows one-command setup section (collapsed)", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("One-command setup");
    // body should not be rendered
    expect(container.querySelector("#method-onboard")).toBeNull();
  });

  it("expands onboard method and collapses env on click", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    // Click onboard header
    const headers = container.querySelectorAll(".setup-method__header");
    fireEvent.click(headers[1]); // second method = onboard
    expect(container.querySelector("#method-onboard")).not.toBeNull();
    expect(container.textContent).toContain("openclaw onboard");
    // env should be collapsed
    expect(container.querySelector("#method-env")).toBeNull();
  });

  // Accordion: CLI method (collapsed by default)
  it("shows manual CLI section (collapsed)", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    expect(container.textContent).toContain("Manual CLI configuration");
    expect(container.querySelector("#method-cli")).toBeNull();
  });

  it("expands CLI method on click", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const headers = container.querySelectorAll(".setup-method__header");
    fireEvent.click(headers[2]); // third method = cli
    expect(container.querySelector("#method-cli")).not.toBeNull();
    expect(container.textContent).toContain("models.providers.manifest");
    expect(container.textContent).toContain("openai-completions");
    expect(container.textContent).toContain("openclaw gateway restart");
  });

  it("CLI snippet includes apiKey when provided", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_test_key" />
    ));
    const headers = container.querySelectorAll(".setup-method__header");
    fireEvent.click(headers[2]);
    expect(container.textContent).toContain("mnfst_test_key");
  });

  it("CLI snippet includes baseUrl", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} baseUrl="https://app.manifest.build/v1" />
    ));
    const headers = container.querySelectorAll(".setup-method__header");
    fireEvent.click(headers[2]);
    expect(container.textContent).toContain("app.manifest.build/v1");
  });

  it("collapses open method when clicking its header again", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    // env is open by default, click it to close
    const headers = container.querySelectorAll(".setup-method__header");
    fireEvent.click(headers[0]);
    expect(container.querySelector("#method-env")).toBeNull();
  });

  it("has aria-expanded on method headers", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const headers = container.querySelectorAll(".setup-method__header");
    expect(headers[0].getAttribute("aria-expanded")).toBe("true");
    expect(headers[1].getAttribute("aria-expanded")).toBe("false");
    expect(headers[2].getAttribute("aria-expanded")).toBe("false");
  });

  it("has aria-controls on method headers", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const headers = container.querySelectorAll(".setup-method__header");
    expect(headers[0].getAttribute("aria-controls")).toBe("method-env");
    expect(headers[1].getAttribute("aria-controls")).toBe("method-onboard");
    expect(headers[2].getAttribute("aria-controls")).toBe("method-cli");
  });

  it("has copy buttons for base URL and model", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const copyButtons = container.querySelectorAll(".modal-terminal__copy");
    // At least: base URL copy, model copy, env snippet copy
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

  it("applies recommended class to env method when open", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const methods = container.querySelectorAll(".setup-method");
    expect(methods[0].classList.contains("setup-method--recommended")).toBe(true);
  });

  it("removes recommended class from env method when closed", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    // Close env by clicking onboard
    const headers = container.querySelectorAll(".setup-method__header");
    fireEvent.click(headers[1]);
    const methods = container.querySelectorAll(".setup-method");
    expect(methods[0].classList.contains("setup-method--recommended")).toBe(false);
  });

  it("onboard snippet includes --non-interactive flag", () => {
    const { container } = render(() => <SetupStepAddProvider {...defaultProps} />);
    const headers = container.querySelectorAll(".setup-method__header");
    fireEvent.click(headers[1]);
    expect(container.textContent).toContain("--non-interactive");
  });

  it("onboard snippet includes the API key", () => {
    const { container } = render(() => (
      <SetupStepAddProvider {...defaultProps} apiKey="mnfst_key_123" />
    ));
    const headers = container.querySelectorAll(".setup-method__header");
    fireEvent.click(headers[1]);
    expect(container.textContent).toContain("mnfst_key_123");
  });
});
