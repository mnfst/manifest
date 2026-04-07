/**
 * Parse URL search params for deep-linking into the custom provider form.
 *
 * Supported params:
 *   provider=custom  (required — triggers the custom form)
 *   name=ProviderName
 *   baseUrl=https://api.example.com/v1
 *   apiKey=sk-...
 *   models=modelA,modelB:1.5:2,modelC:0:0
 *         (format: name[:inputPrice[:outputPrice]], comma-separated)
 */
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
