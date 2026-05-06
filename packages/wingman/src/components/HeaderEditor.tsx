import { For, type Component } from 'solid-js';

export interface HeaderEntry {
  key: string;
  value: string;
}

interface Props {
  entries: HeaderEntry[];
  onChange: (entries: HeaderEntry[]) => void;
  blocked: string[];
}

const HeaderEditor: Component<Props> = (props) => {
  const setEntry = (idx: number, patch: Partial<HeaderEntry>) => {
    const next = props.entries.map((entry, i) => (i === idx ? { ...entry, ...patch } : entry));
    props.onChange(next);
  };

  const remove = (idx: number) => {
    props.onChange(props.entries.filter((_, i) => i !== idx));
  };

  const add = () => {
    props.onChange([...props.entries, { key: '', value: '' }]);
  };

  const isBlocked = (key: string) =>
    props.blocked.some((b) => b.toLowerCase() === key.toLowerCase());

  return (
    <div class="header-editor">
      <div class="header-editor__rows">
        <For each={props.entries}>
          {(entry, idx) => (
            <div
              class="header-editor__row"
              classList={{ 'header-editor__row--blocked': isBlocked(entry.key) }}
            >
              <input
                class="header-editor__input"
                type="text"
                placeholder="Header name"
                value={entry.key}
                onInput={(e) => setEntry(idx(), { key: e.currentTarget.value })}
                spellcheck={false}
                autocomplete="off"
              />
              <input
                class="header-editor__input header-editor__input--value"
                type="text"
                placeholder="Value"
                value={entry.value}
                onInput={(e) => setEntry(idx(), { value: e.currentTarget.value })}
                spellcheck={false}
                autocomplete="off"
              />
              <button
                type="button"
                class="header-editor__remove"
                onClick={() => remove(idx())}
                aria-label={`Remove header ${entry.key || 'row ' + (idx() + 1)}`}
                title="Remove"
              >
                ×
              </button>
            </div>
          )}
        </For>
      </div>
      <button type="button" class="header-editor__add" onClick={add}>
        + Add header
      </button>
      {props.blocked.length > 0 && (
        <p class="header-editor__warning">
          Browsers don't let JavaScript override these headers in fetch:{' '}
          <code>{props.blocked.join(', ')}</code>. The actual request goes out without them — useful
          for testing what Manifest does with the SDK fingerprint when the User-Agent is missing.
        </p>
      )}
    </div>
  );
};

export default HeaderEditor;
