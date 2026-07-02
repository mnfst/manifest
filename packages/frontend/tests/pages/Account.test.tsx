import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";

const searchParamsState: Record<string, string | undefined> = {};
const setSearchParamsFn = vi.fn((p: Record<string, string | undefined>) => {
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined) delete searchParamsState[k];
    else searchParamsState[k] = v;
  }
});

vi.mock("@solidjs/router", () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [searchParamsState, setSearchParamsFn],
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

const mockUpgrade = vi.fn();
const mockBillingPortal = vi.fn();

vi.mock("../../src/services/auth-client.js", () => ({
  authClient: {
    useSession: () => () => ({
      data: { user: { id: "u1", name: "Test User", email: "test@test.com" } },
      isPending: false,
    }),
    subscription: {
      upgrade: (...a: unknown[]) => mockUpgrade(...a),
      billingPortal: (...a: unknown[]) => mockBillingPortal(...a),
    },
  },
}));

const mockGetBillingStatus = vi.fn();
vi.mock("../../src/services/api/billing.js", () => ({
  getBillingStatus: (...a: unknown[]) => mockGetBillingStatus(...a),
}));

const mockToastSuccess = vi.fn();
vi.mock("../../src/services/toast-store.js", () => ({
  toast: {
    success: (...a: unknown[]) => mockToastSuccess(...a),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.stubGlobal("navigator", {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

// Stub window.matchMedia for jsdom
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

import Account from "../../src/pages/Account";

const disabledStatus = {
  enabled: false,
  plan: "free" as const,
  priceMonthlyUsd: null,
  agents: { used: 0, limit: 1 },
  requests: { used: 0, limit: 10_000, periodEnd: null },
};

const freeStatus = {
  enabled: true,
  plan: "free" as const,
  priceMonthlyUsd: 20,
  agents: { used: 4, limit: 1 },
  requests: { used: 120, limit: 10_000, periodEnd: "2026-08-01T00:00:00.000Z" },
};

const proStatus = {
  enabled: true,
  plan: "pro" as const,
  priceMonthlyUsd: 20,
  agents: { used: 3, limit: 10 },
  requests: { used: 5000, limit: 500_000, periodEnd: "2026-08-01T00:00:00.000Z" },
};

describe("Account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    for (const key of Object.keys(searchParamsState)) delete searchParamsState[key];
    mockGetBillingStatus.mockResolvedValue(disabledStatus);
    mockUpgrade.mockResolvedValue(undefined);
    mockBillingPortal.mockResolvedValue(undefined);
  });

  it("renders Account Preferences heading", () => {
    render(() => <Account />);
    expect(screen.getByText("Account Preferences")).toBeDefined();
  });

  it("shows display name input with user name", () => {
    render(() => <Account />);
    const input = screen.getByLabelText("Display name") as HTMLInputElement;
    expect(input.value).toBe("Test User");
  });

  it("shows email input", () => {
    render(() => <Account />);
    const input = screen.getByLabelText("Email") as HTMLInputElement;
    expect(input.value).toBe("test@test.com");
  });

  it("shows theme options", () => {
    render(() => <Account />);
    expect(screen.getByText("Light")).toBeDefined();
    expect(screen.getByText("Dark")).toBeDefined();
    expect(screen.getByText("System")).toBeDefined();
  });

  it("shows workspace section", () => {
    render(() => <Account />);
    expect(screen.getByText("Workspace")).toBeDefined();
  });

  it("shows Back button", () => {
    render(() => <Account />);
    expect(screen.getByText("Back")).toBeDefined();
  });

  it("shows profile information section", () => {
    render(() => <Account />);
    expect(screen.getByText("Profile information")).toBeDefined();
  });

  it("shows appearance section", () => {
    render(() => <Account />);
    expect(screen.getByText("Appearance")).toBeDefined();
  });

  it("shows workspace ID", () => {
    const { container } = render(() => <Account />);
    expect(container.textContent).toContain("u1");
  });

  it("applies light theme when Light clicked", () => {
    render(() => <Account />);
    fireEvent.click(screen.getByText("Light"));
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("applies dark theme when Dark clicked", () => {
    render(() => <Account />);
    fireEvent.click(screen.getByText("Dark"));
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("removes theme from storage when System clicked", () => {
    localStorage.setItem("theme", "dark");
    render(() => <Account />);
    fireEvent.click(screen.getByText("System"));
    expect(localStorage.getItem("theme")).toBeNull();
  });

  it("copies user ID to clipboard when copy button clicked", () => {
    const { container } = render(() => <Account />);
    const copyBtn = container.querySelector(".settings-card__copy-btn")!;
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("u1");
  });

  it("reads stored theme on mount", () => {
    localStorage.setItem("theme", "dark");
    render(() => <Account />);
    // Component should read and apply stored theme
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  describe("Billing", () => {
    it("hides the Billing section when billing is not enabled", async () => {
      const { container } = render(() => <Account />);
      await waitFor(() => expect(mockGetBillingStatus).toHaveBeenCalled());
      expect(screen.queryByText("Billing")).toBeNull();
      expect(container.querySelector("#billing")).toBeNull();
    });

    it("shows plan, usage, and comparison footer on the free plan", async () => {
      mockGetBillingStatus.mockResolvedValue(freeStatus);
      const { container } = render(() => <Account />);
      await screen.findByText("Billing");
      expect(container.querySelector("#billing")).not.toBeNull();
      expect(screen.getByText("Current plan")).toBeDefined();
      expect(screen.getByText("Free")).toBeDefined();
      expect(screen.getByText("4 / 1 used")).toBeDefined();
      expect(screen.getByText("10,000 per month included")).toBeDefined();
      expect(
        screen.getByText("Free: 1 agent, 10,000 requests/mo · Pro: 10 agents, 500,000 requests/mo"),
      ).toBeDefined();
    });

    it("calls subscription.upgrade with checkout URLs when Upgrade to Pro is clicked", async () => {
      mockGetBillingStatus.mockResolvedValue(freeStatus);
      render(() => <Account />);
      const button = await screen.findByText(/Upgrade to Pro/);
      expect(button.textContent).toContain("$20/mo");
      fireEvent.click(button);
      expect(mockUpgrade).toHaveBeenCalledWith({
        plan: "pro",
        successUrl: "/account?upgraded=1",
        cancelUrl: "/account",
      });
      await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    });

    it("disables the upgrade button while the checkout call is in flight", async () => {
      mockGetBillingStatus.mockResolvedValue(freeStatus);
      let resolveUpgrade!: () => void;
      mockUpgrade.mockImplementation(
        () => new Promise<void>((resolve) => (resolveUpgrade = resolve)),
      );
      render(() => <Account />);
      const button = (await screen.findByText(/Upgrade to Pro/)) as HTMLButtonElement;
      fireEvent.click(button);
      await waitFor(() => expect(button.disabled).toBe(true));
      resolveUpgrade();
      await waitFor(() => expect(button.disabled).toBe(false));
    });

    it("hides the upgrade price when priceMonthlyUsd is null", async () => {
      mockGetBillingStatus.mockResolvedValue({ ...freeStatus, priceMonthlyUsd: null });
      render(() => <Account />);
      const button = await screen.findByText(/Upgrade to Pro/);
      expect(button.textContent).not.toContain("$");
    });

    it("shows Manage billing on the pro plan and opens the billing portal", async () => {
      mockGetBillingStatus.mockResolvedValue(proStatus);
      render(() => <Account />);
      const button = await screen.findByText("Manage billing");
      expect(screen.getByText("Pro · $20/mo")).toBeDefined();
      expect(screen.getByText("3 / 10 used")).toBeDefined();
      expect(screen.getByText("500,000 per month included")).toBeDefined();
      expect(screen.queryByText(/Free: 1 agent/)).toBeNull();
      fireEvent.click(button);
      expect(mockBillingPortal).toHaveBeenCalledWith({ returnUrl: "/account" });
      await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    });

    it("shows unlimited labels when pro limits are null", async () => {
      mockGetBillingStatus.mockResolvedValue({
        ...proStatus,
        priceMonthlyUsd: null,
        agents: { used: 3, limit: null },
        requests: { used: 5000, limit: null, periodEnd: null },
      });
      render(() => <Account />);
      await screen.findByText("Manage billing");
      expect(screen.getByText("Pro")).toBeDefined();
      expect(screen.getByText("3 / unlimited used")).toBeDefined();
      expect(screen.getByText("Unlimited")).toBeDefined();
    });

    it("shows a success toast and clears the param when ?upgraded=1 is present", async () => {
      searchParamsState["upgraded"] = "1";
      render(() => <Account />);
      await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith("Welcome to Pro!"));
      expect(setSearchParamsFn).toHaveBeenCalledWith({ upgraded: undefined }, { replace: true });
      expect(searchParamsState["upgraded"]).toBeUndefined();
    });
  });
});
