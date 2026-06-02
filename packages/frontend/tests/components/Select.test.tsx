import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
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
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    await fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not close on non-Escape keys", async () => {
    render(() => <Select options={options} value="a" onChange={() => {}} />);
    const trigger = screen.getByRole("button", { name: /Option A/i });
    await fireEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeDefined();
    await fireEvent.keyDown(document, { key: "Enter" });
    await fireEvent.keyDown(document, { key: "ArrowDown" });
    await fireEvent.keyDown(document, { key: "a" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByRole("listbox")).not.toBeNull();
  });

  it("closes dropdown when clicking outside", async () => {
    render(() => <Select options={options} value="a" onChange={() => {}} />);
    const trigger = screen.getByRole("button", { name: /Option A/i });
    await fireEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeDefined();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const outsideElement = document.createElement("div");
    document.body.appendChild(outsideElement);
    await fireEvent.click(outsideElement);
    await waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    });
    expect(screen.queryByRole("listbox")).toBeNull();
    document.body.removeChild(outsideElement);
  });

  it("does not close when clicking inside the dropdown options", async () => {
    render(() => <Select options={options} value="a" onChange={() => {}} />);
    const trigger = screen.getByRole("button", { name: /Option A/i });
    await fireEvent.click(trigger);
    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeDefined();
    // Click on the listbox container itself (not an option) — should remain open
    // because the ref contains it.
    await fireEvent.click(listbox);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByRole("listbox")).not.toBeNull();
  });

  it("has correct aria attributes", () => {
    render(() => <Select options={options} value="a" onChange={() => {}} />);
    const trigger = screen.getByRole("button");
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
