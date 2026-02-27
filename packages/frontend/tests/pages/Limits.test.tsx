import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  useParams: () => ({ agentName: "test-agent" }),
  A: (props: any) => <a href={props.href}>{props.children}</a>,
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

let mockRules: any[] = [];
let mockEmailProvider: any = null;
let mockRoutingStatus = { enabled: false };
let mockIsLocalMode = false;

vi.mock("../../src/services/local-mode.js", () => ({
  isLocalMode: () => mockIsLocalMode,
}));

vi.mock("../../src/services/api.js", () => ({
  getNotificationRules: vi.fn(() => Promise.resolve(mockRules)),
  createNotificationRule: vi.fn(() => Promise.resolve({})),
  updateNotificationRule: vi.fn(() => Promise.resolve({})),
  deleteNotificationRule: vi.fn(() => Promise.resolve({})),
  getEmailProvider: vi.fn(() => Promise.resolve(mockEmailProvider)),
  removeEmailProvider: vi.fn(() => Promise.resolve({})),
  getRoutingStatus: vi.fn(() => Promise.resolve(mockRoutingStatus)),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../src/components/EmailProviderSetup.js", () => ({
  default: (props: any) => <div data-testid="email-setup">EmailProviderSetup</div>,
}));

vi.mock("../../src/components/LimitRuleModal.js", () => ({
  default: (props: any) => (
    <div data-testid="limit-modal" data-open={props.open} data-routing={props.routingEnabled}>
      LimitRuleModal
      <button data-testid="mock-save" onClick={() => props.onSave({ metric_type: "tokens", threshold: 100, period: "day", action: "notify" })}>
        Save
      </button>
    </div>
  ),
}));

vi.mock("../../src/components/ProviderBanner.js", () => ({
  default: (props: any) => (
    <div data-testid="provider-banner">
      ProviderBanner
      <button data-testid="mock-remove" onClick={() => props.onRemove()}>Remove</button>
    </div>
  ),
}));

vi.mock("../../src/components/CloudEmailInfo.js", () => ({
  default: (props: any) => (
    <div data-testid="cloud-email-info">CloudEmailInfo: {props.email}</div>
  ),
}));

vi.mock("../../src/services/auth-client.js", () => ({
  authClient: {
    useSession: () => () => ({ data: { user: { email: "user@example.com" } } }),
  },
}));

import Limits from "../../src/pages/Limits";

describe("Limits page", () => {
  beforeEach(() => {
    mockRules = [];
    mockEmailProvider = null;
    mockRoutingStatus = { enabled: false };
    mockIsLocalMode = false;
  });

  it("renders page title", () => {
    render(() => <Limits />);
    expect(screen.getByText("Limits")).toBeDefined();
  });

  it("renders breadcrumb with agent name", () => {
    const { container } = render(() => <Limits />);
    expect(container.textContent).toContain("test-agent");
  });

  it("renders Create rule button", () => {
    render(() => <Limits />);
    expect(screen.getByText("+ Create rule")).toBeDefined();
  });

  it("renders empty state when no rules", () => {
    render(() => <Limits />);
    expect(screen.getByText("No rules yet")).toBeDefined();
  });

  it("renders rules table when rules exist", async () => {
    mockRules = [
      {
        id: "r1", agent_name: "test-agent", metric_type: "tokens",
        threshold: 50000, period: "day", action: "notify",
        is_active: true, trigger_count: 2, created_at: "2026-01-01",
      },
      {
        id: "r2", agent_name: "test-agent", metric_type: "cost",
        threshold: 10, period: "month", action: "block",
        is_active: true, trigger_count: 0, created_at: "2026-01-02",
      },
    ];

    const { container } = render(() => <Limits />);

    await vi.waitFor(() => {
      expect(screen.getByText("Email alert")).toBeDefined();
      expect(screen.getByText("Limit")).toBeDefined();
      expect(container.querySelectorAll("table tbody tr").length).toBe(2);
    });
  });

  it("shows routing CTA banner when routing disabled in cloud mode", () => {
    mockRoutingStatus = { enabled: false };
    mockIsLocalMode = false;

    const { container } = render(() => <Limits />);
    expect(container.textContent).toContain("Enable routing to set hard limits");
  });

  it("hides routing CTA banner when routing enabled", async () => {
    mockRoutingStatus = { enabled: true };

    const { container } = render(() => <Limits />);

    await vi.waitFor(() => {
      expect(container.textContent).not.toContain("Enable routing to set hard limits");
    });
  });

  it("hides routing CTA banner in local mode", () => {
    mockRoutingStatus = { enabled: false };
    mockIsLocalMode = true;

    const { container } = render(() => <Limits />);
    expect(container.textContent).not.toContain("Enable routing to set hard limits");
  });

  it("shows cloud email info in cloud mode", () => {
    mockIsLocalMode = false;
    render(() => <Limits />);
    expect(screen.getByTestId("cloud-email-info")).toBeDefined();
  });

  it("shows email provider setup in local mode", () => {
    mockIsLocalMode = true;
    render(() => <Limits />);
    expect(screen.getByTestId("email-setup")).toBeDefined();
  });

  it("hides email provider setup in cloud mode", () => {
    mockIsLocalMode = false;
    const { container } = render(() => <Limits />);
    expect(container.querySelector('[data-testid="email-setup"]')).toBeNull();
    expect(container.querySelector('[data-testid="provider-banner"]')).toBeNull();
  });

  it("passes routingEnabled to modal", async () => {
    mockRoutingStatus = { enabled: true };
    render(() => <Limits />);

    await vi.waitFor(() => {
      const modal = screen.getByTestId("limit-modal");
      expect(modal.getAttribute("data-routing")).toBe("true");
    });
  });

  it("formats token threshold with locale string", async () => {
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "tokens",
      threshold: 50000, period: "day", action: "notify",
      is_active: true, trigger_count: 0, created_at: "2026-01-01",
    }];

    const { container } = render(() => <Limits />);

    await vi.waitFor(() => {
      expect(container.textContent).toContain("50,000");
    });
  });

  it("formats cost threshold with dollar sign", async () => {
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "cost",
      threshold: 10.5, period: "month", action: "block",
      is_active: true, trigger_count: 0, created_at: "2026-01-01",
    }];

    const { container } = render(() => <Limits />);

    await vi.waitFor(() => {
      expect(container.textContent).toContain("$10.50");
    });
  });

  it("shows warning banner when block rules have been triggered", async () => {
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "tokens",
      threshold: 50000, period: "day", action: "block",
      is_active: true, trigger_count: 3, created_at: "2026-01-01",
    }];

    const { container } = render(() => <Limits />);

    await vi.waitFor(() => {
      expect(container.textContent).toContain("One or more hard limits have been triggered");
    });
  });

  it("does not show warning banner when no block rules triggered", async () => {
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "tokens",
      threshold: 50000, period: "day", action: "notify",
      is_active: true, trigger_count: 5, created_at: "2026-01-01",
    }];

    const { container } = render(() => <Limits />);

    await vi.waitFor(() => {
      expect(container.textContent).not.toContain("One or more hard limits have been triggered");
    });
  });

  it("does not show warning banner when block rules are inactive", async () => {
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "tokens",
      threshold: 50000, period: "day", action: "block",
      is_active: false, trigger_count: 3, created_at: "2026-01-01",
    }];

    const { container } = render(() => <Limits />);

    await vi.waitFor(() => {
      expect(container.textContent).not.toContain("One or more hard limits have been triggered");
    });
  });

  it("renders period labels correctly", async () => {
    mockRules = [
      { id: "r1", agent_name: "test-agent", metric_type: "tokens", threshold: 100, period: "hour", action: "notify", is_active: true, trigger_count: 0, created_at: "2026-01-01" },
      { id: "r2", agent_name: "test-agent", metric_type: "tokens", threshold: 200, period: "week", action: "notify", is_active: true, trigger_count: 0, created_at: "2026-01-01" },
    ];

    const { container } = render(() => <Limits />);

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Per hour");
      expect(container.textContent).toContain("Per week");
    });
  });

  it("shows disabled row style for inactive rules (is_active=0)", async () => {
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "tokens",
      threshold: 50000, period: "day", action: "notify",
      is_active: 0, trigger_count: 0, created_at: "2026-01-01",
    }];
    const { container } = render(() => <Limits />);
    await vi.waitFor(() => {
      expect(container.querySelector(".notif-table__row--disabled")).not.toBeNull();
    });
  });

  it("does not show disabled row for active rules (is_active=1, SQLite)", async () => {
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "tokens",
      threshold: 50000, period: "day", action: "notify",
      is_active: 1, trigger_count: 0, created_at: "2026-01-01",
    }];
    const { container } = render(() => <Limits />);
    await vi.waitFor(() => {
      expect(container.querySelector(".notif-table__row--disabled")).toBeNull();
    });
  });

  it("shows provider banner when email provider is configured in local mode", async () => {
    mockEmailProvider = { provider: "resend", domain: null, keyPrefix: "re_", is_active: true };
    mockIsLocalMode = true;

    render(() => <Limits />);

    await vi.waitFor(() => {
      expect(screen.getByTestId("provider-banner")).toBeDefined();
    });
  });

  it("renders delete button and defaults action to alert when not set", async () => {
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "tokens",
      threshold: 50000, period: "day",
      is_active: true, trigger_count: 7, created_at: "2026-01-01",
    }];

    const { container } = render(() => <Limits />);

    await vi.waitFor(() => {
      expect(screen.getByLabelText("Delete rule")).toBeDefined();
      expect(container.querySelector(".limit-type-badge--alert")).not.toBeNull();
      expect(container.textContent).toContain("7");
    });
  });

});
