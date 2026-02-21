import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import Select from "../../src/components/Select";

describe("Select", () => {
  const options = [
    { label: "Option A", value: "a" },
    { label: "Option B", value: "b" },
    { label: "Option C", value: "c" },
  ];

  it("renders with selected value label", () => {
    render(() => <Select options={options} value="b" onChange={() => {}} />);
    expect(screen.getByText("Option B")).toBeDefined();
  });

  it("shows placeholder when no match", () => {
    render(() => <Select options={options} value="" onChange={() => {}} placeholder="Pick one" />);
    expect(screen.getByText("Pick one")).toBeDefined();
  });

  it("opens dropdown on click", async () => {
    render(() => <Select options={options} value="a" onChange={() => {}} />);
    const trigger = screen.getByRole("button", { name: /Option A/i });
    await fireEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeDefined();
  });

  it("calls onChange when option selected", async () => {
    const onChange = vi.fn();
    render(() => <Select options={options} value="a" onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: /Option A/i });
    await fireEvent.click(trigger);
    const optB = screen.getByText("Option B");
    await fireEvent.click(optB);
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("closes on Escape key", async () => {
    render(() => <Select options={options} value="a" onChange={() => {}} />);
    const trigger = screen.getByRole("button", { name: /Option A/i });
    await fireEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeDefined();
    await fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("has correct aria attributes", () => {
    render(() => <Select options={options} value="a" onChange={() => {}} />);
    const trigger = screen.getByRole("button");
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
