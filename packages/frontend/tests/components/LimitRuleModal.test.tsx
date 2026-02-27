import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import LimitRuleModal from "../../src/components/LimitRuleModal";

describe("LimitRuleModal", () => {
  let mockOnClose: ReturnType<typeof vi.fn>;
  let mockOnSave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnClose = vi.fn();
    mockOnSave = vi.fn();
  });

  it("renders nothing when closed", () => {
    const { container } = render(() => (
      <LimitRuleModal open={false} routingEnabled={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    expect(container.querySelector(".modal-overlay")).toBeNull();
  });

  it("renders modal when open", () => {
    render(() => (
      <LimitRuleModal open={true} routingEnabled={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("Set up an email alert or hard limit for this agent's usage.")).toBeDefined();
  });

  it("shows description text", () => {
    render(() => (
      <LimitRuleModal open={true} routingEnabled={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    expect(screen.getByText("Set up an email alert or hard limit for this agent's usage.")).toBeDefined();
  });

  it("renders Alert and Hard Limit type buttons", () => {
    render(() => (
      <LimitRuleModal open={true} routingEnabled={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    expect(screen.getByText("Email Alert")).toBeDefined();
    expect(screen.getByText("Hard Limit")).toBeDefined();
  });

  it("defaults to notify action", () => {
    const { container } = render(() => (
      <LimitRuleModal open={true} routingEnabled={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    const alertBtn = container.querySelector(".limit-type-option--active");
    expect(alertBtn?.textContent).toContain("Email Alert");
  });

  it("allows selecting block action when routing is enabled", () => {
    const { container } = render(() => (
      <LimitRuleModal open={true} routingEnabled={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    const buttons = container.querySelectorAll(".limit-type-option");
    fireEvent.click(buttons[1]); // Hard Limit button

    const active = container.querySelector(".limit-type-option--active");
    expect(active?.textContent).toContain("Hard Limit");
  });

  it("disables Hard Limit button when routing is not enabled", () => {
    const { container } = render(() => (
      <LimitRuleModal open={true} routingEnabled={false} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    const buttons = container.querySelectorAll(".limit-type-option");
    const hardLimitBtn = buttons[1] as HTMLButtonElement;
    expect(hardLimitBtn.disabled).toBe(true);
  });

  it("shows disabled class on Hard Limit when routing is off", () => {
    const { container } = render(() => (
      <LimitRuleModal open={true} routingEnabled={false} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    const disabledBtn = container.querySelector(".limit-type-option--disabled");
    expect(disabledBtn).not.toBeNull();
    expect(disabledBtn?.textContent).toContain("Hard Limit");
  });

  it("shows tooltip on disabled Hard Limit button", () => {
    const { container } = render(() => (
      <LimitRuleModal open={true} routingEnabled={false} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    const disabledBtn = container.querySelector(".limit-type-option--disabled") as HTMLButtonElement;
    expect(disabledBtn.title).toBe("Enable routing to use hard limits");
  });

  it("does not switch to block when clicking disabled Hard Limit", () => {
    const { container } = render(() => (
      <LimitRuleModal open={true} routingEnabled={false} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    const buttons = container.querySelectorAll(".limit-type-option");
    fireEvent.click(buttons[1]); // Hard Limit (disabled)

    const active = container.querySelector(".limit-type-option--active");
    expect(active?.textContent).toContain("Email Alert"); // still Email Alert
  });

  it("renders metric select with Tokens and Cost options", () => {
    const { container } = render(() => (
      <LimitRuleModal open={true} routingEnabled={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    const selects = container.querySelectorAll("select");
    const metricSelect = selects[0] as HTMLSelectElement;
    expect(metricSelect.options.length).toBe(2);
    expect(metricSelect.options[0].text).toBe("Tokens");
    expect(metricSelect.options[1].text).toBe("Cost (USD)");
  });

  it("renders period select with four options", () => {
    const { container } = render(() => (
      <LimitRuleModal open={true} routingEnabled={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    const selects = container.querySelectorAll("select");
    const periodSelect = selects[1] as HTMLSelectElement;
    expect(periodSelect.options.length).toBe(4);
  });

  it("disables Create rule button when threshold is empty", () => {
    const { container } = render(() => (
      <LimitRuleModal open={true} routingEnabled={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    const btn = container.querySelector(".btn--primary") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("enables Create rule button when threshold is valid", () => {
    const { container } = render(() => (
      <LimitRuleModal open={true} routingEnabled={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "50000" } });

    const btn = container.querySelector(".btn--primary") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("calls onSave with correct data when Create rule is clicked", () => {
    const { container } = render(() => (
      <LimitRuleModal open={true} routingEnabled={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "50000" } });

    const btn = container.querySelector(".btn--primary") as HTMLButtonElement;
    fireEvent.click(btn);

    expect(mockOnSave).toHaveBeenCalledWith({
      metric_type: "tokens",
      threshold: 50000,
      period: "day",
      action: "notify",
    });
  });

  it("calls onSave with block action when Hard Limit selected", () => {
    const { container } = render(() => (
      <LimitRuleModal open={true} routingEnabled={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    // Select Hard Limit
    const typeButtons = container.querySelectorAll(".limit-type-option");
    fireEvent.click(typeButtons[1]);

    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "10" } });

    const btn = container.querySelector(".btn--primary") as HTMLButtonElement;
    fireEvent.click(btn);

    expect(mockOnSave).toHaveBeenCalledWith({
      metric_type: "tokens",
      threshold: 10,
      period: "day",
      action: "block",
    });
  });

  it("does not call onSave when threshold is zero", () => {
    const { container } = render(() => (
      <LimitRuleModal open={true} routingEnabled={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "0" } });

    const btn = container.querySelector(".btn--primary") as HTMLButtonElement;
    fireEvent.click(btn);

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it("does not call onSave when threshold is NaN", () => {
    const { container } = render(() => (
      <LimitRuleModal open={true} routingEnabled={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "abc" } });

    const btn = container.querySelector(".btn--primary") as HTMLButtonElement;
    fireEvent.click(btn);

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it("resets form after save", () => {
    const { container } = render(() => (
      <LimitRuleModal open={true} routingEnabled={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "50000" } });

    const btn = container.querySelector(".btn--primary") as HTMLButtonElement;
    fireEvent.click(btn);

    // After save, threshold should be reset
    expect(input.value).toBe("");
  });

  it("calls onClose and resets form when overlay is clicked", () => {
    const { container } = render(() => (
      <LimitRuleModal open={true} routingEnabled={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const overlay = container.querySelector(".modal-overlay");
    fireEvent.click(overlay!);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("does not close when clicking inside the modal card", () => {
    render(() => (
      <LimitRuleModal open={true} routingEnabled={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const card = screen.getByRole("dialog");
    fireEvent.click(card);

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("changes placeholder based on metric type", () => {
    const { container } = render(() => (
      <LimitRuleModal open={true} routingEnabled={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    // Default is tokens
    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(input.placeholder).toBe("e.g. 50000");

    // Switch to cost
    const selects = container.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "cost" } });
    expect(input.placeholder).toBe("e.g. 10.00");
  });

  it("changes step based on metric type", () => {
    const { container } = render(() => (
      <LimitRuleModal open={true} routingEnabled={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(input.step).toBe("1"); // tokens

    const selects = container.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "cost" } });
    expect(input.step).toBe("0.01"); // cost
  });

  it("submits on Enter key in threshold input", () => {
    const { container } = render(() => (
      <LimitRuleModal open={true} routingEnabled={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "100" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({ threshold: 100 }));
  });

  it("has correct aria attributes on dialog", () => {
    render(() => (
      <LimitRuleModal open={true} routingEnabled={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("limit-modal-title");
  });
});
