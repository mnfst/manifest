/**
 * Last-resort hardcoded pricing for models that no external pricing source covers.
 *
 * This is used ONLY when both models.dev and OpenRouter have no data for a model.
 * Keep this list minimal — prefer upstream sources. Prices are per-token (not per-million).
 *
 * Sources:
 *  - Moonshot v1: https://platform.moonshot.cn/docs/pricing (¥12/1M ≈ $1.66/1M at 2025 rates)
 *  - gemma-3-1b-it: Free on Google AI Studio
 */

interface KnownPrice {
  input: number;
  output: number;
}

const PER_MILLION = 1_000_000;

/**
 * Map of model ID prefixes → per-token pricing.
 * Prefix matching allows one entry to cover multiple context-window variants
 * (e.g. "moonshot-v1-" covers moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k).
 */
const KNOWN_PRICES: ReadonlyArray<{ prefix: string; price: KnownPrice }> = [
  { prefix: 'moonshot-v1-', price: { input: 1.66 / PER_MILLION, output: 1.66 / PER_MILLION } },
  { prefix: 'gemma-3-1b-it', price: { input: 0, output: 0 } },
  // gemini-pro-latest is Google's alias for the current Gemini Pro (2.5 Pro)
  { prefix: 'gemini-pro-latest', price: { input: 1.25 / PER_MILLION, output: 10.0 / PER_MILLION } },
];

export function lookupKnownPrice(modelId: string): KnownPrice | null {
  for (const entry of KNOWN_PRICES) {
    if (modelId.startsWith(entry.prefix) || modelId === entry.prefix) {
      return entry.price;
    }
  }
  return null;
}
