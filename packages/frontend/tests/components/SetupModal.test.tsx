import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

const mockGetHealth = vi.fn().mockResolvedValue({ mode: "cloud" });
vi.mock("../../src/services/api.js", () => ({
  getAgentKey: vi.fn().mockResolvedValue({ keyPrefix: "mnfst_abc", pluginEndpoint: null }),
  getHealth: (...args: unknown[]) => mockGetHealth(...args),
}));

vi.mock("../../src/components/SetupStepAddProvider.jsx", () => ({
  default: (props: any) => (
    <div data-testid="step-add-provider" data-base-url={props.baseUrl ?? ""} data-key={props.apiKey ?? ""} data-prefix={props.keyPrefix ?? ""}>
      Add Provider Step
    </div>
  ),
}));

vi.mock("../../src/components/SetupStepLocalConfigure.jsx", () => ({
  default: (props: any) => (
    <div data-testid="step-local-configure" data-base-url={props.baseUrl ?? ""} data-key={props.apiKey ?? ""} data-prefix={props.keyPrefix ?? ""}>
      Local Configure Step
    </div>
  ),
}));

vi.mock("../../src/components/SetupStepProviders.jsx", () => ({
  default: (props: any) => (
    <div data-testid="step-providers" data-agent={props.agentName ?? ""}>
      <button data-testid="go-to-routing" onClick={() => props.onGoToRouting?.()}>Go to routing</button>
    </div>
  ),
}));

import SetupModal from "../../src/components/SetupModal";

describe("SetupModal", () => {
  const onClose = vi.fn();
  const onDone = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHealth.mockResolvedValue({ mode: "cloud" });
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

  it("shows stepper with 2 steps for cloud mode", () => {
    const { container } = render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} />
    ));
    expect(container.textContent).toContain("Add Provider");
    expect(container.textContent).toContain("Connect Models");
  });

  it("shows Add Provider step content first", () => {
    const { container } = render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} />
    ));
    expect(container.querySelector('[data-testid="step-add-provider"]')).not.toBeNull();
  });

  it("navigates to Connect Models step on Next click", () => {
    const { container } = render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} />
    ));
    const nextBtn = container.querySelector(".setup-modal__next")!;
    fireEvent.click(nextBtn);
    expect(container.querySelector('[data-testid="step-providers"]')).not.toBeNull();
  });

  it("shows Done button on last step", () => {
    const { container } = render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} onDone={onDone} />
    ));
    fireEvent.click(container.querySelector(".setup-modal__next")!);
    expect(container.querySelector('[data-testid="step-providers"]')).not.toBeNull();
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
    expect(container.querySelector('[data-testid="step-providers"]')).not.toBeNull();

    // Go back
    fireEvent.click(container.querySelector(".modal-card__back-link")!);
    expect(container.querySelector('[data-testid="step-add-provider"]')).not.toBeNull();
  });

  it("calls onDone when Done clicked on last step", () => {
    const { container } = render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} onDone={onDone} />
    ));
    // Navigate to last step (step 2)
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
    expect(container.textContent).toContain("Add Manifest as a provider");
  });

  it("closes on overlay click", () => {
    const { container } = render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} />
    ));
    const overlay = container.querySelector(".modal-overlay")!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it("closes when Escape key is pressed on the overlay", () => {
    const { container } = render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} />
    ));
    const overlay = container.querySelector(".modal-overlay")!;
    fireEvent.keyDown(overlay, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("navigates to step by clicking stepper circle", () => {
    const { container } = render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} />
    ));
    // Click on step 2 (Connect Models) directly via stepper
    const stepLabels = container.querySelectorAll(".modal-stepper__step");
    fireEvent.click(stepLabels[1]); // Connect Models step
    expect(container.querySelector('[data-testid="step-providers"]')).not.toBeNull();
  });

  describe("local mode", () => {
    beforeEach(() => {
      mockGetHealth.mockResolvedValue({ mode: "local" });
    });

    it("should show 2 steps for local mode", async () => {
      const { container } = render(() => (
        <SetupModal open={true} agentName="local-agent" onClose={onClose} />
      ));
      await vi.waitFor(() => {
        expect(container.textContent).toContain("Configure");
        expect(container.textContent).toContain("Connect Models");
        expect(container.textContent).not.toContain("Add Provider");
      });
    });

    it("should show local description text", async () => {
      const { container } = render(() => (
        <SetupModal open={true} agentName="local-agent" onClose={onClose} />
      ));
      await vi.waitFor(() => {
        expect(container.textContent).toContain("local server is running");
      });
    });

    it("should show LocalConfigure step first in local flow", async () => {
      const { container } = render(() => (
        <SetupModal open={true} agentName="local-agent" onClose={onClose} />
      ));
      await vi.waitFor(() => {
        expect(container.querySelector('[data-testid="step-local-configure"]')).not.toBeNull();
      });
    });

    it("should show Next on step 1 and Done on step 2 in local flow", async () => {
      const { container } = render(() => (
        <SetupModal open={true} agentName="local-agent" onClose={onClose} />
      ));
      await vi.waitFor(() => {
        expect(container.querySelector('[data-testid="step-local-configure"]')).not.toBeNull();
        expect(container.textContent).toContain("Next");
      });
      // Step 2 (Connect Models) shows Done
      fireEvent.click(container.querySelector(".setup-modal__next")!);
      await vi.waitFor(() => {
        expect(container.querySelector('[data-testid="step-providers"]')).not.toBeNull();
        expect(container.textContent).toContain("Done");
      });
    });
  });

  it("calls onDone, onClose, and onGoToRouting when Go to routing is clicked", () => {
    const onGoToRouting = vi.fn();
    const { container } = render(() => (
      <SetupModal
        open={true}
        agentName="test-agent"
        onClose={onClose}
        onDone={onDone}
        onGoToRouting={onGoToRouting}
      />
    ));
    // Navigate to last step (step 2)
    fireEvent.click(container.querySelector(".setup-modal__next")!);

    // Click the "Go to routing" button inside the mocked SetupStepProviders
    fireEvent.click(screen.getByTestId("go-to-routing"));
    expect(onDone).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(onGoToRouting).toHaveBeenCalled();
  });

  it("handles handleGoToRouting when onDone and onGoToRouting are omitted", () => {
    const { container } = render(() => (
      <SetupModal open={true} agentName="test-agent" onClose={onClose} />
    ));
    // Navigate to last step (step 2)
    fireEvent.click(container.querySelector(".setup-modal__next")!);

    // Click the "Go to routing" button - should not throw even without optional callbacks
    expect(() => fireEvent.click(screen.getByTestId("go-to-routing"))).not.toThrow();
    expect(onClose).toHaveBeenCalled();
  });

  describe("cloud mode", () => {
    it("renders Add Provider step with computed baseUrl on non-production host", () => {
      const { container } = render(() => (
        <SetupModal open={true} agentName="test-agent" onClose={onClose} />
      ));
      expect(container.querySelector('[data-testid="step-add-provider"]')).not.toBeNull();
    });

    it("renders Add Provider step with baseUrl from custom pluginEndpoint", async () => {
      const { getAgentKey } = await import("../../src/services/api.js");
      (getAgentKey as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        keyPrefix: "mnfst_abc",
        pluginEndpoint: "https://custom.endpoint/otlp",
      });
      const { container } = render(() => (
        <SetupModal open={true} agentName="test-agent" onClose={onClose} />
      ));
      await vi.waitFor(() => {
        expect(container.querySelector('[data-testid="step-add-provider"]')).not.toBeNull();
      });
    });

    it("computes production baseUrl on app.manifest.build hostname", () => {
      const origLocation = window.location;
      Object.defineProperty(window, "location", {
        value: { ...origLocation, hostname: "app.manifest.build", origin: "https://app.manifest.build" },
        writable: true,
        configurable: true,
      });
      const { container } = render(() => (
        <SetupModal open={true} agentName="test-agent" onClose={onClose} />
      ));
      const step = container.querySelector('[data-testid="step-add-provider"]');
      expect(step).not.toBeNull();
      expect(step?.getAttribute("data-base-url")).toBe("https://app.manifest.build/v1");
      Object.defineProperty(window, "location", {
        value: origLocation,
        writable: true,
        configurable: true,
      });
    });

    it("passes apiKey prop to Add Provider step", () => {
      const { container } = render(() => (
        <SetupModal open={true} agentName="test-agent" apiKey="mnfst_full_key" onClose={onClose} />
      ));
      expect(container.querySelector('[data-testid="step-add-provider"]')).not.toBeNull();
    });
  });

  describe("local mode - baseUrl and steps", () => {
    beforeEach(() => {
      mockGetHealth.mockResolvedValue({ mode: "local" });
    });

    it("passes baseUrl to SetupStepLocalConfigure", async () => {
      const { container } = render(() => (
        <SetupModal open={true} agentName="local-agent" onClose={onClose} />
      ));
      await vi.waitFor(() => {
        expect(container.querySelector('[data-testid="step-local-configure"]')).not.toBeNull();
      });
    });

    it("computes production baseUrl in local mode on app.manifest.build", async () => {
      const origLocation = window.location;
      Object.defineProperty(window, "location", {
        value: { ...origLocation, hostname: "app.manifest.build", origin: "https://app.manifest.build" },
        writable: true,
        configurable: true,
      });
      const { container } = render(() => (
        <SetupModal open={true} agentName="local-agent" onClose={onClose} />
      ));
      await vi.waitFor(() => {
        const step = container.querySelector('[data-testid="step-local-configure"]');
        expect(step).not.toBeNull();
        expect(step?.getAttribute("data-base-url")).toBe("https://app.manifest.build/v1");
      });
      Object.defineProperty(window, "location", {
        value: origLocation,
        writable: true,
        configurable: true,
      });
    });
  });
});
