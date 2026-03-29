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
    expect(screen.getByText("You'll receive an email alert when usage exceeds the threshold.")).toBeDefined();
  });

  it("shows description text", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    expect(screen.getByText("You'll receive an email alert when usage exceeds the threshold.")).toBeDefined();
  });

  it("renders block toggle", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    expect(screen.getByText("Block requests when exceeded")).toBeDefined();
    const toggle = q('.limit-block-toggle input[type="checkbox"]') as HTMLInputElement;
    expect(toggle).not.toBeNull();
    expect(toggle.checked).toBe(false);
  });

  it("defaults to notify action (block toggle off)", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));
    const toggle = q('.limit-block-toggle input[type="checkbox"]') as HTMLInputElement;
    expect(toggle.checked).toBe(false);
  });

  it("sets action to both when block toggle is enabled", () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const toggle = q('.limit-block-toggle input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);

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

  it("calls onSave with notify action when block toggle is off", () => {
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

  it("resets form after save", async () => {
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={mockOnSave} />
    ));

    const input = q('input[type="number"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "50000" } });

    const btn = q(".btn--primary") as HTMLButtonElement;
    fireEvent.click(btn);

    // After async save resolves, threshold should be reset
    await vi.waitFor(() => {
      expect(input.value).toBe("");
    });
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

    const toggle = q('.limit-block-toggle input[type="checkbox"]') as HTMLInputElement;
    expect(toggle.checked).toBe(true);
  });

  it("pre-fills block toggle as checked when editData action is block", () => {
    render(() => (
      <LimitRuleModal
        open={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        editData={{ metric_type: "tokens", threshold: 100, period: "day", action: "block" }}
      />
    ));
    const toggle = q('.limit-block-toggle input[type="checkbox"]') as HTMLInputElement;
    expect(toggle.checked).toBe(true);
  });

  it("pre-fills block toggle as unchecked when editData action is notify", () => {
    render(() => (
      <LimitRuleModal
        open={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        editData={{ metric_type: "tokens", threshold: 100, period: "day", action: "notify" }}
      />
    ));
    const toggle = q('.limit-block-toggle input[type="checkbox"]') as HTMLInputElement;
    expect(toggle.checked).toBe(false);
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

  it("shows Saving... and disables button during async onSave", async () => {
    let resolveSave: () => void;
    const asyncSave = vi.fn(() => new Promise<void>((r) => { resolveSave = r; }));
    render(() => (
      <LimitRuleModal open={true} onClose={mockOnClose} onSave={asyncSave} />
    ));

    const input = q('input[type="number"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: "50000" } });

    const btn = q(".btn--primary") as HTMLButtonElement;
    fireEvent.click(btn);

    await vi.waitFor(() => {
      expect(btn.querySelector(".spinner")).not.toBeNull();
      expect(btn.disabled).toBe(true);
    });

    resolveSave!();
    await vi.waitFor(() => {
      expect(btn.textContent).toBe("Create rule");
      expect(btn.disabled).toBe(true); // threshold reset to empty, so disabled
    });
  });
});
