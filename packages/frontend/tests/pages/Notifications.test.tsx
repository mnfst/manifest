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
const mockGetEmailProvider = vi.fn();
const mockSetEmailProvider = vi.fn();
const mockRemoveEmailProvider = vi.fn();
const mockTestEmailProvider = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  getNotificationRules: (...args: unknown[]) => mockGetNotificationRules(...args),
  updateNotificationRule: (...args: unknown[]) => mockUpdateNotificationRule(...args),
  deleteNotificationRule: (...args: unknown[]) => mockDeleteNotificationRule(...args),
  getEmailProvider: (...args: unknown[]) => mockGetEmailProvider(...args),
  setEmailProvider: (...args: unknown[]) => mockSetEmailProvider(...args),
  removeEmailProvider: (...args: unknown[]) => mockRemoveEmailProvider(...args),
  testEmailProvider: (...args: unknown[]) => mockTestEmailProvider(...args),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../src/services/local-mode.js", () => ({
  checkLocalMode: vi.fn().mockResolvedValue(false),
  isLocalMode: () => false,
}));

vi.mock("../../src/components/ErrorState.jsx", () => ({
  default: (props: any) => <div data-testid="error-state">{props.error?.message ?? "Error"}</div>,
}));

vi.mock("../../src/components/NotificationRuleModal.jsx", () => ({
  default: (props: any) => <div data-testid="notification-modal" data-open={String(props.open)} data-agent={props.agentName} data-rule={JSON.stringify(props.rule)} />,
}));

vi.mock("../../src/components/EmailProviderSetup.jsx", () => ({
  default: (props: any) => <div data-testid="email-provider-setup" data-configured={String(!!props.onConfigured)} />,
}));

vi.mock("../../src/components/EmailProviderModal.jsx", () => ({
  default: (props: any) => <div data-testid="email-provider-modal" data-open={String(props.open)} data-provider={props.initialProvider} data-edit={String(props.editMode)} data-prefix={props.existingKeyPrefix} data-domain={props.existingDomain} data-email={props.existingNotificationEmail} />,
}));

vi.mock("../../src/components/ProviderBanner.jsx", () => ({
  default: (props: any) => (
    <div data-testid="provider-banner">
      <button data-testid="remove-provider-btn" onClick={() => props.onRemove?.()}>Remove</button>
      <button data-testid="edit-provider-btn" onClick={() => props.onEdit?.()}>Edit</button>
    </div>
  ),
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
    mockGetEmailProvider.mockResolvedValue({ provider: "resend", domain: "example.com", keyPrefix: "re_abcde", is_active: true });
  });

  it("renders Notifications heading", () => {
    render(() => <Notifications />);
    expect(screen.getByText("Notifications")).toBeDefined();
  });

  it("renders Create alert button", async () => {
    render(() => <Notifications />);
    await vi.waitFor(() => {
      const buttons = screen.getAllByText("Create alert");
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
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
      expect(container.textContent).toContain("No alerts configured");
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

  it("shows EmailProviderSetup when no provider configured", async () => {
    mockGetEmailProvider.mockResolvedValue(null);
    render(() => <Notifications />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("email-provider-setup")).toBeDefined();
    });
  });

  it("shows ProviderBanner when provider is configured", async () => {
    render(() => <Notifications />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("provider-banner")).toBeDefined();
    });
  });

  it("shows empty state with Create alert button when provider exists but no rules", async () => {
    mockGetNotificationRules.mockResolvedValue([]);
    const { container } = render(() => <Notifications />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("No alerts configured");
      expect(container.textContent).toContain("Create your first alert");
    });
  });

  it("handleRemoveProvider calls removeEmailProvider", async () => {
    mockRemoveEmailProvider.mockResolvedValue({});
    render(() => <Notifications />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("provider-banner")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("remove-provider-btn"));
    await vi.waitFor(() => {
      expect(mockRemoveEmailProvider).toHaveBeenCalled();
    });
  });

  it("opens create modal when Create alert is clicked", async () => {
    render(() => <Notifications />);
    await vi.waitFor(() => {
      const buttons = screen.getAllByText("Create alert");
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
    fireEvent.click(screen.getAllByText("Create alert")[0]);
    expect(screen.getByTestId("notification-modal")).toBeDefined();
  });

  it("opens edit modal when edit button is clicked", async () => {
    const { container } = render(() => <Notifications />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('.notification-rule__edit').length).toBe(2);
    });
    fireEvent.click(container.querySelectorAll('.notification-rule__edit')[0]);
    expect(screen.getByTestId("notification-modal")).toBeDefined();
  });

  it("opens edit provider modal when edit button on banner is clicked", async () => {
    render(() => <Notifications />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("provider-banner")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("edit-provider-btn"));
    expect(screen.getByTestId("email-provider-modal")).toBeDefined();
  });

  it("shows warning hint when rules exist but no provider", async () => {
    mockGetEmailProvider.mockResolvedValue(null);
    mockGetNotificationRules.mockResolvedValue(rulesData);
    const { container } = render(() => <Notifications />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("You must configure a valid email provider");
      expect(container.textContent).toContain("currently inactive");
    });
  });

  it("shows disabled table when no provider but rules exist", async () => {
    mockGetEmailProvider.mockResolvedValue(null);
    mockGetNotificationRules.mockResolvedValue(rulesData);
    const { container } = render(() => <Notifications />);
    await vi.waitFor(() => {
      const card = container.querySelector(".settings-card--disabled");
      expect(card).not.toBeNull();
    });
  });

  it("does not show Create alert button in header when no provider", async () => {
    mockGetEmailProvider.mockResolvedValue(null);
    mockGetNotificationRules.mockResolvedValue([]);
    const { container } = render(() => <Notifications />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("email-provider-setup")).toBeDefined();
    });
    const headerBtn = container.querySelector(".page-header .btn--primary");
    expect(headerBtn).toBeNull();
  });

  it("handles toggle error gracefully", async () => {
    mockUpdateNotificationRule.mockRejectedValue(new Error("fail"));
    const { container } = render(() => <Notifications />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('.notification-toggle').length).toBe(2);
    });
    const toggle = container.querySelectorAll('.notification-toggle input[type="checkbox"]')[0];
    fireEvent.change(toggle);
    // Should not throw — error is caught silently
    await vi.waitFor(() => {
      expect(mockUpdateNotificationRule).toHaveBeenCalled();
    });
  });

  it("handles delete error gracefully", async () => {
    mockDeleteNotificationRule.mockRejectedValue(new Error("fail"));
    const { container } = render(() => <Notifications />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('.notification-rule__delete').length).toBe(2);
    });
    fireEvent.click(container.querySelectorAll('.notification-rule__delete')[0]);
    await vi.waitFor(() => {
      expect(mockDeleteNotificationRule).toHaveBeenCalled();
    });
  });

  it("handles removeProvider error gracefully", async () => {
    mockRemoveEmailProvider.mockRejectedValue(new Error("fail"));
    render(() => <Notifications />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("provider-banner")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("remove-provider-btn"));
    await vi.waitFor(() => {
      expect(mockRemoveEmailProvider).toHaveBeenCalled();
    });
  });

  it("shows error state when rules fetch fails", async () => {
    mockGetNotificationRules.mockRejectedValue(new Error("Network error"));
    render(() => <Notifications />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("error-state")).toBeDefined();
    });
  });
});
