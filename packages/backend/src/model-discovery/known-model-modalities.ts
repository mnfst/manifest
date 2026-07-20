import type { ModelModality } from 'manifest-shared';

/**
 * Hand-curated modality facts for models where both the provider's own
 * metadata and models.dev are silent.
 *
 * **Priority:** entries here only fill gaps — modalities already discovered
 * from the provider or models.dev win. Keep this list minimal: add an entry
 * only when the modality support was confirmed against the provider's actual
 * behavior and no upstream catalog carries it.
 */
interface KnownModalities {
  input: readonly ModelModality[];
  output: readonly ModelModality[];
}

const TEXT_IMAGE_IN: KnownModalities = { input: ['text', 'image'], output: ['text'] };
const TEXT_ONLY: KnownModalities = { input: ['text'], output: ['text'] };

/** Keyed by `<provider-id>/<model-id>`, lowercase. */
const KNOWN_MODEL_MODALITIES: Readonly<Record<string, KnownModalities>> = {
  // ChatGPT subscription (Codex models API) publishes no modality metadata,
  // and models.dev lags behind new launches. These facts bootstrap the
  // subscription catalog until an upstream source carries them (#2537).
  'openai/gpt-5.6-sol': TEXT_IMAGE_IN,
  'openai/gpt-5.6-terra': TEXT_IMAGE_IN,
  'openai/gpt-5.6-luna': TEXT_IMAGE_IN,
  'openai/gpt-5.5': TEXT_IMAGE_IN,
  'openai/gpt-5.4': TEXT_IMAGE_IN,
  'openai/gpt-5.4-mini': TEXT_IMAGE_IN,
  // Rejects image input (#2537).
  'openai/gpt-5.3-codex-spark': TEXT_ONLY,
};

export function lookupKnownModalities(
  providerId: string,
  modelId: string,
): KnownModalities | undefined {
  return KNOWN_MODEL_MODALITIES[`${providerId.toLowerCase()}/${modelId.toLowerCase()}`];
}
