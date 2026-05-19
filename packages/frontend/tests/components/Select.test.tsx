import { createSignal } from "solid-js";
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
    await fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("has correct aria attributes", () => {
    render(() => <Select options={options} value="a" onChange={() => {}} />);
    const trigger = screen.getByRole("button");
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes an open dropdown when the control becomes disabled", async () => {
    const onChange = vi.fn();

    const Harness = () => {
      const [disabled, setDisabled] = createSignal(false);
      return (
        <>
          <button type="button" onClick={() => setDisabled(true)}>
            Disable
          </button>
          <Select
            label="Unit select"
            options={[
              { label: "Alpha", value: "alpha" },
              { label: "Beta", value: "beta" },
            ]}
            value="alpha"
            onChange={onChange}
            disabled={disabled()}
          />
        </>
      );
    };

    render(() => <Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Unit select" }));
    expect(screen.queryByRole("listbox")).not.toBeNull();

    fireEvent.click(screen.getByText("Disable"));

    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect((screen.getByRole("button", { name: "Unit select" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});
