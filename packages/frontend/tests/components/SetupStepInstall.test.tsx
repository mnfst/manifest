import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

vi.stubGlobal("navigator", {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

import SetupStepInstall, { CopyButton } from "../../src/components/SetupStepInstall";

describe("SetupStepInstall", () => {
  it("renders install heading", () => {
    render(() => <SetupStepInstall />);
    expect(screen.getByText("Install the Manifest plugin")).toBeDefined();
  });

  it("shows install description", () => {
    const { container } = render(() => <SetupStepInstall />);
    expect(container.textContent).toContain("Install the Manifest plugin");
  });

  it("shows install command", () => {
    const { container } = render(() => <SetupStepInstall />);
    expect(container.textContent).toContain("openclaw plugins install manifest");
  });

  it("shows terminal UI", () => {
    const { container } = render(() => <SetupStepInstall />);
    expect(container.querySelector(".modal-terminal")).not.toBeNull();
    expect(container.querySelector(".modal-terminal__prompt")).not.toBeNull();
  });

  it("shows step number when provided", () => {
    const { container } = render(() => <SetupStepInstall stepNumber={1} />);
    expect(container.textContent).toContain("1. Install the Manifest plugin");
  });

  it("has copy button", () => {
    const { container } = render(() => <SetupStepInstall />);
    expect(container.querySelector(".modal-terminal__copy")).not.toBeNull();
  });

  it("uses setup-step__heading class", () => {
    const { container } = render(() => <SetupStepInstall />);
    expect(container.querySelector(".setup-step__heading")).not.toBeNull();
  });

  it("uses setup-step__desc class", () => {
    const { container } = render(() => <SetupStepInstall />);
    expect(container.querySelector(".setup-step__desc")).not.toBeNull();
  });
});

describe("CopyButton re-export", () => {
  it("re-exports CopyButton from SetupStepInstall", () => {
    expect(CopyButton).toBeDefined();
  });

  it("copies text to clipboard on click", () => {
    const { container } = render(() => <CopyButton text="test-copy" />);
    const btn = container.querySelector(".modal-terminal__copy")!;
    fireEvent.click(btn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("test-copy");
  });
});
