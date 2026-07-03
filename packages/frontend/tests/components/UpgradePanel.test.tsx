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

const CONTACT_URL = "https://calendly.com/sebastien-manifest/30min";

const makeStatus = (overrides: Partial<BillingStatus> = {}): BillingStatus => ({
  enabled: true,
  plan: "free",
  priceMonthlyUsd: 19,
  agents: { used: 1, limit: 1 },
  requests: { used: null, limit: null, periodEnd: null },
  ...overrides,
});

describe("UpgradePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpgrade.mockResolvedValue(undefined);
  });

  it("renders a Free / Pro / Let's Talk trio for a free tenant", () => {
    const { container } = render(() => <UpgradePanel status={makeStatus()} />);
    const cards = container.querySelectorAll(".plan-card");
    expect(cards.length).toBe(3);
    expect(container.querySelector(".plan-cards--trio")).not.toBeNull();
    expect(container.textContent).toContain("Free");
    expect(container.textContent).toContain("Pro");
    expect(container.textContent).toContain("Let's Talk");
  });

  it("shows the Free card with current-plan badge and enforceable limits", () => {
    const { container } = render(() => <UpgradePanel status={makeStatus()} />);
    expect(container.textContent).toContain("Current plan");
    expect(container.textContent).toContain("$0");
    expect(container.textContent).toContain("1 agent");
    expect(container.textContent).toContain("10,000 routed requests / month");
    expect(container.textContent).toContain("Community support");
  });

  it("shows the Pro card as recommended with unlimited features", () => {
    const { container } = render(() => <UpgradePanel status={makeStatus()} />);
    expect(container.querySelector(".plan-card--recommended")).not.toBeNull();
    expect(container.textContent).toContain("Recommended");
    expect(container.textContent).toContain("Unlimited agents");
    expect(container.textContent).toContain("Unlimited routed requests");
    expect(container.textContent).toContain("Auto-fix");
  });

  it("shows the Let's Talk card with a Custom price and a contact link", () => {
    render(() => <UpgradePanel status={makeStatus()} />);
    expect(screen.getByText("Custom")).not.toBeNull();
    expect(screen.getByText("SSO / SAML")).not.toBeNull();
    const cta = screen.getByText("Let's talk") as HTMLAnchorElement;
    expect(cta.getAttribute("href")).toBe(CONTACT_URL);
    expect(cta.getAttribute("target")).toBe("_blank");
    expect(cta.getAttribute("rel")).toContain("noopener");
  });

  it("shows the monthly Pro price when priceMonthlyUsd is set", () => {
    const { container } = render(() => <UpgradePanel status={makeStatus({ priceMonthlyUsd: 19 })} />);
    expect(container.textContent).toContain("$19");
    expect(container.textContent).toContain("/mo");
  });

  it("hides the price suffix when priceMonthlyUsd is null", () => {
    const { container } = render(() => (
      <UpgradePanel status={makeStatus({ priceMonthlyUsd: null })} />
    ));
    expect(container.textContent).not.toContain("/mo");
    // The Pro card and its CTA still render even without a price.
    expect(screen.getByText("Upgrade to Pro")).not.toBeNull();
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

  it("shows a let's-talk fallback (no cards) for a non-free plan", () => {
    const { container } = render(() => (
      <UpgradePanel status={makeStatus({ plan: "pro", agents: { used: 3, limit: 3 } })} />
    ));
    expect(container.querySelector(".plan-card")).toBeNull();
    expect(screen.queryByText("Upgrade to Pro")).toBeNull();
    const cta = screen.getByText("Let's talk") as HTMLAnchorElement;
    expect(cta.getAttribute("href")).toBe(CONTACT_URL);
  });

  it("shows a consent line linking Terms and Privacy for a free tenant", () => {
    const { container } = render(() => <UpgradePanel status={makeStatus()} />);
    expect(container.textContent).toContain("By upgrading, you agree to our");
    const terms = screen.getByText("Terms") as HTMLAnchorElement;
    const privacy = screen.getByText("Privacy Policy") as HTMLAnchorElement;
    expect(terms.getAttribute("href")).toBe("https://manifest.build/terms");
    expect(terms.getAttribute("target")).toBe("_blank");
    expect(privacy.getAttribute("href")).toBe("https://manifest.build/privacy");
    expect(privacy.getAttribute("rel")).toContain("noopener");
  });

  it("omits the consent line on the non-free fallback", () => {
    const { container } = render(() => (
      <UpgradePanel status={makeStatus({ plan: "pro", agents: { used: 3, limit: 3 } })} />
    ));
    expect(container.textContent).not.toContain("By upgrading");
    expect(container.querySelector(".upgrade-panel__consent")).toBeNull();
  });
});
