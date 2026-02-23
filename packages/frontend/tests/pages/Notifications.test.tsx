import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  useParams: () => ({ agentName: "test-agent" }),
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

const mockGetNotificationRules = vi.fn();
const mockUpdateNotificationRule = vi.fn();
const mockDeleteNotificationRule = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getNotificationRules: (...args: unknown[]) => mockGetNotificationRules(...args),
  updateNotificationRule: (...args: unknown[]) => mockUpdateNotificationRule(...args),
  deleteNotificationRule: (...args: unknown[]) => mockDeleteNotificationRule(...args),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../src/services/local-mode.js", () => ({
  checkLocalMode: vi.fn().mockResolvedValue(false),
  isLocalMode: () => false,
}));

vi.mock("../../src/components/NotificationRuleModal.jsx", () => ({
  default: () => <div data-testid="notification-modal" />,
}));

import Notifications from "../../src/pages/Notifications";

const rulesData = [
  { id: "r1", agent_name: "test-agent", metric_type: "tokens", threshold: 50000, period: "day", is_active: true, trigger_count: 3 },
  { id: "r2", agent_name: "test-agent", metric_type: "cost", threshold: 5.5, period: "hour", is_active: false, trigger_count: 0 },
];

describe("Notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetNotificationRules.mockResolvedValue(rulesData);
  });

  it("renders Notifications heading", () => {
    render(() => <Notifications />);
    expect(screen.getByText("Notifications")).toBeDefined();
  });

  it("renders Create alert button", () => {
    render(() => <Notifications />);
    const buttons = screen.getAllByText("Create alert");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows notification rules in table", async () => {
    const { container } = render(() => <Notifications />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Token usage");
      expect(container.textContent).toContain("50,000");
    });
  });

  it("shows cost rule with formatting", async () => {
    const { container } = render(() => <Notifications />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Cost");
      expect(container.textContent).toContain("$5.50");
    });
  });

  it("shows empty state when no rules", async () => {
    mockGetNotificationRules.mockResolvedValue([]);
    const { container } = render(() => <Notifications />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("No alerts set up");
    });
  });

  it("has toggle switches for rules", async () => {
    const { container } = render(() => <Notifications />);
    await vi.waitFor(() => {
      const toggles = container.querySelectorAll('.notification-toggle input[type="checkbox"]');
      expect(toggles.length).toBe(2);
    });
  });

  it("has delete buttons for rules", async () => {
    const { container } = render(() => <Notifications />);
    await vi.waitFor(() => {
      const delBtns = container.querySelectorAll('.notification-rule__delete');
      expect(delBtns.length).toBe(2);
    });
  });

  it("has edit buttons for rules", async () => {
    const { container } = render(() => <Notifications />);
    await vi.waitFor(() => {
      const editBtns = container.querySelectorAll('.notification-rule__edit');
      expect(editBtns.length).toBe(2);
    });
  });

  it("toggle calls updateNotificationRule", async () => {
    mockUpdateNotificationRule.mockResolvedValue({});
    const { container } = render(() => <Notifications />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('.notification-toggle').length).toBe(2);
    });
    const toggle = container.querySelectorAll('.notification-toggle input[type="checkbox"]')[0];
    fireEvent.change(toggle);
    await vi.waitFor(() => {
      expect(mockUpdateNotificationRule).toHaveBeenCalledWith("r1", { is_active: false });
    });
  });

  it("delete calls deleteNotificationRule", async () => {
    mockDeleteNotificationRule.mockResolvedValue({});
    const { container } = render(() => <Notifications />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('.notification-rule__delete').length).toBe(2);
    });
    fireEvent.click(container.querySelectorAll('.notification-rule__delete')[0]);
    await vi.waitFor(() => {
      expect(mockDeleteNotificationRule).toHaveBeenCalledWith("r1");
    });
  });

  it("calls getNotificationRules on mount", async () => {
    render(() => <Notifications />);
    await vi.waitFor(() => {
      expect(mockGetNotificationRules).toHaveBeenCalledWith("test-agent");
    });
  });
});
