import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";

vi.mock("@solidjs/router", () => ({
  useParams: () => ({ agentName: "test-agent" }),
}));

vi.mock("@solidjs/meta", () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

vi.mock("../../src/services/api.js", () => ({
  getNotificationRules: vi.fn().mockResolvedValue([]),
  updateNotificationRule: vi.fn(),
  deleteNotificationRule: vi.fn(),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../src/components/NotificationRuleModal.jsx", () => ({
  default: () => <div data-testid="notification-modal" />,
}));

import Notifications from "../../src/pages/Notifications";

describe("Notifications", () => {
  it("renders Notifications heading", () => {
    render(() => <Notifications />);
    expect(screen.getByText("Notifications")).toBeDefined();
  });

  it("renders Create alert button", () => {
    render(() => <Notifications />);
    const buttons = screen.getAllByText("Create alert");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });
});
