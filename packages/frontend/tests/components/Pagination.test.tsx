import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import Pagination from "../../src/components/Pagination";

describe("Pagination", () => {
  it("renders summary text", () => {
    const { container } = render(() => (
      <Pagination
        currentPage={() => 1}
        totalItems={() => 100}
        pageSize={25}
        hasNextPage={() => true}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    ));
    expect(container.textContent).toContain("Showing 1");
    expect(container.textContent).toContain("25");
    expect(container.textContent).toContain("100");
  });

  it("shows correct range on page 2", () => {
    const { container } = render(() => (
      <Pagination
        currentPage={() => 2}
        totalItems={() => 60}
        pageSize={25}
        hasNextPage={() => true}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    ));
    expect(container.textContent).toContain("26");
    expect(container.textContent).toContain("50");
    expect(container.textContent).toContain("60");
  });

  it("clamps end to totalItems on last page", () => {
    const { container } = render(() => (
      <Pagination
        currentPage={() => 3}
        totalItems={() => 60}
        pageSize={25}
        hasNextPage={() => false}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    ));
    expect(container.textContent).toContain("51");
    expect(container.textContent).toContain("60");
  });

  it("Previous disabled on page 1", () => {
    render(() => (
      <Pagination
        currentPage={() => 1}
        totalItems={() => 100}
        pageSize={25}
        hasNextPage={() => true}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    ));
    const prev = screen.getByText("Previous");
    expect(prev.hasAttribute("disabled")).toBe(true);
  });

  it("Next disabled when no next page", () => {
    render(() => (
      <Pagination
        currentPage={() => 2}
        totalItems={() => 50}
        pageSize={25}
        hasNextPage={() => false}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    ));
    const next = screen.getByText("Next");
    expect(next.hasAttribute("disabled")).toBe(true);
  });

  it("calls onPrevious when Previous clicked", () => {
    const onPrevious = vi.fn();
    render(() => (
      <Pagination
        currentPage={() => 2}
        totalItems={() => 100}
        pageSize={25}
        hasNextPage={() => true}
        onPrevious={onPrevious}
        onNext={() => {}}
      />
    ));
    fireEvent.click(screen.getByText("Previous"));
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it("calls onNext when Next clicked", () => {
    const onNext = vi.fn();
    render(() => (
      <Pagination
        currentPage={() => 1}
        totalItems={() => 100}
        pageSize={25}
        hasNextPage={() => true}
        onPrevious={() => {}}
        onNext={onNext}
      />
    ));
    fireEvent.click(screen.getByText("Next"));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("hidden when items fit on one page", () => {
    const { container } = render(() => (
      <Pagination
        currentPage={() => 1}
        totalItems={() => 10}
        pageSize={25}
        hasNextPage={() => false}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    ));
    expect(container.querySelector(".pagination")).toBeNull();
  });

  it("both buttons disabled when loading", () => {
    render(() => (
      <Pagination
        currentPage={() => 2}
        totalItems={() => 100}
        pageSize={25}
        hasNextPage={() => true}
        isLoading={() => true}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    ));
    expect(screen.getByText("Previous").hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Next").hasAttribute("disabled")).toBe(true);
  });

  it("has navigation role and aria-label", () => {
    const { container } = render(() => (
      <Pagination
        currentPage={() => 1}
        totalItems={() => 100}
        pageSize={25}
        hasNextPage={() => true}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    ));
    const nav = container.querySelector("nav");
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute("role")).toBe("navigation");
    expect(nav?.getAttribute("aria-label")).toBe("Pagination");
  });

  it("buttons have descriptive aria-labels", () => {
    render(() => (
      <Pagination
        currentPage={() => 1}
        totalItems={() => 100}
        pageSize={25}
        hasNextPage={() => true}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    ));
    const prev = screen.getByText("Previous");
    const next = screen.getByText("Next");
    expect(prev.getAttribute("aria-label")).toBe("Go to previous page");
    expect(next.getAttribute("aria-label")).toBe("Go to next page");
  });

  it("handles currentPage 0 gracefully", () => {
    const { container } = render(() => (
      <Pagination
        currentPage={() => 0}
        totalItems={() => 100}
        pageSize={25}
        hasNextPage={() => true}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    ));
    // Exposes off-by-one: (0-1)*25+1 = -24, min(0*25, 100) = 0
    expect(container.textContent).toContain("Showing -24");
    expect(container.textContent).toContain("0");
    expect(container.textContent).toContain("100");
    // Previous button must remain disabled (currentPage <= 1)
    expect(screen.getByText("Previous").hasAttribute("disabled")).toBe(true);
  });

  it("handles pageSize of 0", () => {
    const { container } = render(() => (
      <Pagination
        currentPage={() => 1}
        totalItems={() => 100}
        pageSize={0}
        hasNextPage={() => true}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    ));
    // Exposes nonsensical range: (1-1)*0+1 = 1, min(1*0, 100) = 0
    expect(container.textContent).toContain("Showing 1");
    expect(container.textContent).toContain("0");
    expect(container.textContent).toContain("100");
  });

  it("hides pagination when pageSize exceeds totalItems", () => {
    // Boundary: when pageSize > totalItems, Show condition is false
    // so the nav is not rendered at all.
    const { container } = render(() => (
      <Pagination
        currentPage={() => 1}
        totalItems={() => 20}
        pageSize={50}
        hasNextPage={() => false}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    ));
    expect(container.querySelector(".pagination")).toBeNull();
    expect(container.textContent).not.toContain("Showing");
  });

  it("clamps end via Math.min when on last partial page", () => {
    // Explicitly tests Math.min clamping at line 15: end = min(page*size, total)
    // Page 2 of 15-per-page with 20 total → range 16-20 (clamped from 30 to 20).
    const { container } = render(() => (
      <Pagination
        currentPage={() => 2}
        totalItems={() => 20}
        pageSize={15}
        hasNextPage={() => false}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    ));
    expect(container.textContent).toContain("16");
    expect(container.textContent).toContain("20");
  });
});
