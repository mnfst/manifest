import { For, Show, createEffect, createSignal, onCleanup, type Component } from 'solid-js';
import { useFocusTrap } from '../../services/use-focus-trap.js';
import { PlusIcon, TrashIcon, XIcon } from './icons.jsx';
import { t } from '../../i18n/index.js';

export interface HeaderEntry {
  id: string;
  key: string;
  value: string;
}

interface Props {
  open: boolean;
  entries: HeaderEntry[];
  onChange: (entries: HeaderEntry[]) => void;
  onClose: () => void;
}

const BLOCKED_EXACT = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'host',
  'content-length',
  'content-type',
  'connection',
  'transfer-encoding',
  'upgrade',
  'te',
  'trailer',
]);

export function isBlockedHeaderKey(key: string): boolean {
  const lower = key.trim().toLowerCase();
  if (!lower) return false;
  if (BLOCKED_EXACT.has(lower)) return true;
  return lower.startsWith('x-manifest-');
}

export function toHeaderRecord(entries: HeaderEntry[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of entries) {
    const key = e.key.trim();
    if (!key || isBlockedHeaderKey(key)) continue;
    if (!e.value) continue;
    out[key] = e.value;
  }
  return out;
}

let nextId = 1;
export function blankEntry(): HeaderEntry {
  return { id: `h-${++nextId}-${Date.now().toString(36)}`, key: '', value: '' };
}

const RequestHeadersPopover: Component<Props> = (props) => {
  const [panelRef, setPanelRef] = createSignal<HTMLElement | undefined>();

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

  useFocusTrap(
    () => props.open,
    () => panelRef(),
  );

  const update = (id: string, patch: Partial<HeaderEntry>) => {
    props.onChange(props.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };
  const remove = (id: string) => {
    props.onChange(props.entries.filter((e) => e.id !== id));
  };
  const add = () => {
    props.onChange([...props.entries, blankEntry()]);
  };
  const clearAll = () => props.onChange([]);

  return (
    <Show when={props.open}>
      <div class="playground-headers__backdrop" role="presentation" onClick={props.onClose} />
      <div
        ref={setPanelRef}
        class="playground-headers"
        role="dialog"
        aria-modal="true"
        aria-label={t('playground.requestHeaders')}
      >
        <header class="playground-headers__header">
          <h3 class="playground-headers__title">{t('playground.requestHeaders')}</h3>
          <button
            type="button"
            class="playground-headers__close"
            aria-label={t('playground.closeRequestHeaders')}
            onClick={props.onClose}
          >
            <XIcon size={16} />
          </button>
        </header>

        <p class="playground-headers__hint">{t('playground.headersHint')}</p>

        <Show when={props.entries.length === 0}>
          <p class="playground-headers__empty">{t('playground.noHeaders')}</p>
        </Show>

        <div class="playground-headers__rows">
          <For each={props.entries}>
            {(entry) => {
              const blocked = () => isBlockedHeaderKey(entry.key);
              return (
                <div
                  class="playground-headers__row"
                  classList={{ 'playground-headers__row--blocked': blocked() }}
                >
                  <input
                    type="text"
                    class="playground-headers__input playground-headers__input--key"
                    placeholder={t('playground.header')}
                    value={entry.key}
                    aria-label={t('playground.headerName')}
                    spellcheck={false}
                    autocomplete="off"
                    onInput={(e) => update(entry.id, { key: e.currentTarget.value })}
                  />
                  <input
                    type="text"
                    class="playground-headers__input playground-headers__input--value"
                    placeholder={t('playground.value')}
                    value={entry.value}
                    aria-label={t('playground.headerValue')}
                    spellcheck={false}
                    autocomplete="off"
                    onInput={(e) => update(entry.id, { value: e.currentTarget.value })}
                  />
                  <button
                    type="button"
                    class="playground-headers__remove"
                    aria-label={t('playground.removeHeader', {
                      header: entry.key || t('playground.headerLower'),
                    })}
                    onClick={() => remove(entry.id)}
                  >
                    <TrashIcon size={14} />
                  </button>
                  <Show when={blocked()}>
                    <p class="playground-headers__warning">
                      {t('playground.managedHeader', { header: entry.key.trim() })}
                    </p>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>

        <footer class="playground-headers__footer">
          <button type="button" class="playground-headers__add" onClick={add}>
            <PlusIcon size={14} /> {t('playground.addHeader')}
          </button>
          <Show when={props.entries.length > 0}>
            <button type="button" class="playground-headers__clear" onClick={clearAll}>
              {t('playground.clearAll')}
            </button>
          </Show>
        </footer>
      </div>
    </Show>
  );
};

export default RequestHeadersPopover;
