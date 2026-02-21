import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

vi.stubGlobal("navigator", {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

import SetupStepConfigure from "../../src/components/SetupStepConfigure";

describe("SetupStepConfigure", () => {
  it("renders configure heading", () => {
    render(() => <SetupStepConfigure apiKey={null} keyPrefix={null} agentName="test-agent" endpoint={null} />);
    expect(screen.getByText("Configure your agent")).toBeDefined();
  });

  it("shows description", () => {
    const { container } = render(() => <SetupStepConfigure apiKey={null} keyPrefix={null} agentName="test-agent" endpoint={null} />);
    expect(container.textContent).toContain("Run one of these commands");
  });

  it("shows CLI tab and Environment tab", () => {
    render(() => <SetupStepConfigure apiKey={null} keyPrefix={null} agentName="test-agent" endpoint={null} />);
    expect(screen.getByText("OpenClaw CLI")).toBeDefined();
    expect(screen.getByText("Environment")).toBeDefined();
  });

  it("shows CLI command by default", () => {
    const { container } = render(() => <SetupStepConfigure apiKey={null} keyPrefix={null} agentName="test-agent" endpoint={null} />);
    expect(container.textContent).toContain("openclaw config set");
  });

  it("shows env command when Environment tab clicked", () => {
    const { container } = render(() => <SetupStepConfigure apiKey={null} keyPrefix={null} agentName="test-agent" endpoint={null} />);
    fireEvent.click(screen.getByText("Environment"));
    expect(container.textContent).toContain("export MANIFEST_API_KEY");
  });

  it("shows full API key with warning when provided", () => {
    const { container } = render(() => <SetupStepConfigure apiKey="mnfst_full_key_123" keyPrefix={null} agentName="test-agent" endpoint={null} />);
    expect(container.textContent).toContain("mnfst_full_key_123");
    expect(container.textContent).toContain("won't be shown again");
  });

  it("shows key prefix when no full key", () => {
    const { container } = render(() => <SetupStepConfigure apiKey={null} keyPrefix="mnfst_abc" agentName="test-agent" endpoint={null} />);
    expect(container.textContent).toContain("mnfst_abc...");
  });

  it("includes endpoint in commands when provided", () => {
    const { container } = render(() => <SetupStepConfigure apiKey={null} keyPrefix={null} agentName="test-agent" endpoint="http://localhost:3001/otlp" />);
    expect(container.textContent).toContain("http://localhost:3001/otlp");
  });

  it("shows step number when provided", () => {
    const { container } = render(() => <SetupStepConfigure apiKey={null} keyPrefix={null} agentName="test-agent" endpoint={null} stepNumber={2} />);
    expect(container.textContent).toContain("2. Configure your agent");
  });
});
