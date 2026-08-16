import { createEffect, createSignal, For, onCleanup, Show, type Component } from 'solid-js';
import type { RoutingProvider } from '../services/api.js';
import { KEY_LABEL_ROTATION } from 'manifest-shared';

interface RouteKeyChipProps {
  keys: RoutingProvider[];
  currentLabel?: string | null;
  modelLabel: string;
  usedLabels?: () => Set<string>;
  onPick: (label: string | null) => void | Promise<void>;
  buttonClass: string;
  disabled?: boolean;
  allowClear?: boolean;
  leadingMargin?: boolean;
  menuMinWidth?: number;
  stopPropagation?: boolean;
}

const RouteKeyChip: Component<RouteKeyChipProps> = (props) => {
  const [open, setOpen] = createSignal(false);
  let containerRef: HTMLSpanElement | undefined;

  createEffect(() => {
    if (!open()) return;
    const handler = (e: MouseEvent) => {
      if (containerRef && !containerRef.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    onCleanup(() => document.removeEventListener('mousedown', handler));
  });

  const stop = (event: Event) => {
    if (props.stopPropagation) event.stopPropagation();
  };
  const displayLabel = () =>
    props.currentLabel === KEY_LABEL_ROTATION
      ? 'Rotation'
      : (props.currentLabel ?? props.keys[0]?.label ?? '');
  const tooltipLabel = () =>
    props.currentLabel === KEY_LABEL_ROTATION ? 'Rotation — use key order rule' : displayLabel();
  const usedLabels = () => props.usedLabels?.() ?? new Set<string>();
  const buttonStyle = () =>
    `background: hsl(var(--muted) / 0.5); border: 1px solid hsl(var(--border)); border-radius: 999px; padding: 2px 8px; font-size: var(--font-size-xs); color: hsl(var(--muted-foreground)); cursor: pointer; max-width: 96px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-flex; align-items: center; gap: 3px;${props.leadingMargin ? ' margin-left: 4px;' : ''}`;
  const menuStyle = () =>
    `position: absolute; top: 100%; right: 0; margin-top: 4px; list-style: none; padding: 4px; min-width: ${props.menuMinWidth ?? 160}px; border: 1px solid hsl(var(--border)); border-radius: 6px; background: hsl(var(--background)); box-shadow: 0 4px 12px hsl(var(--foreground) / 0.08); z-index: 10; display: flex; flex-direction: column; gap: 2px;`;

  return (
    <span ref={containerRef} style="position: relative; display: inline-flex; flex-shrink: 0;">
      <button
        type="button"
        class={props.buttonClass}
        aria-haspopup="listbox"
        aria-expanded={open()}
        aria-label={`API key for ${props.modelLabel}: currently ${tooltipLabel()}. Click to change.`}
        title={tooltipLabel()}
        disabled={props.disabled}
        onClick={(event) => {
          stop(event);
          setOpen(!open());
        }}
        style={buttonStyle()}
      >
        <span style="overflow: hidden; text-overflow: ellipsis;">{displayLabel()}</span>
        <span aria-hidden="true">▾</span>
      </button>
      <Show when={open()}>
        <ul role="listbox" aria-label="Choose API key" onClick={stop} style={menuStyle()}>
          <Show when={props.allowClear && props.currentLabel}>
            <li>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={(event) => {
                  stop(event);
                  setOpen(false);
                  void props.onPick(null);
                }}
                style="width: 100%; text-align: left; background: none; border: none; padding: 4px 6px; cursor: pointer; border-radius: 4px; font-size: var(--font-size-xs); color: hsl(var(--muted-foreground)); border-bottom: 1px solid hsl(var(--border)); margin-bottom: 2px; padding-bottom: 6px;"
              >
                Clear pin
              </button>
            </li>
          </Show>
          <li>
            <button
              type="button"
              role="option"
              aria-selected={props.currentLabel === KEY_LABEL_ROTATION}
              onClick={(event) => {
                stop(event);
                setOpen(false);
                if (props.currentLabel !== KEY_LABEL_ROTATION) {
                  void props.onPick(KEY_LABEL_ROTATION);
                }
              }}
              style="width: 100%; text-align: left; background: none; border: none; padding: 4px 6px; cursor: pointer; border-radius: 4px; font-size: var(--font-size-xs); color: hsl(var(--foreground)); display: flex; align-items: center; gap: 6px;"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="8"
                height="8"
                fill="currentColor"
                viewBox="0 0 24 24"
                style={`visibility: ${props.currentLabel === KEY_LABEL_ROTATION ? 'visible' : 'hidden'}`}
              >
                <path d="M12 5a7 7 0 1 0 0 14 7 7 0 1 0 0-14" />
              </svg>
              Rotation
              <span style="color: hsl(var(--muted-foreground)); font-size: 10px;">
                Use key order rule
              </span>
            </button>
          </li>
          <For each={props.keys}>
            {(key) => {
              const isUsedElsewhere = () => usedLabels().has(key.label.toLowerCase());
              const isSelected = () =>
                props.currentLabel
                  ? props.currentLabel !== KEY_LABEL_ROTATION &&
                    props.currentLabel.toLowerCase() === key.label.toLowerCase()
                  : displayLabel().toLowerCase() === key.label.toLowerCase();
              const shouldPick = () =>
                (props.currentLabel ?? '').toLowerCase() !== key.label.toLowerCase();
              return (
                <li>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected()}
                    disabled={props.disabled || isUsedElsewhere()}
                    onClick={(event) => {
                      stop(event);
                      setOpen(false);
                      if (shouldPick()) {
                        void props.onPick(key.label);
                      }
                    }}
                    style={`width: 100%; text-align: left; background: none; border: none; padding: 4px 6px; cursor: pointer; border-radius: 4px; font-size: var(--font-size-xs); color: hsl(var(--foreground)); display: flex; align-items: center; gap: 6px;${isUsedElsewhere() ? ' opacity: 0.4; cursor: not-allowed;' : ''}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="8"
                      height="8"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      style={`visibility: ${isSelected() ? 'visible' : 'hidden'}`}
                    >
                      <path d="M12 5a7 7 0 1 0 0 14 7 7 0 1 0 0-14" />
                    </svg>
                    {key.label}
                  </button>
                </li>
              );
            }}
          </For>
        </ul>
      </Show>
    </span>
  );
};

export default RouteKeyChip;
