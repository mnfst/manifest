import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  useParams: () => ({ agentName: "test-agent" }),
  A: (props: any) => <a href={props.href}>{props.children}</a>,
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

let mockRules: any[] = [];
let mockRoutingStatus = { enabled: false };

vi.mock("../../src/services/api.js", () => ({
  getNotificationRules: vi.fn(() => Promise.resolve(mockRules)),
  getNotificationLogs: vi.fn(() => Promise.resolve([])),
  createNotificationRule: vi.fn(() => Promise.resolve({})),
  updateNotificationRule: vi.fn(() => Promise.resolve({})),
  deleteNotificationRule: vi.fn(() => Promise.resolve({})),
  getRoutingStatus: vi.fn(() => Promise.resolve(mockRoutingStatus)),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../src/components/LimitRuleModal.js", () => ({
  default: (props: any) => (
    <div data-testid="limit-modal" data-open={props.open} data-edit={!!props.editData} data-has-provider={String(props.hasProvider ?? "")}>
      LimitRuleModal
      <button data-testid="mock-save" onClick={() => props.onSave({ metric_type: "tokens", threshold: 100, period: "day", action: "notify" })}>
        Save
      </button>
      <button data-testid="mock-close" onClick={() => props.onClose()}>
        MockClose
      </button>
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
    mockRoutingStatus = { enabled: false };
  });

  it("renders page title", () => {
    render(() => <Limits />);
    expect(screen.getByText("Limits")).toBeDefined();
  });

  it("renders breadcrumb with agent name", () => {
    const { container } = render(() => <Limits />);
    expect(container.textContent).toContain("test-agent");
    expect(container.textContent).toContain("Get notified or block requests when token or cost thresholds are exceeded");
  });

  it("renders Create rule button", () => {
    render(() => <Limits />);
    expect(screen.getByText("Create rule")).toBeDefined();
  });

  it("renders empty state when no rules", async () => {
    render(() => <Limits />);
    await waitFor(() => {
      expect(screen.getByText("No rules yet")).toBeDefined();
    });
    expect(screen.getByText("Set up alerts for usage spikes, or hard limits to block requests over budget.")).toBeDefined();
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
      expect(container.querySelectorAll(".limit-type-icon").length).toBeGreaterThanOrEqual(2);
      expect(container.querySelectorAll("table tbody tr").length).toBe(2);
    });
  });

  it("shows Connect-provider CTA banner when no provider is active", async () => {
    mockRoutingStatus = { enabled: false };

    const { container } = render(() => <Limits />);

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Connect a provider to set hard limits");
      expect(container.textContent).not.toContain("Enable routing to set hard limits");
    });
  });

  it("hides the CTA banner when a provider is already active", async () => {
    mockRoutingStatus = { enabled: true };

    const { container } = render(() => <Limits />);

    await vi.waitFor(() => {
      expect(container.textContent).not.toContain("Connect a provider to set hard limits");
      expect(container.textContent).not.toContain("Enable routing to set hard limits");
    });
  });

  it("shows cloud email info", () => {
    render(() => <Limits />);
    expect(screen.getByTestId("cloud-email-info")).toBeDefined();
  });

  it("passes session email to cloud email info", () => {
    const { container } = render(() => <Limits />);
    expect(container.textContent).toContain("user@example.com");
  });

  it("renders modal component", async () => {
    render(() => <Limits />);

    await vi.waitFor(() => {
      const modal = screen.getByTestId("limit-modal");
      expect(modal).toBeDefined();
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
      expect(container.textContent).toContain("One or more hard limits triggered");
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
      expect(container.textContent).not.toContain("One or more hard limits triggered");
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
      expect(container.textContent).not.toContain("One or more hard limits triggered");
    });
  });

  it("renders merged threshold with period labels", async () => {
    mockRules = [
      { id: "r1", agent_name: "test-agent", metric_type: "tokens", threshold: 100, period: "hour", action: "notify", is_active: true, trigger_count: 0, created_at: "2026-01-01" },
      { id: "r2", agent_name: "test-agent", metric_type: "tokens", threshold: 200, period: "week", action: "notify", is_active: true, trigger_count: 0, created_at: "2026-01-01" },
    ];

    const { container } = render(() => <Limits />);

    await vi.waitFor(() => {
      expect(container.textContent).toContain("per hour");
      expect(container.textContent).toContain("per week");
    });
  });

  it("shows disabled row style for inactive rules", async () => {
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "tokens",
      threshold: 50000, period: "day", action: "notify",
      is_active: false, trigger_count: 0, created_at: "2026-01-01",
    }];
    const { container } = render(() => <Limits />);
    await vi.waitFor(() => {
      expect(container.querySelector(".notif-table__row--disabled")).not.toBeNull();
    });
  });

  it("does not show disabled row for active rules", async () => {
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "tokens",
      threshold: 50000, period: "day", action: "notify",
      is_active: true, trigger_count: 0, created_at: "2026-01-01",
    }];
    const { container } = render(() => <Limits />);
    await vi.waitFor(() => {
      expect(container.querySelector(".notif-table__row--disabled")).toBeNull();
    });
  });

  it("renders kebab menu and defaults action to alert when not set", async () => {
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "tokens",
      threshold: 50000, period: "day",
      is_active: true, trigger_count: 7, created_at: "2026-01-01",
    }];

    const { container } = render(() => <Limits />);

    await vi.waitFor(() => {
      expect(screen.getByLabelText("Rule options")).toBeDefined();
      expect(container.querySelector(".limit-type-icon")).not.toBeNull();
      expect(container.textContent).toContain("7");
    });
  });

  it("shows both icons for rules with action both", async () => {
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "tokens",
      threshold: 50000, period: "day", action: "both",
      is_active: true, trigger_count: 0, created_at: "2026-01-01",
    }];

    const { container } = render(() => <Limits />);

    await vi.waitFor(() => {
      expect(container.querySelectorAll(".limit-type-icon").length).toBe(2);
    });
  });

  it("opens dropdown menu when kebab button is clicked", async () => {
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "tokens",
      threshold: 50000, period: "day", action: "notify",
      is_active: true, trigger_count: 0, created_at: "2026-01-01",
    }];

    const { container } = render(() => <Limits />);

    await vi.waitFor(() => {
      expect(screen.getByLabelText("Rule options")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Rule options"));

    await vi.waitFor(() => {
      expect(document.querySelector(".rule-menu__dropdown")).not.toBeNull();
      expect(screen.getByText("Edit")).toBeDefined();
      expect(screen.getByText("Delete")).toBeDefined();
    });
  });

  it("opens delete confirmation modal with checkbox", async () => {
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "tokens",
      threshold: 50000, period: "day", action: "notify",
      is_active: true, trigger_count: 0, created_at: "2026-01-01",
    }];

    render(() => <Limits />);

    await vi.waitFor(() => {
      expect(screen.getByLabelText("Rule options")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Rule options"));

    await vi.waitFor(() => {
      expect(screen.getByText("Delete")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Delete"));

    await vi.waitFor(() => {
      const title = document.querySelector(".modal-card__title") as HTMLElement;
      expect(title.textContent).toBe("Delete rule");
      expect(screen.getByText("I understand this action is irreversible")).toBeDefined();

      const deleteBtn = document.querySelector(".btn--danger") as HTMLButtonElement;
      expect(deleteBtn.disabled).toBe(true);
    });
  });

  it("enables delete button only after confirmation checkbox", async () => {
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "tokens",
      threshold: 50000, period: "day", action: "notify",
      is_active: true, trigger_count: 0, created_at: "2026-01-01",
    }];

    render(() => <Limits />);

    await vi.waitFor(() => {
      expect(screen.getByLabelText("Rule options")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Rule options"));
    await vi.waitFor(() => expect(screen.getByText("Delete")).toBeDefined());
    fireEvent.click(screen.getByText("Delete"));

    await vi.waitFor(() => {
      expect(document.querySelector(".btn--danger")).not.toBeNull();
    });

    const checkbox = document.querySelector('.confirm-modal__confirm-row input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);

    await vi.waitFor(() => {
      const deleteBtn = document.querySelector(".btn--danger") as HTMLButtonElement;
      expect(deleteBtn.disabled).toBe(false);
    });
  });

  it("opens edit modal when Edit is clicked from kebab menu", async () => {
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "tokens",
      threshold: 50000, period: "day", action: "notify",
      is_active: true, trigger_count: 0, created_at: "2026-01-01",
    }];

    render(() => <Limits />);

    await vi.waitFor(() => {
      expect(screen.getByLabelText("Rule options")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Rule options"));
    await vi.waitFor(() => expect(screen.getByText("Edit")).toBeDefined());
    fireEvent.click(screen.getByText("Edit"));

    await vi.waitFor(() => {
      const modal = screen.getByTestId("limit-modal");
      expect(modal.getAttribute("data-open")).toBe("true");
      expect(modal.getAttribute("data-edit")).toBe("true");
    });
  });

  // --- Delete rule modal content tests ---

  it("shows 'token' (singular) in delete modal for tokens metric type", async () => {
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "tokens",
      threshold: 50000, period: "day", action: "notify",
      is_active: true, trigger_count: 0, created_at: "2026-01-01",
    }];

    render(() => <Limits />);

    await vi.waitFor(() => {
      expect(screen.getByLabelText("Rule options")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Rule options"));
    await vi.waitFor(() => expect(screen.getByText("Delete")).toBeDefined());
    fireEvent.click(screen.getByText("Delete"));

    await vi.waitFor(() => {
      const desc = document.querySelector(".modal-card__desc") as HTMLElement;
      expect(desc.textContent).toContain("tokens");
    });
  });

  it("shows 'cost' with formatted threshold in delete modal for cost metric type", async () => {
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "cost",
      threshold: 25.5, period: "month", action: "block",
      is_active: true, trigger_count: 0, created_at: "2026-01-01",
    }];

    render(() => <Limits />);

    await vi.waitFor(() => {
      expect(screen.getByLabelText("Rule options")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Rule options"));
    await vi.waitFor(() => expect(screen.getByText("Delete")).toBeDefined());
    fireEvent.click(screen.getByText("Delete"));

    await vi.waitFor(() => {
      const desc = document.querySelector(".modal-card__desc") as HTMLElement;
      expect(desc.textContent).toContain("cost");
      expect(desc.textContent).toContain("$25.50");
    });
  });

  it("closes delete modal when overlay is clicked", async () => {
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "tokens",
      threshold: 50000, period: "day", action: "notify",
      is_active: true, trigger_count: 0, created_at: "2026-01-01",
    }];

    render(() => <Limits />);

    await vi.waitFor(() => {
      expect(screen.getByLabelText("Rule options")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Rule options"));
    await vi.waitFor(() => expect(screen.getByText("Delete")).toBeDefined());
    fireEvent.click(screen.getByText("Delete"));

    await vi.waitFor(() => {
      expect(document.querySelector(".modal-card__title")).not.toBeNull();
    });

    // Click overlay to close
    const overlay = document.querySelector(".modal-overlay") as HTMLElement;
    fireEvent.click(overlay);

    await vi.waitFor(() => {
      const titles = document.querySelectorAll(".modal-card__title");
      const deleteTitle = Array.from(titles).find((t) => t.textContent === "Delete rule");
      expect(deleteTitle).toBeUndefined();
    });
  });

  it("closes delete modal when Cancel button is clicked", async () => {
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "tokens",
      threshold: 50000, period: "day", action: "notify",
      is_active: true, trigger_count: 0, created_at: "2026-01-01",
    }];

    render(() => <Limits />);

    await vi.waitFor(() => {
      expect(screen.getByLabelText("Rule options")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Rule options"));
    await vi.waitFor(() => expect(screen.getByText("Delete")).toBeDefined());
    fireEvent.click(screen.getByText("Delete"));

    await vi.waitFor(() => {
      expect(document.querySelector(".modal-card__title")).not.toBeNull();
    });

    const cancelBtn = Array.from(document.querySelectorAll(".btn--ghost")).find(
      (b) => b.textContent === "Cancel",
    ) as HTMLButtonElement;
    fireEvent.click(cancelBtn);

    await vi.waitFor(() => {
      const titles = document.querySelectorAll(".modal-card__title");
      const deleteTitle = Array.from(titles).find((t) => t.textContent === "Delete rule");
      expect(deleteTitle).toBeUndefined();
    });
  });

  it("resets editRule and closes modal on LimitRuleModal onClose", async () => {
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "tokens",
      threshold: 50000, period: "day", action: "notify",
      is_active: true, trigger_count: 0, created_at: "2026-01-01",
    }];

    render(() => <Limits />);

    // Open the create rule modal
    fireEvent.click(screen.getByText("Create rule"));
    await vi.waitFor(() => {
      const modal = screen.getByTestId("limit-modal");
      expect(modal.getAttribute("data-open")).toBe("true");
    });

    // Close via the mocked close button
    fireEvent.click(screen.getByTestId("mock-close"));
    await vi.waitFor(() => {
      const modal = screen.getByTestId("limit-modal");
      expect(modal.getAttribute("data-open")).toBe("false");
    });
  });

});
