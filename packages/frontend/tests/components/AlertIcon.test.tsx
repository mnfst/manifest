import { describe, it, expect } from "vitest";
import { render } from "@solidjs/testing-library";
import AlertIcon from "../../src/components/AlertIcon";

describe("AlertIcon", () => {
  it("renders an SVG element", () => {
    const { container } = render(() => <AlertIcon />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("sets aria-hidden to true", () => {
    const { container } = render(() => <AlertIcon />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  it("uses default size of 16", () => {
    const { container } = render(() => <AlertIcon />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("16");
    expect(svg.getAttribute("height")).toBe("16");
  });

  it("applies custom size prop", () => {
    const { container } = render(() => <AlertIcon size={24} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("24");
    expect(svg.getAttribute("height")).toBe("24");
  });
});
