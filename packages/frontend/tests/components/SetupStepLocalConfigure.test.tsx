import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";

vi.stubGlobal("navigator", {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

import SetupStepLocalConfigure from "../../src/components/SetupStepLocalConfigure";

describe("SetupStepLocalConfigure", () => {
  it("renders heading", () => {
    render(() => <SetupStepLocalConfigure apiKey={null} keyPrefix={null} endpoint={null} />);
    expect(screen.getByText("Your agent is ready")).toBeDefined();
  });

  it("shows description about local server", () => {
    const { container } = render(() => <SetupStepLocalConfigure apiKey={null} keyPrefix={null} endpoint={null} />);
    expect(container.textContent).toContain("local server is running");
    expect(container.textContent).toContain("Telemetry will flow automatically");
  });

  it("shows checklist items", () => {
    const { container } = render(() => <SetupStepLocalConfigure apiKey={null} keyPrefix={null} endpoint={null} />);
    expect(container.textContent).toContain("Plugin installed and configured");
    expect(container.textContent).toContain("API key auto-generated");
  });

  it("shows API key with copy warning when provided", () => {
    const { container } = render(() => <SetupStepLocalConfigure apiKey="mnfst_test_key_123" keyPrefix={null} endpoint={null} />);
    expect(container.textContent).toContain("mnfst_test_key_123");
    expect(container.textContent).toContain("won't be shown again");
  });

  it("shows key prefix when no full key", () => {
    const { container } = render(() => <SetupStepLocalConfigure apiKey={null} keyPrefix="mnfst_abc" endpoint={null} />);
    expect(container.textContent).toContain("Active key: mnfst_abc...");
  });

  it("does not show key prefix when full key provided", () => {
    const { container } = render(() => <SetupStepLocalConfigure apiKey="mnfst_full" keyPrefix="mnfst_abc" endpoint={null} />);
    expect(container.textContent).not.toContain("Active key:");
  });

  it("shows endpoint when provided", () => {
    const { container } = render(() => <SetupStepLocalConfigure apiKey={null} keyPrefix={null} endpoint="http://localhost:3001/otlp" />);
    expect(container.textContent).toContain("Endpoint:");
    expect(container.textContent).toContain("http://localhost:3001/otlp");
  });

  it("hides endpoint section when null", () => {
    const { container } = render(() => <SetupStepLocalConfigure apiKey={null} keyPrefix={null} endpoint={null} />);
    expect(container.textContent).not.toContain("Endpoint:");
  });
});
