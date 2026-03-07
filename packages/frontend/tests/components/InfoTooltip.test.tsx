import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import InfoTooltip from "../../src/components/InfoTooltip";

describe("InfoTooltip", () => {
  it("renders tooltip text", () => {
    render(() => <InfoTooltip text="Helpful info" />);
    expect(screen.getByText("Helpful info")).toBeDefined();
  });

  it("has aria-label with text", () => {
    render(() => <InfoTooltip text="Info text" />);
    const el = screen.getByRole("button");
    expect(el).toBeDefined();
    expect(el.getAttribute("aria-label")).toBe("Info: Info text");
  });

  it("is focusable via tabindex", () => {
    render(() => <InfoTooltip text="Focus me" />);
    const el = screen.getByRole("button");
    expect(el.getAttribute("tabindex")).toBe("0");
  });

  it("has aria-expanded attribute", () => {
    render(() => <InfoTooltip text="Test" />);
    const el = screen.getByRole("button");
    expect(el.getAttribute("aria-expanded")).toBe("false");
  });

  it("marks SVG as aria-hidden", () => {
    const { container } = render(() => <InfoTooltip text="Test" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("has role=tooltip on bubble", () => {
    const { container } = render(() => <InfoTooltip text="Bubble text" />);
    const bubble = container.querySelector('[role="tooltip"]');
    expect(bubble).not.toBeNull();
    expect(bubble?.textContent).toBe("Bubble text");
  });

  it("toggles expanded on click", () => {
    render(() => <InfoTooltip text="Click me" />);
    const el = screen.getByRole("button");
    expect(el.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(el);
    expect(el.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(el);
    expect(el.getAttribute("aria-expanded")).toBe("false");
  });

  it("toggles expanded on Enter key", () => {
    render(() => <InfoTooltip text="Enter key" />);
    const el = screen.getByRole("button");
    expect(el.getAttribute("aria-expanded")).toBe("false");
    fireEvent.keyDown(el, { key: "Enter" });
    expect(el.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(el, { key: "Enter" });
    expect(el.getAttribute("aria-expanded")).toBe("false");
  });

  it("toggles expanded on Space key", () => {
    render(() => <InfoTooltip text="Space key" />);
    const el = screen.getByRole("button");
    fireEvent.keyDown(el, { key: " " });
    expect(el.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes on Escape key", () => {
    render(() => <InfoTooltip text="Escape key" />);
    const el = screen.getByRole("button");
    fireEvent.click(el);
    expect(el.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(el, { key: "Escape" });
    expect(el.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on focus out", () => {
    render(() => <InfoTooltip text="Focus out" />);
    const el = screen.getByRole("button");
    fireEvent.click(el);
    expect(el.getAttribute("aria-expanded")).toBe("true");
    fireEvent.focusOut(el);
    expect(el.getAttribute("aria-expanded")).toBe("false");
  });

  it("adds active class when expanded", () => {
    render(() => <InfoTooltip text="Active class" />);
    const el = screen.getByRole("button");
    expect(el.classList.contains("info-tooltip--active")).toBe(false);
    fireEvent.click(el);
    expect(el.classList.contains("info-tooltip--active")).toBe(true);
  });
});
