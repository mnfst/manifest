import { Show, type Component, type Accessor } from 'solid-js';

export interface PaginationProps {
  currentPage: Accessor<number>;
  totalItems: Accessor<number>;
  pageSize: number;
  hasNextPage: Accessor<boolean>;
  isLoading?: Accessor<boolean>;
  onPrevious: () => void;
  onNext: () => void;
}

const Pagination: Component<PaginationProps> = (props) => {
  const start = () => (props.currentPage() - 1) * props.pageSize + 1;
  const end = () => Math.min(props.currentPage() * props.pageSize, props.totalItems());
  const loading = () => props.isLoading?.() ?? false;

  return (
    <Show when={props.totalItems() > props.pageSize}>
      <nav class="pagination" role="navigation" aria-label="Pagination">
        <span class="pagination__summary">
          Showing {start()}&ndash;{end()} of {props.totalItems()}
        </span>
        <div class="pagination__controls">
          <button
            class="btn btn--outline btn--sm pagination__btn"
            disabled={props.currentPage() <= 1 || loading()}
            onClick={props.onPrevious}
            aria-label="Go to previous page"
          >
            Previous
          </button>
          <button
            class="btn btn--outline btn--sm pagination__btn"
            disabled={!props.hasNextPage() || loading()}
            onClick={props.onNext}
            aria-label="Go to next page"
          >
            Next
          </button>
        </div>
      </nav>
    </Show>
  );
};

export default Pagination;
