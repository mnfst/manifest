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

  // Portal renders in document.body, so use document.querySelector for DOM queries
  const q = (sel: string) => document.querySelector(sel);
  const qa = (sel: string) => document.querySelectorAll(sel);

  it("renders nothing when closed", () => {
    render(() => (
      <LimitRuleModal open={false} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    expect(q(".modal-overlay")).toBeNull();
  });

  it("renders modal when open", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("Set up an email alert or hard limit for this agent's usage.")).toBeDefined();
  });

  it("shows description text", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    expect(screen.getByText("Set up an email alert or hard limit for this agent's usage.")).toBeDefined();
  });

  it("renders Alert and Hard Limit type buttons", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    expect(screen.getByText("Email Alert")).toBeDefined();
    expect(screen.getByText("Hard Limit")).toBeDefined();
  });

  it("defaults to notify action (Email Alert active)", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    const activeButtons = qa(".limit-type-option--active");
    expect(activeButtons.length).toBe(1);
    expect(activeButtons[0].textContent).toContain("Email Alert");
  });

  it("allows selecting block action by adding then deselecting", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    const buttons = qa(".limit-type-option");

    // Click Hard Limit — adds it (now both selected)
    fireEvent.click(buttons[1]);
    expect(qa(".limit-type-option--active").length).toBe(2);

    // Click Email Alert to deselect — only Hard Limit remains
    fireEvent.click(buttons[0]);
    const activeButtons = qa(".limit-type-option--active");
    expect(activeButtons.length).toBe(1);
    expect(activeButtons[0].textContent).toContain("Hard Limit");
  });

  it("allows selecting both types", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    const buttons = qa(".limit-type-option");

    // Email Alert is already selected, click Hard Limit to add it
    fireEvent.click(buttons[1]);

    const activeButtons = qa(".limit-type-option--active");
    expect(activeButtons.length).toBe(2);
  });

  it("prevents deselecting the last type", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    const buttons = qa(".limit-type-option");

    // Only Email Alert is selected, clicking it again should keep it
    fireEvent.click(buttons[0]);
    const activeButtons = qa(".limit-type-option--active");
    expect(activeButtons.length).toBe(1);
    expect(activeButtons[0].textContent).toContain("Email Alert");
  });

  it("renders metric select with Tokens and Cost options", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    const selects = qa("select");
    const metricSelect = selects[0] as HTMLSelectElement;
    expect(metricSelect.options.length).toBe(2);
    expect(metricSelect.options[0].text).toBe("Tokens");
    expect(metricSelect.options[1].text).toBe("Cost (USD)");
  });

  it("renders period select with four options", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    const selects = qa("select");
    const periodSelect = selects[1] as HTMLSelectElement;
    expect(periodSelect.options.length).toBe(4);
  });

  it("disables Create rule button when threshold is empty", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    const btn = q(".btn--primary") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("enables Create rule button when threshold is valid", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    const input = q('input[type="number"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "50000" } });

    const btn = q(".btn--primary") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("calls onSave with correct data when Create rule is clicked", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const input = q('input[type="number"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "50000" } });

    const btn = q(".btn--primary") as HTMLButtonElement;
    fireEvent.click(btn);

    expect(mockOnSave).toHaveBeenCalledWith({
      metric_type: "tokens",
      threshold: 50000,
      period: "day",
      action: "notify",
    });
  });

  it("calls onSave with block action when only Hard Limit selected", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const typeButtons = qa(".limit-type-option");
    // Add Hard Limit then remove Email Alert
    fireEvent.click(typeButtons[1]);
    fireEvent.click(typeButtons[0]);

    const input = q('input[type="number"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "10" } });

    const btn = q(".btn--primary") as HTMLButtonElement;
    fireEvent.click(btn);

    expect(mockOnSave).toHaveBeenCalledWith({
      metric_type: "tokens",
      threshold: 10,
      period: "day",
      action: "block",
    });
  });

  it("calls onSave with both action when both types selected", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    // Email Alert is already active, add Hard Limit
    const typeButtons = qa(".limit-type-option");
    fireEvent.click(typeButtons[1]);

    const input = q('input[type="number"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "10" } });

    const btn = q(".btn--primary") as HTMLButtonElement;
    fireEvent.click(btn);

    expect(mockOnSave).toHaveBeenCalledWith({
      metric_type: "tokens",
      threshold: 10,
      period: "day",
      action: "both",
    });
  });

  it("does not call onSave when threshold is zero", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const input = q('input[type="number"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "0" } });

    const btn = q(".btn--primary") as HTMLButtonElement;
    fireEvent.click(btn);

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it("does not call onSave when threshold is NaN", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const input = q('input[type="number"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "abc" } });

    const btn = q(".btn--primary") as HTMLButtonElement;
    fireEvent.click(btn);

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it("resets form after save", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const input = q('input[type="number"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "50000" } });

    const btn = q(".btn--primary") as HTMLButtonElement;
    fireEvent.click(btn);

    // After save, threshold should be reset
    expect(input.value).toBe("");
  });

  it("calls onClose and resets form when overlay is clicked", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const overlay = q(".modal-overlay");
    fireEvent.click(overlay!);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("does not close when clicking inside the modal card", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const card = screen.getByRole("dialog");
    fireEvent.click(card);

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("changes placeholder based on metric type", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const input = q('input[type="number"]') as HTMLInputElement;
    expect(input.placeholder).toBe("e.g. 50000");

    const selects = qa("select");
    fireEvent.change(selects[0], { target: { value: "cost" } });
    expect(input.placeholder).toBe("e.g. 10.00");
  });

  it("changes step based on metric type", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const input = q('input[type="number"]') as HTMLInputElement;
    expect(input.step).toBe("1"); // tokens

    const selects = qa("select");
    fireEvent.change(selects[0], { target: { value: "cost" } });
    expect(input.step).toBe("0.01"); // cost
  });

  it("submits on Enter key in threshold input", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const input = q('input[type="number"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "100" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({ threshold: 100 }));
  });

  it("has correct aria attributes on dialog", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("limit-modal-title");
  });

  it("shows Edit rule title and Save changes button in edit mode", () => {
    render(() => (
      <LimitRuleModal
        open={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        editData={{ metric_type: "cost", threshold: 25, period: "week", action: "block" }}
      />
    ));
    expect(screen.getByText("Edit rule")).toBeDefined();
    expect(screen.getByText("Save changes")).toBeDefined();
  });

  it("pre-fills form fields from editData", () => {
    render(() => (
      <LimitRuleModal
        open={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        editData={{ metric_type: "cost", threshold: 25.5, period: "week", action: "both" }}
      />
    ));

    const input = q('input[type="number"]') as HTMLInputElement;
    expect(input.value).toBe("25.5");

    const selects = qa("select");
    expect((selects[0] as HTMLSelectElement).value).toBe("cost");
    expect((selects[1] as HTMLSelectElement).value).toBe("week");

    const activeButtons = qa(".limit-type-option--active");
    expect(activeButtons.length).toBe(2);
  });

  // --- Checkmark SVG and hasProvider hint tests ---

  it("shows checkmark SVG on selected type button", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    // Email Alert is selected by default
    const checks = qa(".limit-type-option__check");
    expect(checks.length).toBe(1);
    // The check should be inside the active button
    const activeBtn = q(".limit-type-option--active")!;
    expect(activeBtn.querySelector(".limit-type-option__check")).not.toBeNull();
  });

  it("shows checkmarks on both buttons when both selected", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    const buttons = qa(".limit-type-option");
    // Add Hard Limit
    fireEvent.click(buttons[1]);
    const checks = qa(".limit-type-option__check");
    expect(checks.length).toBe(2);
  });

  it("hides checkmark on deselected button", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    const buttons = qa(".limit-type-option");
    // Add Hard Limit (both selected)
    fireEvent.click(buttons[1]);
    expect(qa(".limit-type-option__check").length).toBe(2);

    // Deselect Email Alert
    fireEvent.click(buttons[0]);
    const checks = qa(".limit-type-option__check");
    expect(checks.length).toBe(1);
    // Only Hard Limit button should have the check
    expect(buttons[1].querySelector(".limit-type-option__check")).not.toBeNull();
    expect(buttons[0].querySelector(".limit-type-option__check")).toBeNull();
  });

  it("shows hint when hasProvider is false and notify is selected", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} hasProvider={false} />
    ));
    const hint = q(".limit-type-hint");
    expect(hint).not.toBeNull();
    expect(hint!.textContent).toContain("Email alerts require an email provider");
  });

  it("does not show hint when hasProvider is true", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} hasProvider={true} />
    ));
    expect(q(".limit-type-hint")).toBeNull();
  });

  it("shows Create rule title when editData is null", () => {
    render(() => (
      <LimitRuleModal
        open={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        editData={null}
      />
    ));
    const title = q("#limit-modal-title") as HTMLElement;
    expect(title.textContent).toBe("Create rule");
  });
});
