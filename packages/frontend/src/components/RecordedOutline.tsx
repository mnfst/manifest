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

function CheckIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M9 15.59 4.71 11.3 3.3 12.71l5 5c.2.2.45.29.71.29s.51-.1.71-.29l11-11-1.41-1.41L9.02 15.59Z" />
    </svg>
  );
}

function RoleChip(props: { role: Role; active: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      class="recorded-modal__rail-filter"
      classList={{ 'recorded-modal__rail-filter--active': props.active }}
      onClick={props.onClick}
      aria-pressed={props.active}
      data-role={props.role}
    >
      <span>{props.role.charAt(0).toUpperCase() + props.role.slice(1)}</span>
      <span
        class="recorded-modal__rail-filter-check"
        style={props.active ? undefined : 'opacity: 0;'}
      >
        <CheckIcon />
      </span>
    </button>
  );
}

const RecordedOutline: Component<Props> = (props) => {
  const allRoles: Role[] = ['user', 'assistant', 'system', 'tool'];
  const filtered = () => props.rows.filter((r) => props.visibleRoles.has(r.role));

  return (
    <aside class="recorded-modal__rail" aria-label="Conversation outline">
      <div class="recorded-modal__rail-search">
        <div class="recorded-modal__rail-search-wrap">
          <input
            type="search"
            id="recorded-drawer-search"
            class="recorded-modal__rail-input"
            placeholder="Search conversation"
            value={props.searchQuery}
            onInput={(e) => props.onSearch(e.currentTarget.value)}
            aria-label="Search conversation"
          />
          <kbd class="recorded-modal__rail-kbd">/</kbd>
        </div>
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
          title="First user message"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M4 4h16v2H4zm8 4-5 6h4v7h2v-7h4z" />
          </svg>
          First user
        </button>
        <button
          type="button"
          class="recorded-modal__rail-jump"
          onClick={props.onJumpLastUser}
          title="Last user message"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M4 4h16v2H4zm7 4v7H7l5 6 5-6h-4V8z" />
          </svg>
          Last user
        </button>
        <button
          type="button"
          class="recorded-modal__rail-jump"
          onClick={props.onJumpLastAssistant}
          title="Last assistant reply"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M4 4h16v2H4zm7 4v7H7l5 6 5-6h-4V8z" />
          </svg>
          Last assistant
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
