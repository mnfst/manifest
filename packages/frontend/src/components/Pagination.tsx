import { Show, type Component, type Accessor } from 'solid-js';
import { t } from '../i18n/index.js';

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
      <nav class="pagination" role="navigation" aria-label={t('pagination.aria')}>
        <span class="pagination__summary">
          {t('pagination.summary', { start: start(), end: end(), total: props.totalItems() })}
        </span>
        <div class="pagination__controls">
          <button
            class="btn btn--outline btn--sm pagination__btn"
            disabled={props.currentPage() <= 1 || loading()}
            onClick={props.onPrevious}
            aria-label={t('pagination.previousAria')}
          >
            {t('pagination.previous')}
          </button>
          <button
            class="btn btn--outline btn--sm pagination__btn"
            disabled={!props.hasNextPage() || loading()}
            onClick={props.onNext}
            aria-label={t('pagination.nextAria')}
          >
            {t('pagination.next')}
          </button>
        </div>
      </nav>
    </Show>
  );
};

export default Pagination;
