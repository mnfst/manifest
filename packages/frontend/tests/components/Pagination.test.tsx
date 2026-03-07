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
    expect(onPrevious).toHaveBeenCalled();
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
    expect(onNext).toHaveBeenCalled();
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
});
