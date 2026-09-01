import type { JSX } from 'solid-js';

interface SortableThProps<K extends string> {
  label: string;
  sortKey: K;
  activeKey: K | null;
  dir: 'asc' | 'desc';
  onSort: (key: K, dir: 'asc' | 'desc') => void;
  /** Default direction the first time this column is clicked. */
  defaultDir?: 'asc' | 'desc';
  style?: JSX.CSSProperties | string;
}

/** Table header cell that toggles a sort. Clicking the active column flips the direction. */
function SortableTh<K extends string>(props: SortableThProps<K>): JSX.Element {
  const active = () => props.activeKey === props.sortKey;
  const next = (): 'asc' | 'desc' => {
    if (!active()) return props.defaultDir ?? 'asc';
    return props.dir === 'asc' ? 'desc' : 'asc';
  };
  return (
    <th
      class="data-table__sortable"
      style={props.style}
      aria-sort={active() ? (props.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        class="sort-th"
        classList={{ 'sort-th--active': active() }}
        onClick={() => props.onSort(props.sortKey, next())}
      >
        {props.label}
        <span class="sort-th__arrow" aria-hidden="true">
          {active() ? (props.dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}

export default SortableTh;
