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
      const parts = entry.split(':');
      return {
        model_name: parts[0] ?? '',
        ...(parts[1] !== undefined ? { input_price: parts[1] } : {}),
        ...(parts[2] !== undefined ? { output_price: parts[2] } : {}),
      };
    });
  }

  return prefill;
}
