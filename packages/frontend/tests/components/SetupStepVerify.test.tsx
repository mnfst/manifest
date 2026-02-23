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

  describe("when isLocal is true", () => {
    it("should render Start chatting heading", () => {
      render(() => <SetupStepVerify isLocal={true} />);
      expect(screen.getByText("Start chatting")).toBeDefined();
    });

    it("should not render Activate the plugin heading", () => {
      const { container } = render(() => <SetupStepVerify isLocal={true} />);
      expect(container.textContent).not.toContain("Activate the plugin");
    });

    it("should not show terminal UI", () => {
      const { container } = render(() => <SetupStepVerify isLocal={true} />);
      expect(container.querySelector(".modal-terminal")).toBeNull();
    });

    it("should not show restart command", () => {
      const { container } = render(() => <SetupStepVerify isLocal={true} />);
      expect(container.textContent).not.toContain("openclaw gateway restart");
    });

    it("should show telemetry ready message", () => {
      const { container } = render(() => <SetupStepVerify isLocal={true} />);
      expect(container.textContent).toContain("ready to receive telemetry");
    });

    it("should show step number with Start chatting heading", () => {
      const { container } = render(() => <SetupStepVerify isLocal={true} stepNumber={2} />);
      expect(container.textContent).toContain("2. Start chatting");
    });
  });

  describe("when isLocal is false", () => {
    it("should render Activate the plugin heading", () => {
      render(() => <SetupStepVerify isLocal={false} />);
      expect(screen.getByText("Activate the plugin")).toBeDefined();
    });

    it("should show terminal UI", () => {
      const { container } = render(() => <SetupStepVerify isLocal={false} />);
      expect(container.querySelector(".modal-terminal")).not.toBeNull();
    });

    it("should show restart command", () => {
      const { container } = render(() => <SetupStepVerify isLocal={false} />);
      expect(container.textContent).toContain("openclaw gateway restart");
    });
  });
});
