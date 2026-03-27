import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";

vi.mock("../../src/components/CopyButton.jsx", () => ({
  default: (props: any) => (
    <button data-testid="copy-button" data-text={props.text}>
      CopyStub
    </button>
  ),
}));

vi.mock("../../src/components/ApiKeyDisplay.jsx", () => ({
  default: (props: any) => (
    <div
      data-testid="api-key-display"
      data-api-key={props.apiKey ?? ""}
      data-key-prefix={props.keyPrefix ?? ""}
    >
      {props.apiKey ? `KEY:${props.apiKey}` : ""}
      {!props.apiKey && props.keyPrefix ? `PREFIX:${props.keyPrefix}` : ""}
    </div>
  ),
}));

import SetupStepLocalReady from "../../src/components/SetupStepLocalReady";

describe("SetupStepLocalReady", () => {
  const defaultProps = {
    apiKey: null as string | null,
    keyPrefix: null as string | null,
    baseUrl: "http://localhost:3001/v1",
  };

  it("renders the heading", () => {
    render(() => <SetupStepLocalReady {...defaultProps} />);
    expect(screen.getByText("Your agent is ready")).toBeDefined();
  });

  it("shows description about local server and routing", () => {
    const { container } = render(() => (
      <SetupStepLocalReady {...defaultProps} />
    ));
    expect(container.textContent).toContain("local server is running");
    expect(container.textContent).toContain("manifest/auto");
    expect(container.textContent).toContain("route requests through Manifest");
  });

  it("shows checklist item for plugin", () => {
    const { container } = render(() => (
      <SetupStepLocalReady {...defaultProps} />
    ));
    expect(container.textContent).toContain("Plugin installed and configured");
  });

  it("shows checklist item for API key", () => {
    const { container } = render(() => (
      <SetupStepLocalReady {...defaultProps} />
    ));
    expect(container.textContent).toContain("API key auto-generated");
  });

  it("shows base URL in checklist", () => {
    const { container } = render(() => (
      <SetupStepLocalReady {...defaultProps} />
    ));
    expect(container.textContent).toContain("Base URL:");
    expect(container.textContent).toContain("http://localhost:3001/v1");
  });

  it("shows custom base URL", () => {
    const { container } = render(() => (
      <SetupStepLocalReady
        {...defaultProps}
        baseUrl="https://custom.example.com/v1"
      />
    ));
    expect(container.textContent).toContain("https://custom.example.com/v1");
  });

  it("renders check icon SVGs in checklist items", () => {
    const { container } = render(() => (
      <SetupStepLocalReady {...defaultProps} />
    ));
    const checklistItems = container.querySelectorAll(".setup-checklist__item");
    expect(checklistItems.length).toBe(3);
    checklistItems.forEach((item) => {
      expect(item.querySelector("svg")).not.toBeNull();
    });
  });

  it("shows start-chatting hint when apiKey is null", () => {
    const { container } = render(() => (
      <SetupStepLocalReady {...defaultProps} />
    ));
    expect(container.textContent).toContain("manifest/auto");
    expect(container.textContent).toContain("send a message");
    expect(container.textContent).toContain(
      "activity will appear on the dashboard"
    );
  });

  it("hides start-chatting hint when apiKey is provided", () => {
    const { container } = render(() => (
      <SetupStepLocalReady {...defaultProps} apiKey="mnfst_full_key_123" />
    ));
    expect(container.textContent).not.toContain(
      "activity will appear on the dashboard within a few seconds"
    );
  });

  it("passes apiKey to ApiKeyDisplay", () => {
    const { container } = render(() => (
      <SetupStepLocalReady {...defaultProps} apiKey="mnfst_test_key" />
    ));
    const display = container.querySelector('[data-testid="api-key-display"]');
    expect(display).not.toBeNull();
    expect(display!.getAttribute("data-api-key")).toBe("mnfst_test_key");
  });

  it("passes keyPrefix to ApiKeyDisplay", () => {
    const { container } = render(() => (
      <SetupStepLocalReady {...defaultProps} keyPrefix="mnfst_pre" />
    ));
    const display = container.querySelector('[data-testid="api-key-display"]');
    expect(display).not.toBeNull();
    expect(display!.getAttribute("data-key-prefix")).toBe("mnfst_pre");
  });

  it("renders ApiKeyDisplay with empty attributes when no key or prefix", () => {
    const { container } = render(() => (
      <SetupStepLocalReady {...defaultProps} />
    ));
    const display = container.querySelector('[data-testid="api-key-display"]');
    expect(display).not.toBeNull();
    expect(display!.getAttribute("data-api-key")).toBe("");
    expect(display!.getAttribute("data-key-prefix")).toBe("");
  });

  it("renders the heading as an h3", () => {
    const { container } = render(() => (
      <SetupStepLocalReady {...defaultProps} />
    ));
    const h3 = container.querySelector("h3.setup-step__heading");
    expect(h3).not.toBeNull();
    expect(h3!.textContent).toBe("Your agent is ready");
  });
});
