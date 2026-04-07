/**
 * Parse URL search params for deep-linking into provider forms.
 *
 * Supported params:
 *   provider=custom  — triggers the custom provider form
 *   provider=<id>    — opens the detail view for a standard provider (e.g. anthropic, gemini)
 *   name=ProviderName
 *   baseUrl=https://api.example.com/v1
 *   apiKey=sk-...
 *   models=modelA,modelB:1.5:2,modelC:0:0
 *         (format: name[:inputPrice[:outputPrice]], comma-separated)
 */

/**
 * When `provider=<id>` is a known standard provider, this prefill tells the
 * modal to jump straight to that provider's detail view.
 */
export interface ProviderDeepLink {
  providerId: string;
}

export interface CustomProviderPrefill {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  models?: { model_name: string; input_price?: string; output_price?: string }[];
}

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseCustomProviderParams(
  params: Record<string, string | string[] | undefined>,
): CustomProviderPrefill | null {
  if (str(params.provider) !== 'custom') return null;

  const prefill: CustomProviderPrefill = {};

  const name = str(params.name);
  const baseUrl = str(params.baseUrl);
  const apiKey = str(params.apiKey);
  const models = str(params.models);

  if (name) prefill.name = name;
  if (baseUrl) prefill.baseUrl = baseUrl;
  if (apiKey) prefill.apiKey = apiKey;

  if (models) {
    prefill.models = models.split(',').map((entry) => {
      // Split from the right: the last two colon-segments are prices only if
      // they look numeric (or empty). This preserves colons in model names
      // like "corethink:free".
      const parts = entry.split(':');
      // 3+ parts: last two are prices if both look numeric
      if (
        parts.length >= 3 &&
        /^[\d.]*$/.test(parts[parts.length - 1]!) &&
        /^[\d.]*$/.test(parts[parts.length - 2]!)
      ) {
        const outputPrice = parts.pop()!;
        const inputPrice = parts.pop()!;
        return {
          model_name: parts.join(':'),
          ...(inputPrice !== '' ? { input_price: inputPrice } : {}),
          ...(outputPrice !== '' ? { output_price: outputPrice } : {}),
        };
      }
      // 2 parts: last is input price if numeric
      if (parts.length === 2 && /^[\d.]+$/.test(parts[1]!)) {
        return { model_name: parts[0]!, input_price: parts[1]! };
      }
      return { model_name: entry };
    });
  }

  return prefill;
}

/**
 * Parse a `provider=<id>` param that refers to a standard (non-custom) provider.
 * Returns null when the param is missing, empty, or `"custom"` (handled separately).
 */
export function parseProviderDeepLink(
  params: Record<string, string | string[] | undefined>,
): ProviderDeepLink | null {
  const provider = str(params.provider);
  if (!provider || provider === 'custom') return null;
  return { providerId: provider };
}
