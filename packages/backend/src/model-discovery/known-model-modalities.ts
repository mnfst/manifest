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

/** Keyed by `<provider-id>/<model-id>`, lowercase. */
const KNOWN_MODEL_MODALITIES: Readonly<Record<string, KnownModalities>> = {
  // ChatGPT subscription (Codex models API) publishes no modality metadata
  // and models.dev has no entry; the model rejects image input (#2537).
  'openai/gpt-5.3-codex-spark': { input: ['text'], output: ['text'] },
};

export function lookupKnownModalities(
  providerId: string,
  modelId: string,
): KnownModalities | undefined {
  return KNOWN_MODEL_MODALITIES[`${providerId.toLowerCase()}/${modelId.toLowerCase()}`];
}
