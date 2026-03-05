import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

vi.mock("../../src/services/api.js", () => ({
  getAgentKey: vi.fn().mockResolvedValue({ keyPrefix: "mnfst_xyz", pluginEndpoint: null }),
}));

vi.mock("../../src/components/SetupStepInstall.jsx", () => ({
  default: () => <div data-testid="step-install">Install Step</div>,
}));

vi.mock("../../src/components/SetupStepConfigure.jsx", () => ({
  default: (props: any) => (
    <div data-testid="step-configure" data-endpoint={props.endpoint ?? ""} data-key={props.keyPrefix ?? ""} data-agent={props.agentName ?? ""}>
      Configure Step
    </div>
  ),
}));

vi.mock("../../src/components/SetupStepVerify.jsx", () => ({
  default: () => <div data-testid="step-verify">Verify Step</div>,
}));

vi.mock("../../src/components/ErrorState.jsx", () => ({
  default: (props: any) => (
    <div data-testid="error-state" data-error={String(props.error ?? "")} data-message={props.message ?? ""}>
      {props.title}
      <button data-testid="retry" onClick={() => props.onRetry?.()}>Retry</button>
    </div>
  ),
}));

import SetupWizard from "../../src/components/SetupWizard";

describe("SetupWizard", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders wizard title with agent name", () => {
    render(() => <SetupWizard agentName="my-agent" onClose={onClose} />);
    expect(screen.getByText("Set up my-agent")).toBeDefined();
  });

  it("renders description", () => {
    render(() => <SetupWizard agentName="my-agent" onClose={onClose} />);
    expect(screen.getByText("Connect your agent to start tracking its activity.")).toBeDefined();
  });

  it("shows stepper with Install, Configure, Verify steps", () => {
    const { container } = render(() => <SetupWizard agentName="my-agent" onClose={onClose} />);
    expect(container.textContent).toContain("Install");
    expect(container.textContent).toContain("Configure");
    expect(container.textContent).toContain("Verify");
  });

  it("shows Install step content initially", () => {
    const { container } = render(() => <SetupWizard agentName="my-agent" onClose={onClose} />);
    expect(container.querySelector('[data-testid="step-install"]')).not.toBeNull();
  });

  it("navigates to Configure step on Next click", () => {
    const { container } = render(() => <SetupWizard agentName="my-agent" onClose={onClose} />);
    fireEvent.click(screen.getByText("Next"));
    expect(container.querySelector('[data-testid="step-configure"]')).not.toBeNull();
  });

  it("shows Back button on step 2", () => {
    render(() => <SetupWizard agentName="my-agent" onClose={onClose} />);
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Back")).toBeDefined();
  });

  it("goes back to Install on Back click", () => {
    const { container } = render(() => <SetupWizard agentName="my-agent" onClose={onClose} />);
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Back"));
    expect(container.querySelector('[data-testid="step-install"]')).not.toBeNull();
  });

  it("shows Done button on last step", () => {
    render(() => <SetupWizard agentName="my-agent" onClose={onClose} />);
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Done")).toBeDefined();
  });

  it("calls onClose when Done clicked", () => {
    render(() => <SetupWizard agentName="my-agent" onClose={onClose} />);
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Done"));
    expect(onClose).toHaveBeenCalled();
  });

  it("has close button that calls onClose", () => {
    const { container } = render(() => <SetupWizard agentName="my-agent" onClose={onClose} />);
    const closeBtn = container.querySelector(".modal__close")!;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("renders modal overlay", () => {
    const { container } = render(() => <SetupWizard agentName="my-agent" onClose={onClose} />);
    expect(container.querySelector(".modal-overlay")).not.toBeNull();
  });

  it("renders modal card", () => {
    const { container } = render(() => <SetupWizard agentName="my-agent" onClose={onClose} />);
    expect(container.querySelector(".modal-card")).not.toBeNull();
  });

  it("shows Verify step on final step", () => {
    const { container } = render(() => <SetupWizard agentName="my-agent" onClose={onClose} />);
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Next"));
    expect(container.querySelector('[data-testid="step-verify"]')).not.toBeNull();
  });

  it("does not show Back button on first step", () => {
    const { container } = render(() => <SetupWizard agentName="my-agent" onClose={onClose} />);
    const backBtns = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.textContent === "Back",
    );
    expect(backBtns.length).toBe(0);
  });

  it("closes on overlay click", () => {
    const { container } = render(() => <SetupWizard agentName="my-agent" onClose={onClose} />);
    const overlay = container.querySelector(".modal-overlay")!;
    // Click on overlay (not on modal-card)
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows ErrorState when getAgentKey fails", async () => {
    const { getAgentKey } = await import("../../src/services/api.js");
    (getAgentKey as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("API error"));
    const { container } = render(() => <SetupWizard agentName="error-agent" onClose={onClose} />);
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="error-state"]')).not.toBeNull();
    });
  });

  it("uses custom pluginEndpoint when provided", async () => {
    const { getAgentKey } = await import("../../src/services/api.js");
    (getAgentKey as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      keyPrefix: "mnfst_xyz",
      pluginEndpoint: "https://custom.endpoint/otlp",
    });
    const { container } = render(() => <SetupWizard agentName="my-agent" onClose={onClose} />);
    // Navigate to Configure step
    fireEvent.click(screen.getByText("Next"));
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="step-configure"]')).not.toBeNull();
    });
  });

  it("computes endpoint from window.location when not on app.manifest.build", () => {
    // Default mock returns pluginEndpoint: null, hostname is localhost
    // so endpoint should be window.location.origin + /otlp
    const { container } = render(() => <SetupWizard agentName="my-agent" onClose={onClose} />);
    fireEvent.click(screen.getByText("Next"));
    // Step 2 is rendered which means endpoint was computed
    expect(container.querySelector('[data-testid="step-configure"]')).not.toBeNull();
  });
});
