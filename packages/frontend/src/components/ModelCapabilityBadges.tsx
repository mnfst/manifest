import { For, Show, type Component } from 'solid-js';
import type { ModelCapability } from '../services/api.js';

interface Props {
  capabilities?: readonly ModelCapability[];
  compact?: boolean;
}

const CAPABILITY_LABELS: Record<ModelCapability, string> = {
  text: 'Text',
  image: 'Image',
  audio: 'Audio',
  video: 'Video',
  stream: 'Stream',
  tools: 'Tools',
};

const DISPLAY_ORDER: readonly ModelCapability[] = ['stream', 'tools', 'image', 'audio', 'video'];

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
          class="model-capability-badges model-capability-badges--empty"
          classList={{ 'model-capability-badges--compact': !!props.compact }}
          aria-label={summary()}
          title="Model capability metadata. This is not a selected setting."
        >
          {summary()}
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
            <span class="model-capability-badge">{CAPABILITY_LABELS[capability]}</span>
          )}
        </For>
      </span>
    </Show>
  );
};

export default ModelCapabilityBadges;
