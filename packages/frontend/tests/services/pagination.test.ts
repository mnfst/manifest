import { describe, it, expect } from "vitest";
import { createRoot, createSignal } from "solid-js";
import { createClientPagination } from "../../src/services/pagination";

function withRoot<T>(fn: () => T): T {
  let result!: T;
  createRoot((dispose) => {
    result = fn();
    dispose();
  });
  return result;
}

describe("createClientPagination", () => {
  it("returns first page items", () => {
    withRoot(() => {
      const [items] = createSignal([1, 2, 3, 4, 5]);
      const pager = createClientPagination(items, 3);
      expect(pager.pageItems()).toEqual([1, 2, 3]);
      expect(pager.currentPage()).toBe(1);
      expect(pager.totalItems()).toBe(5);
      expect(pager.totalPages()).toBe(2);
      expect(pager.hasNextPage()).toBe(true);
    });
  });

  it("navigates to next page", () => {
    withRoot(() => {
      const [items] = createSignal([1, 2, 3, 4, 5]);
      const pager = createClientPagination(items, 3);
      pager.nextPage();
      expect(pager.currentPage()).toBe(2);
      expect(pager.pageItems()).toEqual([4, 5]);
      expect(pager.hasNextPage()).toBe(false);
    });
  });

  it("navigates back with previousPage", () => {
    withRoot(() => {
      const [items] = createSignal([1, 2, 3, 4, 5]);
      const pager = createClientPagination(items, 3);
      pager.nextPage();
      pager.previousPage();
      expect(pager.currentPage()).toBe(1);
      expect(pager.pageItems()).toEqual([1, 2, 3]);
    });
  });

  it("previousPage is no-op on page 1", () => {
    withRoot(() => {
      const [items] = createSignal([1, 2, 3]);
      const pager = createClientPagination(items, 2);
      pager.previousPage();
      expect(pager.currentPage()).toBe(1);
    });
  });

  it("nextPage is no-op on last page", () => {
    withRoot(() => {
      const [items] = createSignal([1, 2, 3]);
      const pager = createClientPagination(items, 3);
      pager.nextPage();
      expect(pager.currentPage()).toBe(1);
    });
  });

  it("clamps page when list shrinks", () => {
    withRoot(() => {
      const [items, setItems] = createSignal([1, 2, 3, 4, 5, 6]);
      const pager = createClientPagination(items, 3);
      pager.nextPage();
      expect(pager.currentPage()).toBe(2);
      setItems([1, 2]);
      expect(pager.currentPage()).toBe(1);
      expect(pager.pageItems()).toEqual([1, 2]);
    });
  });

  it("resetPage returns to page 1", () => {
    withRoot(() => {
      const [items] = createSignal([1, 2, 3, 4, 5]);
      const pager = createClientPagination(items, 2);
      pager.nextPage();
      pager.nextPage();
      expect(pager.currentPage()).toBe(3);
      pager.resetPage();
      expect(pager.currentPage()).toBe(1);
    });
  });

  it("handles empty input", () => {
    withRoot(() => {
      const [items] = createSignal<number[]>([]);
      const pager = createClientPagination(items, 5);
      expect(pager.currentPage()).toBe(1);
      expect(pager.totalPages()).toBe(1);
      expect(pager.totalItems()).toBe(0);
      expect(pager.pageItems()).toEqual([]);
      expect(pager.hasNextPage()).toBe(false);
    });
  });

  it("handles partial last page", () => {
    withRoot(() => {
      const [items] = createSignal([1, 2, 3, 4]);
      const pager = createClientPagination(items, 3);
      expect(pager.totalPages()).toBe(2);
      pager.nextPage();
      expect(pager.pageItems()).toEqual([4]);
    });
  });

  it("uses default page size of 25", () => {
    withRoot(() => {
      const [items] = createSignal(Array.from({ length: 60 }, (_, i) => i));
      const pager = createClientPagination(items);
      expect(pager.pageSize).toBe(25);
      expect(pager.pageItems().length).toBe(25);
      expect(pager.totalPages()).toBe(3);
    });
  });
});
