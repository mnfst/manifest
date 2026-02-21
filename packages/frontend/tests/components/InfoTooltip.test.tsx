import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import InfoTooltip from "../../src/components/InfoTooltip";

describe("InfoTooltip", () => {
  it("renders tooltip text", () => {
    render(() => <InfoTooltip text="Helpful info" />);
    expect(screen.getByText("Helpful info")).toBeDefined();
  });

  it("has aria-label with text", () => {
    render(() => <InfoTooltip text="Info text" />);
    expect(screen.getByRole("note")).toBeDefined();
    expect(screen.getByRole("note").getAttribute("aria-label")).toBe("Info text");
  });

  it("is focusable via tabindex", () => {
    render(() => <InfoTooltip text="Focus me" />);
    const el = screen.getByRole("note");
    expect(el.getAttribute("tabindex")).toBe("0");
  });
});
