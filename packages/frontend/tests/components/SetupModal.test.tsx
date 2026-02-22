import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

vi.mock("../../src/services/api.js", () => ({
  getAgentKey: vi.fn().mockResolvedValue({ keyPrefix: "mnfst_abc", pluginEndpoint: null }),
  getHealth: vi.fn().mockResolvedValue({ mode: "cloud" }),
}));

vi.mock("../../src/components/SetupStepInstall.jsx", () => ({
  default: () => <div data-testid="step-install">Install Step</div>,
}));

vi.mock("../../src/components/SetupStepConfigure.jsx", () => ({
  default: () => <div data-testid="step-configure">Configure Step</div>,
}));

vi.mock("../../src/components/SetupStepVerify.jsx", () => ({
  default: () => <div data-testid="step-verify">Verify Step</div>,
}));

vi.mock("../../src/components/SetupStepLocalConfigure.jsx", () => ({
  default: () => <div data-testid="step-local-configure">Local Configure Step</div>,
}));

import SetupModal from "../../src/components/SetupModal";

describe("SetupModal", () => {
  const onClose = vi.fn();
  const onDone = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = render(() => (
      <SetupModal open={false} agentName="test-agent" onClose={onClose} />
    ));
    expect(container.querySelector(".modal-overlay")).toBeNull();
  });

  it("renders modal title when open", () => {
    render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} />
    ));
    expect(screen.getByText("Set up your agent")).toBeDefined();
  });

  it("shows close button", () => {
    const { container } = render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} />
    ));
    const closeBtn = container.querySelector('[aria-label="Close"]');
    expect(closeBtn).not.toBeNull();
  });

  it("closes when close button clicked", () => {
    const { container } = render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} />
    ));
    const closeBtn = container.querySelector('[aria-label="Close"]')!;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows stepper with 3 steps for cloud mode", () => {
    const { container } = render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} />
    ));
    expect(container.textContent).toContain("Install");
    expect(container.textContent).toContain("Configure");
    expect(container.textContent).toContain("Activate");
  });

  it("shows Install step content first", () => {
    const { container } = render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} />
    ));
    expect(container.querySelector('[data-testid="step-install"]')).not.toBeNull();
  });

  it("navigates to next step on Next click", () => {
    const { container } = render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} />
    ));
    const nextBtn = container.querySelector(".setup-modal__next")!;
    fireEvent.click(nextBtn);
    expect(container.querySelector('[data-testid="step-configure"]')).not.toBeNull();
  });

  it("navigates to step 3 and shows Done button", () => {
    const { container } = render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} onDone={onDone} />
    ));
    // Click Next twice to get to step 3
    const nextBtn = container.querySelector(".setup-modal__next")!;
    fireEvent.click(nextBtn);
    fireEvent.click(container.querySelector(".setup-modal__next")!);
    expect(container.querySelector('[data-testid="step-verify"]')).not.toBeNull();
    expect(container.textContent).toContain("Done");
  });

  it("shows Back button on step 2+", () => {
    const { container } = render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} />
    ));
    // Step 1: Back hidden
    const backBtn = container.querySelector(".modal-card__back-link") as HTMLElement;
    expect(backBtn.style.visibility).toBe("hidden");

    // Go to step 2
    fireEvent.click(container.querySelector(".setup-modal__next")!);
    const backBtn2 = container.querySelector(".modal-card__back-link") as HTMLElement;
    expect(backBtn2.style.visibility).not.toBe("hidden");
  });

  it("goes back when Back clicked", () => {
    const { container } = render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} />
    ));
    // Go to step 2
    fireEvent.click(container.querySelector(".setup-modal__next")!);
    expect(container.querySelector('[data-testid="step-configure"]')).not.toBeNull();

    // Go back
    fireEvent.click(container.querySelector(".modal-card__back-link")!);
    expect(container.querySelector('[data-testid="step-install"]')).not.toBeNull();
  });

  it("calls onDone when Done clicked on last step", () => {
    const { container } = render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} onDone={onDone} />
    ));
    // Navigate to last step
    fireEvent.click(container.querySelector(".setup-modal__next")!);
    fireEvent.click(container.querySelector(".setup-modal__next")!);

    // Click Done
    const doneBtn = container.querySelector(".setup-modal__next")!;
    fireEvent.click(doneBtn);
    expect(onDone).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows description text for cloud mode", () => {
    const { container } = render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} />
    ));
    expect(container.textContent).toContain("Follow these steps to connect your agent");
  });

  it("closes on overlay click", () => {
    const { container } = render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} />
    ));
    const overlay = container.querySelector(".modal-overlay")!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it("navigates to step by clicking stepper circle", () => {
    const { container } = render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} />
    ));
    // First go to step 2 via Next
    fireEvent.click(container.querySelector(".setup-modal__next")!);
    expect(container.querySelector('[data-testid="step-configure"]')).not.toBeNull();

    // Click on step 3 directly via stepper
    const stepLabels = container.querySelectorAll(".modal-stepper__step");
    fireEvent.click(stepLabels[2]); // Activate step
    expect(container.querySelector('[data-testid="step-verify"]')).not.toBeNull();
  });
});
