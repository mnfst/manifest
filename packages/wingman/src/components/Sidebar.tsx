import { createMemo, For, Show, type Component } from 'solid-js';
import { formatRelativeTime, type HistoryEntry } from '../services/history';

interface Props {
  entries: HistoryEntry[];
  activeId: string | null;
  onSelect: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onNewRequest: () => void;
}

interface Bucket {
  label: string;
  items: HistoryEntry[];
}

function bucketize(entries: HistoryEntry[]): Bucket[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const today: HistoryEntry[] = [];
  const yesterday: HistoryEntry[] = [];
  const week: HistoryEntry[] = [];
  const older: HistoryEntry[] = [];
  for (const e of entries) {
    const delta = now - e.timestamp;
    if (delta < day) today.push(e);
    else if (delta < 2 * day) yesterday.push(e);
    else if (delta < 7 * day) week.push(e);
    else older.push(e);
  }
  const buckets: Bucket[] = [];
  if (today.length) buckets.push({ label: 'Today', items: today });
  if (yesterday.length) buckets.push({ label: 'Yesterday', items: yesterday });
  if (week.length) buckets.push({ label: 'This week', items: week });
  if (older.length) buckets.push({ label: 'Older', items: older });
  return buckets;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '…';
}

const PlusIcon: Component = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const TrashIcon: Component = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

const Sidebar: Component<Props> = (props) => {
  const buckets = createMemo(() => bucketize(props.entries));

  return (
    <aside class="sidebar">
      <div class="sidebar__head">
        <button type="button" class="sidebar__new" onClick={props.onNewRequest}>
          <PlusIcon />
          <span>New request</span>
        </button>
        <Show when={props.entries.length > 0}>
          <button
            type="button"
            class="sidebar__clear"
            onClick={props.onClear}
            title="Clear all history"
            aria-label="Clear all history"
          >
            <TrashIcon />
          </button>
        </Show>
      </div>

      <div class="sidebar__history">
        <Show
          when={props.entries.length > 0}
          fallback={
            <div class="sidebar__empty">
              <p>No requests yet.</p>
              <p class="sidebar__empty-hint">
                Each send is saved here so you can compare and replay them.
              </p>
            </div>
          }
        >
          <For each={buckets()}>
            {(bucket) => (
              <div class="sidebar__bucket">
                <h3 class="sidebar__bucket-title">{bucket.label}</h3>
                <ol class="sidebar__list">
                  <For each={bucket.items}>
                    {(entry) => (
                      <li
                        class="sidebar__item"
                        classList={{ 'sidebar__item--active': entry.id === props.activeId }}
                      >
                        <button
                          type="button"
                          class="sidebar__item-main"
                          onClick={() => props.onSelect(entry)}
                          title={`Replay this request from ${formatRelativeTime(entry.timestamp)}`}
                        >
                          <span
                            class="sidebar__item-status"
                            classList={{
                              'sidebar__item-status--ok': entry.ok,
                              'sidebar__item-status--warn':
                                !entry.ok && entry.status >= 400 && entry.status < 500,
                              'sidebar__item-status--err':
                                !entry.ok && (entry.status === 0 || entry.status >= 500),
                            }}
                            aria-hidden="true"
                          />
                          <span class="sidebar__item-body">
                            <span class="sidebar__item-line">
                              <span class="sidebar__item-profile">{entry.profileLabel}</span>
                              <span class="sidebar__item-time">
                                {formatRelativeTime(entry.timestamp)}
                              </span>
                            </span>
                            <span class="sidebar__item-msg">
                              {truncate(entry.userMessage || '(empty)', 56)}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          class="sidebar__item-del"
                          onClick={(e) => {
                            e.stopPropagation();
                            props.onDelete(entry.id);
                          }}
                          aria-label="Delete this entry"
                          title="Delete"
                        >
                          <TrashIcon />
                        </button>
                      </li>
                    )}
                  </For>
                </ol>
              </div>
            )}
          </For>
        </Show>
      </div>
    </aside>
  );
};

export default Sidebar;
