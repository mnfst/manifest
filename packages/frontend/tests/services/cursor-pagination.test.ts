import { describe, it, expect } from "vitest";
import { createRoot } from "solid-js";
import { createCursorPagination } from "../../src/services/cursor-pagination";

function withRoot<T>(fn: () => T): T {
  let result!: T;
  createRoot((dispose) => {
    result = fn();
    dispose();
  });
  return result;
}

describe("createCursorPagination", () => {
  it("starts on page 1 with no cursor", () => {
    withRoot(() => {
      const pager = createCursorPagination(50);
      expect(pager.currentPage()).toBe(1);
      expect(pager.currentCursor()).toBeUndefined();
      expect(pager.hasNextPage()).toBe(false);
      expect(pager.pageSize).toBe(50);
    });
  });

  it("enables next after recordResponse with cursor", () => {
    withRoot(() => {
      const pager = createCursorPagination(50);
      pager.recordResponse("cursor-page-2");
      expect(pager.hasNextPage()).toBe(true);
    });
  });

  it("does not enable next when recordResponse receives null", () => {
    withRoot(() => {
      const pager = createCursorPagination(50);
      pager.recordResponse(null);
      expect(pager.hasNextPage()).toBe(false);
    });
  });

  it("navigates to next page with correct cursor", () => {
    withRoot(() => {
      const pager = createCursorPagination(50);
      pager.recordResponse("cursor-page-2");
      pager.nextPage();
      expect(pager.currentPage()).toBe(2);
      expect(pager.currentCursor()).toBe("cursor-page-2");
    });
  });

  it("navigates back to previous page", () => {
    withRoot(() => {
      const pager = createCursorPagination(50);
      pager.recordResponse("cursor-page-2");
      pager.nextPage();
      pager.previousPage();
      expect(pager.currentPage()).toBe(1);
      expect(pager.currentCursor()).toBeUndefined();
    });
  });

  it("cursor history works across multiple pages", () => {
    withRoot(() => {
      const pager = createCursorPagination(10);
      pager.recordResponse("cursor-2");
      pager.nextPage();
      pager.recordResponse("cursor-3");
      pager.nextPage();
      expect(pager.currentPage()).toBe(3);
      expect(pager.currentCursor()).toBe("cursor-3");
      pager.previousPage();
      expect(pager.currentPage()).toBe(2);
      expect(pager.currentCursor()).toBe("cursor-2");
      pager.previousPage();
      expect(pager.currentPage()).toBe(1);
      expect(pager.currentCursor()).toBeUndefined();
    });
  });

  it("previousPage is no-op on page 1", () => {
    withRoot(() => {
      const pager = createCursorPagination(50);
      pager.previousPage();
      expect(pager.currentPage()).toBe(1);
    });
  });

  it("nextPage is no-op when no next cursor", () => {
    withRoot(() => {
      const pager = createCursorPagination(50);
      pager.nextPage();
      expect(pager.currentPage()).toBe(1);
    });
  });

  it("resetPage clears all state", () => {
    withRoot(() => {
      const pager = createCursorPagination(50);
      pager.recordResponse("cursor-2");
      pager.nextPage();
      pager.recordResponse("cursor-3");
      pager.nextPage();
      pager.resetPage();
      expect(pager.currentPage()).toBe(1);
      expect(pager.currentCursor()).toBeUndefined();
      expect(pager.hasNextPage()).toBe(false);
    });
  });

  it("uses default page size of 50", () => {
    withRoot(() => {
      const pager = createCursorPagination();
      expect(pager.pageSize).toBe(50);
    });
  });
});
