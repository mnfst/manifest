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

export function parseCustomProviderParams(
  params: Record<string, string | undefined>,
): CustomProviderPrefill | null {
  if (params.provider !== 'custom') return null;

  const prefill: CustomProviderPrefill = {};

  if (params.name) prefill.name = params.name;
  if (params.baseUrl) prefill.baseUrl = params.baseUrl;
  if (params.apiKey) prefill.apiKey = params.apiKey;

  if (params.models) {
    prefill.models = params.models.split(',').map((entry) => {
      const [model_name, input_price, output_price] = entry.split(':');
      return {
        model_name,
        ...(input_price !== undefined ? { input_price } : {}),
        ...(output_price !== undefined ? { output_price } : {}),
      };
    });
  }

  return prefill;
}
