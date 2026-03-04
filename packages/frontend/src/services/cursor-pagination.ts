import { createSignal, createMemo, type Accessor } from 'solid-js';

export interface CursorPagination {
  currentPage: Accessor<number>;
  currentCursor: Accessor<string | undefined>;
  hasNextPage: Accessor<boolean>;
  previousPage: () => void;
  nextPage: () => void;
  recordResponse: (nextCursor: string | null | undefined) => void;
  resetPage: () => void;
  pageSize: number;
}

export function createCursorPagination(pageSize = 50): CursorPagination {
  const [cursorStack, setCursorStack] = createSignal<(string | undefined)[]>([undefined]);
  const [pageIndex, setPageIndex] = createSignal(0);
  const [nextCursorAvailable, setNextCursorAvailable] = createSignal(false);

  const currentPage = createMemo(() => pageIndex() + 1);
  const currentCursor = createMemo(() => cursorStack()[pageIndex()]);
  const hasNextPage = createMemo(() => nextCursorAvailable());

  function recordResponse(nextCursor: string | null | undefined) {
    if (nextCursor) {
      setNextCursorAvailable(true);
      setCursorStack((stack) => {
        const nextIdx = pageIndex() + 1;
        const copy = [...stack];
        copy[nextIdx] = nextCursor;
        return copy;
      });
    } else {
      setNextCursorAvailable(false);
    }
  }

  function nextPage() {
    if (!nextCursorAvailable()) return;
    setPageIndex((i) => i + 1);
  }

  function previousPage() {
    if (pageIndex() <= 0) return;
    setPageIndex((i) => i - 1);
  }

  function resetPage() {
    setCursorStack([undefined]);
    setPageIndex(0);
    setNextCursorAvailable(false);
  }

  return {
    currentPage,
    currentCursor,
    hasNextPage,
    previousPage,
    nextPage,
    recordResponse,
    resetPage,
    pageSize,
  };
}
