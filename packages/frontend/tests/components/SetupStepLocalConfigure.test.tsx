import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";

vi.stubGlobal("navigator", {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

import SetupStepLocalConfigure from "../../src/components/SetupStepLocalConfigure";

describe("SetupStepLocalConfigure", () => {
  const defaultProps = {
    apiKey: null as string | null,
    keyPrefix: null as string | null,
    baseUrl: "http://localhost:3001/v1",
  };

  it("renders heading", () => {
    render(() => <SetupStepLocalConfigure {...defaultProps} />);
    expect(screen.getByText("Your agent is ready")).toBeDefined();
  });

  it("shows description about local server and routing", () => {
    const { container } = render(() => <SetupStepLocalConfigure {...defaultProps} />);
    expect(container.textContent).toContain("local server is running");
    expect(container.textContent).toContain("manifest/auto");
    expect(container.textContent).toContain("route requests");
  });

  it("shows checklist items", () => {
    const { container } = render(() => <SetupStepLocalConfigure {...defaultProps} />);
    expect(container.textContent).toContain("Plugin installed and configured");
    expect(container.textContent).toContain("API key auto-generated");
  });

  it("shows API key with copy warning when provided", () => {
    const { container } = render(() => (
      <SetupStepLocalConfigure {...defaultProps} apiKey="mnfst_test_key_123" />
    ));
    expect(container.textContent).toContain("mnfst_test_key_123");
    expect(container.textContent).toContain("will not be shown again");
  });

  it("shows key prefix when no full key", () => {
    const { container } = render(() => (
      <SetupStepLocalConfigure {...defaultProps} keyPrefix="mnfst_abc" />
    ));
    expect(container.textContent).toContain("Active key: mnfst_abc...");
  });

  it("does not show key prefix when full key provided", () => {
    const { container } = render(() => (
      <SetupStepLocalConfigure {...defaultProps} apiKey="mnfst_full" keyPrefix="mnfst_abc" />
    ));
    expect(container.textContent).not.toContain("Active key:");
  });

  it("shows base URL in checklist", () => {
    const { container } = render(() => <SetupStepLocalConfigure {...defaultProps} />);
    expect(container.textContent).toContain("Base URL:");
    expect(container.textContent).toContain("http://localhost:3001/v1");
  });

  it("always shows base URL since it is a required prop", () => {
    const { container } = render(() => (
      <SetupStepLocalConfigure {...defaultProps} baseUrl="https://custom.example.com/v1" />
    ));
    expect(container.textContent).toContain("Base URL:");
    expect(container.textContent).toContain("https://custom.example.com/v1");
  });
});
