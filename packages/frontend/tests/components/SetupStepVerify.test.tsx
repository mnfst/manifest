import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";

vi.stubGlobal("navigator", {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

import SetupStepVerify from "../../src/components/SetupStepVerify";

describe("SetupStepVerify", () => {
  it("renders activate heading", () => {
    render(() => <SetupStepVerify />);
    expect(screen.getByText("Activate the plugin")).toBeDefined();
  });

  it("shows restart description", () => {
    const { container } = render(() => <SetupStepVerify />);
    expect(container.textContent).toContain("Restart OpenClaw to activate the plugin");
  });

  it("shows restart command", () => {
    const { container } = render(() => <SetupStepVerify />);
    expect(container.textContent).toContain("openclaw gateway restart");
  });

  it("shows terminal UI", () => {
    const { container } = render(() => <SetupStepVerify />);
    expect(container.querySelector(".modal-terminal")).not.toBeNull();
  });

  it("shows post-restart instructions", () => {
    const { container } = render(() => <SetupStepVerify />);
    expect(container.textContent).toContain("send a message to your agent");
  });

  it("has copy button", () => {
    const { container } = render(() => <SetupStepVerify />);
    expect(container.querySelector(".modal-terminal__copy")).not.toBeNull();
  });

  it("shows step number when provided", () => {
    const { container } = render(() => <SetupStepVerify stepNumber={3} />);
    expect(container.textContent).toContain("3. Activate the plugin");
  });
});
