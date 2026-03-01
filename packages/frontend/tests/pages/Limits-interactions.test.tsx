import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

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
  default: () => <div data-testid="email-setup">EmailProviderSetup</div>,
}));

vi.mock("../../src/components/LimitRuleModal.js", () => ({
  default: (props: any) => (
    <div data-testid="limit-modal" data-open={props.open}>
      <button data-testid="mock-save" onClick={() => props.onSave({ metric_type: "tokens", threshold: 100, period: "day", action: "notify" })}>
        Save
      </button>
    </div>
  ),
}));

vi.mock("../../src/components/ProviderBanner.js", () => ({
  default: (props: any) => (
    <div data-testid="provider-banner">
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

describe("Limits page interactions", () => {
  beforeEach(() => {
    mockRules = [];
    mockEmailProvider = null;
    mockRoutingStatus = { enabled: false };
    mockIsLocalMode = false;
    vi.clearAllMocks();
  });

  it("calls createNotificationRule and shows toast on save", async () => {
    const { createNotificationRule } = await import("../../src/services/api.js");
    const { toast } = await import("../../src/services/toast-store.js");

    render(() => <Limits />);
    fireEvent.click(screen.getByText("+ Create rule"));
    fireEvent.click(screen.getByTestId("mock-save"));

    await vi.waitFor(() => {
      expect(createNotificationRule).toHaveBeenCalledWith(expect.objectContaining({
        agent_name: "test-agent",
        metric_type: "tokens",
        threshold: 100,
      }));
      expect(toast.success).toHaveBeenCalledWith("Rule created");
    });
  });

  it("calls deleteNotificationRule via kebab menu and confirmation modal", async () => {
    const { deleteNotificationRule } = await import("../../src/services/api.js");
    const { toast } = await import("../../src/services/toast-store.js");
    mockRules = [{
      id: "r1", agent_name: "test-agent", metric_type: "tokens",
      threshold: 50000, period: "day", action: "notify",
      is_active: true, trigger_count: 0, created_at: "2026-01-01",
    }];

    render(() => <Limits />);

    // Open kebab menu
    await vi.waitFor(() => {
      expect(screen.getByLabelText("Rule options")).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText("Rule options"));

    // Click Delete in dropdown
    await vi.waitFor(() => {
      expect(screen.getByText("Delete")).toBeDefined();
    });
    fireEvent.click(screen.getByText("Delete"));

    // Confirm deletion: check the checkbox then click Delete rule
    await vi.waitFor(() => {
      expect(document.querySelector(".confirm-modal__confirm-row")).not.toBeNull();
    });

    const checkbox = document.querySelector('.confirm-modal__confirm-row input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);

    const deleteBtn = document.querySelector(".btn--danger") as HTMLButtonElement;
    fireEvent.click(deleteBtn);

    await vi.waitFor(() => {
      expect(deleteNotificationRule).toHaveBeenCalledWith("r1");
      expect(toast.success).toHaveBeenCalledWith("Rule deleted");
    });
  });

  it("calls removeEmailProvider when provider banner remove is clicked", async () => {
    const { removeEmailProvider } = await import("../../src/services/api.js");
    const { toast } = await import("../../src/services/toast-store.js");
    mockEmailProvider = { provider: "resend", domain: null, keyPrefix: "re_", is_active: true };
    mockIsLocalMode = true;

    render(() => <Limits />);

    await vi.waitFor(() => {
      fireEvent.click(screen.getByTestId("mock-remove"));
    });

    await vi.waitFor(() => {
      expect(removeEmailProvider).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Email provider removed");
    });
  });
});
