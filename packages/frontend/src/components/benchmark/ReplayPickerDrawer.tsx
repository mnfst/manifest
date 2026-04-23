import {
  createEffect,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
  type Component,
} from 'solid-js';
import { getMessages } from '../../services/api.js';
import type { MessageRow } from '../message-table-types.js';
import {
  formatCost,
  formatDuration,
  formatNumber,
  formatRelativeTime,
} from '../../services/formatters.js';
import { getModelDisplayName } from '../../services/model-display.js';
import { XIcon } from './icons.jsx';

interface Props {
  open: boolean;
  agentName: string;
  onClose: () => void;
  onSelect: (messageId: string) => void;
}

interface MessagesResponse {
  items: MessageRow[];
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

const ReplayPickerDrawer: Component<Props> = (props) => {
  const [search, setSearch] = createSignal('');

  const [recordings] = createResource(
    () => (props.open ? props.agentName : null),
    async (agentName): Promise<MessageRow[]> => {
      if (!agentName) return [];
      const data = (await getMessages({
        recorded: 'true',
        agent_name: agentName,
        limit: '50',
      })) as MessagesResponse;
      return data.items ?? [];
    },
  );

  const filtered = (): MessageRow[] => {
    const q = search().trim().toLowerCase();
    const all = recordings() ?? [];
    if (!q) return all;
    return all.filter((m) => {
      const model = (m.model ?? '').toLowerCase();
      const err = (m.error_message ?? '').toLowerCase();
      return model.includes(q) || err.includes(q);
    });
  };

  createEffect(() => {
    if (!props.open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        props.onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    onCleanup(() => window.removeEventListener('keydown', onKey));
  });

  return (
    <Show when={props.open}>
      <div class="benchmark-replay__backdrop" role="presentation" onClick={props.onClose} />
      <aside
        class="benchmark-replay benchmark-replay--open"
        role="dialog"
        aria-modal="true"
        aria-label="Re-run a recorded query"
      >
        <header class="benchmark-replay__header">
          <h2 class="benchmark-replay__title">Re-run a recorded query</h2>
          <button
            type="button"
            class="benchmark-replay__close"
            aria-label="Close recorded query picker"
            onClick={props.onClose}
          >
            <XIcon size={18} />
          </button>
        </header>

        <div class="benchmark-replay__search">
          <input
            type="search"
            class="benchmark-replay__search-input"
            placeholder="Filter by model or error…"
            value={search()}
            onInput={(event) => setSearch(event.currentTarget.value)}
            aria-label="Filter recorded messages"
          />
        </div>

        <Show when={recordings.loading}>
          <p class="benchmark-replay__empty">Loading…</p>
        </Show>
        <Show when={!recordings.loading && filtered().length === 0}>
          <p class="benchmark-replay__empty">
            No recorded messages yet. Enable message recording in Settings, run some traffic, then
            come back here to replay it.
          </p>
        </Show>

        <ul class="benchmark-replay__list">
          <For each={filtered()}>
            {(row) => (
              <li>
                <button
                  type="button"
                  class="benchmark-replay__item"
                  onClick={() => props.onSelect(row.id)}
                >
                  <span class="benchmark-replay__row-top">
                    <span class="benchmark-replay__model">
                      {row.model ? getModelDisplayName(row.model) : 'Unknown model'}
                    </span>
                    <span class="benchmark-replay__when">{formatRelativeTime(row.timestamp)}</span>
                  </span>
                  <span class="benchmark-replay__prompt">
                    {row.error_message ? truncate(row.error_message, 64) : row.status}
                  </span>
                  <span class="benchmark-replay__meta">
                    <span>{row.cost != null ? (formatCost(row.cost) ?? '—') : '—'}</span>
                    <span>·</span>
                    <span>
                      ↓{formatNumber(row.input_tokens ?? 0)} ↑{formatNumber(row.output_tokens ?? 0)}
                    </span>
                    <Show when={row.duration_ms != null}>
                      <span>·</span>
                      <span>{formatDuration(row.duration_ms ?? 0)}</span>
                    </Show>
                  </span>
                </button>
              </li>
            )}
          </For>
        </ul>
      </aside>
    </Show>
  );
};

export default ReplayPickerDrawer;
