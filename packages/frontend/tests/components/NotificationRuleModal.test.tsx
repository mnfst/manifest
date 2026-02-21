import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

const mockCreateNotificationRule = vi.fn();
const mockUpdateNotificationRule = vi.fn();
vi.mock("../../src/services/api.js", () => ({
  createNotificationRule: (...args: unknown[]) => mockCreateNotificationRule(...args),
  updateNotificationRule: (...args: unknown[]) => mockUpdateNotificationRule(...args),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import NotificationRuleModal from "../../src/components/NotificationRuleModal";

describe("NotificationRuleModal", () => {
  const onClose = vi.fn();
  const onSaved = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = render(() => (
      <NotificationRuleModal open={false} agentName="test-agent" onClose={onClose} onSaved={onSaved} />
    ));
    expect(container.querySelector(".modal-overlay")).toBeNull();
  });

  it("renders create alert title when open", () => {
    const { container } = render(() => (
      <NotificationRuleModal open={true} agentName="test-agent" onClose={onClose} onSaved={onSaved} />
    ));
    const title = container.querySelector("#rule-modal-title");
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe("Create alert");
  });

  it("renders edit alert title when rule is provided", () => {
    const rule = { id: "r1", agent_name: "test-agent", metric_type: "tokens", threshold: 50000, period: "day", is_active: true, trigger_count: 0 };
    render(() => (
      <NotificationRuleModal open={true} agentName="test-agent" rule={rule} onClose={onClose} onSaved={onSaved} />
    ));
    expect(screen.getByText("Edit alert")).toBeDefined();
  });

  it("has metric type selector", () => {
    const { container } = render(() => (
      <NotificationRuleModal open={true} agentName="test-agent" onClose={onClose} onSaved={onSaved} />
    ));
    expect(container.textContent).toContain("Alert me about");
    const select = container.querySelector(".notification-modal__select") as HTMLSelectElement;
    expect(select).not.toBeNull();
  });

  it("has threshold input", () => {
    const { container } = render(() => (
      <NotificationRuleModal open={true} agentName="test-agent" onClose={onClose} onSaved={onSaved} />
    ));
    expect(container.textContent).toContain("Threshold");
    const input = container.querySelector('.modal-card__input[type="number"]');
    expect(input).not.toBeNull();
  });

  it("has period selector", () => {
    const { container } = render(() => (
      <NotificationRuleModal open={true} agentName="test-agent" onClose={onClose} onSaved={onSaved} />
    ));
    expect(container.textContent).toContain("Check every");
    const selects = container.querySelectorAll(".notification-modal__select");
    expect(selects.length).toBe(2);
  });

  it("create button is disabled when threshold is empty", () => {
    const { container } = render(() => (
      <NotificationRuleModal open={true} agentName="test-agent" onClose={onClose} onSaved={onSaved} />
    ));
    const createBtn = Array.from(container.querySelectorAll("button.btn--primary")).find(
      (b) => b.textContent?.includes("Create alert"),
    ) as HTMLButtonElement;
    expect(createBtn.disabled).toBe(true);
  });

  it("create button enables when threshold is set", () => {
    const { container } = render(() => (
      <NotificationRuleModal open={true} agentName="test-agent" onClose={onClose} onSaved={onSaved} />
    ));
    const input = container.querySelector('.modal-card__input[type="number"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "50000" } });

    const createBtn = Array.from(container.querySelectorAll("button.btn--primary")).find(
      (b) => b.textContent?.includes("Create alert"),
    ) as HTMLButtonElement;
    expect(createBtn.disabled).toBe(false);
  });

  it("calls createNotificationRule on save", async () => {
    mockCreateNotificationRule.mockResolvedValue({});
    const { container } = render(() => (
      <NotificationRuleModal open={true} agentName="test-agent" onClose={onClose} onSaved={onSaved} />
    ));
    const input = container.querySelector('.modal-card__input[type="number"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "50000" } });

    const createBtn = Array.from(container.querySelectorAll("button.btn--primary")).find(
      (b) => b.textContent?.includes("Create alert"),
    )!;
    fireEvent.click(createBtn);

    await vi.waitFor(() => {
      expect(mockCreateNotificationRule).toHaveBeenCalledWith({
        agent_name: "test-agent",
        metric_type: "tokens",
        threshold: 50000,
        period: "day",
      });
    });
  });

  it("calls updateNotificationRule when editing", async () => {
    mockUpdateNotificationRule.mockResolvedValue({});
    const rule = { id: "r1", agent_name: "test-agent", metric_type: "cost", threshold: 10, period: "hour", is_active: true, trigger_count: 0 };
    const { container } = render(() => (
      <NotificationRuleModal open={true} agentName="test-agent" rule={rule} onClose={onClose} onSaved={onSaved} />
    ));

    const saveBtn = Array.from(container.querySelectorAll("button.btn--primary")).find(
      (b) => b.textContent?.includes("Save changes"),
    )!;
    fireEvent.click(saveBtn);

    await vi.waitFor(() => {
      expect(mockUpdateNotificationRule).toHaveBeenCalledWith("r1", {
        metric_type: "cost",
        threshold: 10,
        period: "hour",
      });
    });
  });

  it("closes when overlay is clicked", () => {
    const { container } = render(() => (
      <NotificationRuleModal open={true} agentName="test-agent" onClose={onClose} onSaved={onSaved} />
    ));
    const overlay = container.querySelector(".modal-overlay")!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows token-specific helper text by default", () => {
    const { container } = render(() => (
      <NotificationRuleModal open={true} agentName="test-agent" onClose={onClose} onSaved={onSaved} />
    ));
    expect(container.textContent).toContain("typical conversation uses 1,000");
  });
});
