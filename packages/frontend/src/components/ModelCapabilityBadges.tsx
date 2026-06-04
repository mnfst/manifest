import { For, Show, type Component } from 'solid-js';
import type { ModelCapability, ModelModality } from '../services/api.js';

interface Props {
  capabilities?: readonly ModelCapability[];
  compact?: boolean;
  iconOnly?: boolean;
}

export const CAPABILITY_LABELS: Record<ModelCapability, string> = {
  text: 'Text',
  image: 'Image',
  audio: 'Audio',
  video: 'Video',
  stream: 'Stream',
  tools: 'Tools',
};

export const CAPABILITY_ICONS: Record<ModelCapability, string> = {
  text: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M4 4c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2zm2 0v16h12V4zm2 4h8v2H8zm0 4h8v2H8zm0 4h5v2H8z"/></svg>',
  video:
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M18 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4.33L22 17V7l-4 3.33zm-2 12H4V6h12z"/></svg>',
  image:
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="m5 17.41 3-3 1.29 1.29c.39.39 1.02.39 1.41 0l5.29-5.29 3 3V14h2V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H5zM19 5v5.59L16.71 8.3a.996.996 0 0 0-1.41 0l-5.29 5.29-1.29-1.29a.996.996 0 0 0-1.41 0l-2.29 2.29V5h14Z"/><path d="M8.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3m13.22 11.07-1.94-.86-.86-1.94a.46.46 0 0 0-.42-.28c-.19-.02-.35.1-.43.27l-.86 1.87-1.95.94c-.16.08-.27.25-.26.43 0 .18.11.35.28.42l1.94.86.86 1.94a.471.471 0 0 0 .86 0l.86-1.94 1.94-.86a.471.471 0 0 0 0-.86Z"/></svg>',
  stream:
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c-1.1 0-2 .9-2 2 0 .85.53 1.57 1.28 1.86l-.53 10.13h2.5l-.53-10.13C13.47 11.57 14 10.85 14 10c0-1.1-.9-2-2-2m-2.83-.83L7.76 5.75A5.97 5.97 0 0 0 6 9.99c0 1.6.62 3.11 1.76 4.25l1.41-1.41A3.96 3.96 0 0 1 8 10c0-1.07.42-2.07 1.17-2.82Zm7.07-1.41-1.41 1.41C15.59 7.93 16 8.93 16 10s-.42 2.07-1.17 2.83l1.41 1.41C17.37 13.11 18 11.6 18 10s-.62-3.11-1.76-4.24"/><path d="M6.34 4.34 4.93 2.92C3.04 4.81 2 7.32 2 9.99s1.04 5.18 2.93 7.07l1.41-1.41c-1.51-1.51-2.35-3.52-2.35-5.66s.83-4.15 2.34-5.65Zm11.32 0c3.12 3.12 3.12 8.2 0 11.31l1.41 1.41c3.9-3.9 3.9-10.24 0-14.14l-1.41 1.41Z"/></svg>',
  tools:
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M20.71 6.04a.99.99 0 0 0-.9.27l-3.18 3.18-2.12-2.12 3.18-3.18a.98.98 0 0 0 .27-.9c-.07-.33-.29-.6-.6-.73A7.47 7.47 0 0 0 9.2 4.19a7.49 7.49 0 0 0-1.86 7.52L2.3 16.75c-.19.19-.29.44-.29.71s.11.52.29.71l3.54 3.54c.19.19.44.29.71.29s.52-.11.71-.29l5.04-5.04c2.64.82 5.53.12 7.52-1.86a7.47 7.47 0 0 0 1.63-8.16c-.13-.31-.4-.53-.73-.6Zm-2.32 7.34a5.51 5.51 0 0 1-5.98 1.2c-.37-.15-.8-.07-1.09.22l-4.78 4.78-2.12-2.12 4.78-4.78c.29-.29.37-.71.22-1.09a5.47 5.47 0 0 1 1.2-5.98 5.5 5.5 0 0 1 4.41-1.59l-2.65 2.65a.996.996 0 0 0 0 1.41l3.54 3.54c.19.19.44.29.71.29s.52-.11.71-.29l2.65-2.65c.16 1.61-.4 3.23-1.59 4.42Z"/></svg>',
  audio:
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V6c0-2.21-1.79-4-4-4S8 3.79 8 6v6c0 2.21 1.79 4 4 4s4-1.79 4-4m-6 0V6c0-1.1.9-2 2-2s2 .9 2 2v6c0 1.1-.9 2-2 2s-2-.9-2-2"/><path d="M18 12c0 3.31-2.69 6-6 6s-6-2.69-6-6H4c0 4.07 3.06 7.44 7 7.93V22h2v-2.07c3.94-.49 7-3.86 7-7.93z"/></svg>',
};

const DISPLAY_ORDER: readonly ModelCapability[] = ['stream', 'tools', 'image', 'audio', 'video'];
const MODALITY_ORDER: readonly ModelModality[] = ['text', 'image', 'audio', 'video'];
const unknownIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M11 16h2v2h-2z"/><path d="M16.71 2.29A1 1 0 0 0 16 2H8c-.27 0-.52.11-.71.29l-5 5A1 1 0 0 0 2 8v8c0 .27.11.52.29.71l5 5c.19.19.44.29.71.29h8c.27 0 .52-.11.71-.29l5-5A1 1 0 0 0 22 16V8c0-.27-.11-.52-.29-.71zM20 15.58l-4.41 4.41H8.42l-4.41-4.41V8.41L8.42 4h7.17L20 8.41z"/><path d="M13.27 6.25c-2.08-.75-4.47.35-5.21 2.41l1.88.68c.18-.5.56-.9 1.07-1.13s1.08-.26 1.58-.08a2.01 2.01 0 0 1 1.32 1.86c0 1.04-1.66 1.86-2.24 2.07-.4.14-.67.52-.67.94v1h2v-.34c1.04-.51 2.91-1.69 2.91-3.68a4.015 4.015 0 0 0-2.64-3.73"/></svg>';

interface ModalityProps {
  modalities?: readonly ModelModality[];
  compact?: boolean;
  iconOnly?: boolean;
  direction: 'input' | 'output';
}

const ModelCapabilityBadges: Component<Props> = (props) => {
  const hasMetadata = () => (props.capabilities?.length ?? 0) > 0;
  const supported = () => {
    const set = new Set(props.capabilities ?? []);
    return DISPLAY_ORDER.filter((capability) => set.has(capability));
  };
  const summary = () => {
    if (!hasMetadata()) return 'Capabilities unknown';
    if (supported().length === 0) return 'Text only';
    return `Capabilities: ${supported()
      .map((capability) => CAPABILITY_LABELS[capability])
      .join(', ')}`;
  };

  return (
    <Show
      when={supported().length > 0}
      fallback={
        <span
          class="model-capability-badges"
          classList={{ 'model-capability-badges--compact': !!props.compact }}
          aria-label={summary()}
        >
          <Show when={!hasMetadata()}>
            <span
              class="model-capability-badge model-capability-badge--icon-only model-capability-badge--unknown"
              data-tooltip="Capabilities unknown"
            >
              <span class="model-capability-badge__icon" innerHTML={unknownIcon} />
            </span>
          </Show>
        </span>
      }
    >
      <span
        class="model-capability-badges"
        classList={{ 'model-capability-badges--compact': !!props.compact }}
        aria-label={summary()}
        title="Model capability metadata. This is not a selected setting."
      >
        <For each={supported()}>
          {(capability) => (
            <span
              class="model-capability-badge"
              classList={{ 'model-capability-badge--icon-only': !!props.iconOnly }}
              title={props.iconOnly ? undefined : CAPABILITY_LABELS[capability]}
              data-tooltip={CAPABILITY_LABELS[capability]}
            >
              {CAPABILITY_ICONS[capability] && (
                <span
                  class="model-capability-badge__icon"
                  innerHTML={CAPABILITY_ICONS[capability]}
                />
              )}
              <Show when={!props.iconOnly}>{CAPABILITY_LABELS[capability]}</Show>
            </span>
          )}
        </For>
      </span>
    </Show>
  );
};

export const ModelModalityBadges: Component<ModalityProps> = (props) => {
  const supported = () => {
    const set = new Set(props.modalities ?? []);
    return MODALITY_ORDER.filter((modality) => set.has(modality));
  };
  const directionLabel = () => (props.direction === 'input' ? 'Input' : 'Output');
  const summary = () => {
    if (supported().length === 0) return `${directionLabel()} modalities unknown`;
    return `${directionLabel()}: ${supported()
      .map((modality) => CAPABILITY_LABELS[modality])
      .join(', ')}`;
  };
  const tooltip = (modality: ModelModality) => CAPABILITY_LABELS[modality];

  return (
    <Show
      when={supported().length > 0}
      fallback={
        <span
          class="model-capability-badges model-modality-badges"
          classList={{ 'model-capability-badges--compact': !!props.compact }}
          aria-label={summary()}
        >
          <span
            class="model-capability-badge model-capability-badge--icon-only model-capability-badge--unknown"
            data-tooltip={`${directionLabel()} modalities unknown`}
          >
            <span class="model-capability-badge__icon" innerHTML={unknownIcon} />
          </span>
        </span>
      }
    >
      <span
        class="model-capability-badges model-modality-badges"
        classList={{ 'model-capability-badges--compact': !!props.compact }}
        aria-label={summary()}
      >
        <For each={supported()}>
          {(modality) => (
            <span
              class="model-capability-badge model-modality-badge"
              classList={{ 'model-capability-badge--icon-only': !!props.iconOnly }}
              title={props.iconOnly ? undefined : tooltip(modality)}
              data-tooltip={tooltip(modality)}
            >
              <span class="model-capability-badge__icon" innerHTML={CAPABILITY_ICONS[modality]} />
              <Show when={!props.iconOnly}>{CAPABILITY_LABELS[modality]}</Show>
            </span>
          )}
        </For>
      </span>
    </Show>
  );
};

export default ModelCapabilityBadges;
