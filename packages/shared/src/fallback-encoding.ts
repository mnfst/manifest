/**
 * Encode/decode the per-fallback "use this specific provider key" pin.
 *
 * `tier_assignments.fallback_models` stays a plain `string[]` for storage
 * compatibility — older entries without a pin look exactly the same. New
 * entries serialize the optional key label as a `||<label>` suffix:
 *
 *   `gemini-2.5-flash`            → no key pin (use the provider's first key)
 *   `gemini-2.5-flash||Work`      → use the key labeled "Work"
 *
 * `||` was picked because it doesn't appear in any model identifier we ship
 * (Anthropic Bedrock ARNs use a single `:`, OpenRouter ids use `/`, Ollama
 * tags use `:`, etc).
 */
export const FALLBACK_KEY_DELIMITER = '||';

export interface FallbackEntry {
  model: string;
  providerKeyLabel?: string;
}

export function parseFallbackEntry(entry: string): FallbackEntry {
  const idx = entry.indexOf(FALLBACK_KEY_DELIMITER);
  if (idx < 0) return { model: entry };
  const model = entry.slice(0, idx);
  const label = entry.slice(idx + FALLBACK_KEY_DELIMITER.length).trim();
  if (!label) return { model };
  return { model, providerKeyLabel: label };
}

export function encodeFallbackEntry(entry: FallbackEntry): string {
  if (!entry.providerKeyLabel) return entry.model;
  return `${entry.model}${FALLBACK_KEY_DELIMITER}${entry.providerKeyLabel}`;
}
