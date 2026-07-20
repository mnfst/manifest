import type { ModelCapability, ModelModality } from 'manifest-shared';

/**
 * Hand-curated capability facts for models where both the provider's own
 * metadata and models.dev are silent.
 *
 * **Authority:** modalities already discovered from the provider or models.dev
 * win. Capability lists are positive assertions, so they merge; an upstream
 * omission means unknown, never unsupported. Keep this list minimal: add an
 * entry only when support was confirmed against the provider's actual behavior
 * and no upstream catalog carries it.
 */
interface KnownCapabilities {
  input: readonly ModelModality[];
  output: readonly ModelModality[];
  capabilities: readonly ModelCapability[];
}

const TEXT_IMAGE_TOOLS: KnownCapabilities = {
  input: ['text', 'image'],
  output: ['text'],
  capabilities: ['text', 'image', 'tools', 'stream'],
};
const TEXT_TOOLS: KnownCapabilities = {
  input: ['text'],
  output: ['text'],
  capabilities: ['text', 'tools', 'stream'],
};

/** Keyed by `<provider-id>/<model-id>`, lowercase. */
const KNOWN_MODEL_MODALITIES: Readonly<Record<string, KnownCapabilities>> = {
  // ChatGPT subscription (Codex models API) publishes no modality metadata,
  // and models.dev lags behind new launches. These facts bootstrap the
  // subscription catalog until an upstream source carries them (#2537).
  'openai/gpt-5.6-sol': TEXT_IMAGE_TOOLS,
  'openai/gpt-5.6-terra': TEXT_IMAGE_TOOLS,
  'openai/gpt-5.6-luna': TEXT_IMAGE_TOOLS,
  'openai/gpt-5.5': TEXT_IMAGE_TOOLS,
  'openai/gpt-5.4': TEXT_IMAGE_TOOLS,
  'openai/gpt-5.4-mini': TEXT_IMAGE_TOOLS,
  // Rejects image input (#2537).
  'openai/gpt-5.3-codex-spark': TEXT_TOOLS,
};

export function lookupKnownModalities(
  providerId: string,
  modelId: string,
): KnownCapabilities | undefined {
  return KNOWN_MODEL_MODALITIES[`${providerId.toLowerCase()}/${modelId.toLowerCase()}`];
}
