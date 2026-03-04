import { createSignal, createMemo, type Accessor } from 'solid-js';

export interface ClientPagination<T> {
  currentPage: Accessor<number>;
  pageItems: Accessor<T[]>;
  totalItems: Accessor<number>;
  totalPages: Accessor<number>;
  hasNextPage: Accessor<boolean>;
  previousPage: () => void;
  nextPage: () => void;
  resetPage: () => void;
  pageSize: number;
}

export function createClientPagination<T>(
  items: Accessor<T[]>,
  pageSize = 25,
): ClientPagination<T> {
  const [rawPage, setRawPage] = createSignal(1);

  const totalItems = createMemo(() => items().length);
  const totalPages = createMemo(() => Math.max(1, Math.ceil(totalItems() / pageSize)));

  const safePage = createMemo(() => {
    const p = rawPage();
    const max = totalPages();
    return Math.min(Math.max(1, p), max);
  });

  const pageItems = createMemo(() => {
    const start = (safePage() - 1) * pageSize;
    return items().slice(start, start + pageSize);
  });

  const hasNextPage = createMemo(() => safePage() < totalPages());

  return {
    currentPage: safePage,
    pageItems,
    totalItems,
    totalPages,
    hasNextPage,
    previousPage: () => setRawPage((p) => Math.max(1, p - 1)),
    nextPage: () => setRawPage((p) => (p < totalPages() ? p + 1 : p)),
    resetPage: () => setRawPage(1),
    pageSize,
  };
}
