import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import type { BillingStatus } from "manifest-shared";

const mockUpgrade = vi.fn();
vi.mock("../../src/services/auth-client.js", () => ({
  authClient: {
    subscription: {
      upgrade: (...a: unknown[]) => mockUpgrade(...a),
    },
  },
}));

const mockToastError = vi.fn();
vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: (...a: unknown[]) => mockToastError(...a), success: vi.fn(), warning: vi.fn() },
}));

import { UpgradePanel } from "../../src/components/UpgradePanel";

const makeStatus = (overrides: Partial<BillingStatus> = {}): BillingStatus => ({
  enabled: true,
  plan: "free",
  priceMonthlyUsd: 20,
  agents: { used: 1, limit: 1 },
  requests: { used: null, limit: null, periodEnd: null },
  ...overrides,
});

describe("UpgradePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpgrade.mockResolvedValue(undefined);
  });

  it("shows the free-plan message with a singular agent noun", () => {
    const { container } = render(() => <UpgradePanel status={makeStatus()} />);
    expect(container.textContent).toContain("Free includes 1 agent.");
    // "1 agent" — singular, no trailing "s".
    expect(container.textContent).not.toContain("1 agents");
  });

  it("pluralizes the agent noun when the free limit is greater than one", () => {
    const { container } = render(() => (
      <UpgradePanel status={makeStatus({ agents: { used: 2, limit: 2 } })} />
    ));
    expect(container.textContent).toContain("Free includes 2 agents.");
  });

  it("shows the monthly price when priceMonthlyUsd is set", () => {
    const { container } = render(() => <UpgradePanel status={makeStatus({ priceMonthlyUsd: 20 })} />);
    expect(container.textContent).toContain("Pro ($20/mo):");
  });

  it("hides the price when priceMonthlyUsd is null", () => {
    const { container } = render(() => (
      <UpgradePanel status={makeStatus({ priceMonthlyUsd: null })} />
    ));
    expect(container.textContent).toContain("Pro:");
    expect(container.textContent).not.toContain("/mo");
  });

  it("upgrades with the exact plan/successUrl/cancelUrl args on click", async () => {
    render(() => <UpgradePanel status={makeStatus()} />);
    fireEvent.click(screen.getByText("Upgrade to Pro"));
    await waitFor(() => {
      expect(mockUpgrade).toHaveBeenCalledWith({
        plan: "pro",
        successUrl: "/account?upgraded=1",
        cancelUrl: window.location.pathname,
      });
    });
  });

  it("toggles a busy state (spinner + disabled) while the upgrade is in flight", async () => {
    let resolveUpgrade: (v: unknown) => void;
    mockUpgrade.mockReturnValue(new Promise((r) => (resolveUpgrade = r)));
    const { container } = render(() => <UpgradePanel status={makeStatus()} />);
    const btn = screen.getByText("Upgrade to Pro") as HTMLButtonElement;
    fireEvent.click(btn);
    await waitFor(() => {
      const busyBtn = container.querySelector(".btn--primary") as HTMLButtonElement;
      expect(busyBtn.disabled).toBe(true);
      expect(container.querySelector(".spinner")).not.toBeNull();
    });
    resolveUpgrade!(undefined);
    await waitFor(() => {
      const idleBtn = container.querySelector(".btn--primary") as HTMLButtonElement;
      expect(idleBtn.disabled).toBe(false);
      expect(container.querySelector(".spinner")).toBeNull();
    });
  });

  it("surfaces an error toast when the upgrade throws", async () => {
    mockUpgrade.mockRejectedValue(new Error("boom"));
    const { container } = render(() => <UpgradePanel status={makeStatus()} />);
    fireEvent.click(screen.getByText("Upgrade to Pro"));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining("upgrade"));
    });
    // Busy state must reset even after the failure.
    const btn = container.querySelector(".btn--primary") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("shows the Pro-limit message and no upgrade button on the pro plan", () => {
    const { container } = render(() => (
      <UpgradePanel status={makeStatus({ plan: "pro", agents: { used: 10, limit: 10 } })} />
    ));
    expect(container.textContent).toContain("reached the Pro limit of 10 agents");
    expect(screen.queryByText("Upgrade to Pro")).toBeNull();
  });

  it("falls back to 0 in the message when the agent limit is null", () => {
    const { container } = render(() => (
      <UpgradePanel status={makeStatus({ plan: "pro", agents: { used: 3, limit: null } })} />
    ));
    expect(container.textContent).toContain("reached the Pro limit of 0 agents");
  });

  it("always renders a Compare plans link into /account#billing", () => {
    render(() => <UpgradePanel status={makeStatus()} />);
    const link = screen.getByText("Compare plans") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/account#billing");
  });
});
