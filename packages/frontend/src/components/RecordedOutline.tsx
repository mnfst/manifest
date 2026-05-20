import { For, Show, type Component, type JSX } from 'solid-js';
import { MAX_COUNTED_MATCHES, type Role } from './recorded-message-helpers.js';

export interface OutlineRow {
  index: number;
  role: Role;
  roleLabel: string;
  preview: string;
  tokens: number;
  matchCount?: number;
}

interface Props {
  rows: OutlineRow[];
  activeIndex: number | null;
  visibleRoles: ReadonlySet<Role>;
  searchQuery: string;
  onSearch: (query: string) => void;
  onJump: (index: number) => void;
  onToggleRole: (role: Role) => void;
  onJumpLastUser: () => void;
  onJumpLastAssistant: () => void;
  onJumpFirstUser: () => void;
}

function RoleChip(props: { role: Role; active: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      class="recorded-modal__rail-filter"
      classList={{ 'recorded-modal__rail-filter--active': props.active }}
      onClick={props.onClick}
      aria-pressed={props.active}
    >
      {props.role}
    </button>
  );
}

const RecordedOutline: Component<Props> = (props) => {
  const allRoles: Role[] = ['user', 'assistant', 'system', 'tool'];
  const filtered = () => props.rows.filter((r) => props.visibleRoles.has(r.role));

  return (
    <aside class="recorded-modal__rail" aria-label="Conversation outline">
      <div class="recorded-modal__rail-search">
        <input
          type="search"
          id="recorded-drawer-search"
          class="recorded-modal__rail-input"
          placeholder="Search conversation"
          value={props.searchQuery}
          onInput={(e) => props.onSearch(e.currentTarget.value)}
          aria-label="Search conversation"
        />
      </div>
      <div class="recorded-modal__rail-filters" role="group" aria-label="Filter by role">
        <For each={allRoles}>
          {(role) => (
            <RoleChip
              role={role}
              active={props.visibleRoles.has(role)}
              onClick={() => props.onToggleRole(role)}
            />
          )}
        </For>
      </div>
      <div class="recorded-modal__rail-jumps">
        <button
          type="button"
          class="recorded-modal__rail-jump"
          onClick={props.onJumpFirstUser}
          title="Jump to first user message"
        >
          ⤒ First user
        </button>
        <button
          type="button"
          class="recorded-modal__rail-jump"
          onClick={props.onJumpLastUser}
          title="Jump to last user message"
        >
          ⤓ Last user
        </button>
        <button
          type="button"
          class="recorded-modal__rail-jump"
          onClick={props.onJumpLastAssistant}
          title="Jump to last assistant reply"
        >
          ⤓ Last assistant
        </button>
      </div>
      <ol class="recorded-modal__outline" role="list">
        <For each={filtered()}>
          {(row) => (
            <li>
              <button
                type="button"
                class="recorded-modal__outline-row"
                classList={{
                  'recorded-modal__outline-row--active': props.activeIndex === row.index,
                }}
                data-role={row.roleLabel}
                onClick={() => props.onJump(row.index)}
                aria-current={props.activeIndex === row.index ? 'true' : undefined}
              >
                <span class={`recorded-modal__role recorded-modal__role--${row.roleLabel}`}>
                  {row.roleLabel}
                </span>
                <span class="recorded-modal__outline-index">#{row.index + 1}</span>
                <span class="recorded-modal__outline-preview">{row.preview}</span>
                <span class="recorded-modal__outline-tok">
                  {row.tokens >= 1000 ? `${(row.tokens / 1000).toFixed(1)}k` : row.tokens}
                </span>
                <Show when={(row.matchCount ?? 0) > 0}>
                  <span
                    class="recorded-modal__outline-match"
                    aria-label={
                      (row.matchCount ?? 0) >= MAX_COUNTED_MATCHES
                        ? `More than ${MAX_COUNTED_MATCHES} matches`
                        : `${row.matchCount} matches`
                    }
                  >
                    {(row.matchCount ?? 0) >= MAX_COUNTED_MATCHES
                      ? `${MAX_COUNTED_MATCHES}+`
                      : row.matchCount}
                  </span>
                </Show>
              </button>
            </li>
          )}
        </For>
        <Show when={filtered().length === 0}>
          <li class="recorded-modal__outline-empty">No turns match the current filter.</li>
        </Show>
      </ol>
    </aside>
  );
};

export default RecordedOutline;
