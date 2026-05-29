import { PROVIDERS } from './providers.js';
import { resolveProviderId, inferProviderFromModel } from './routing-utils.js';
import type { AvailableModel } from './api.js';

/** Resolve the canonical provider id for a model name against discovery data. */
export function providerIdForModel(model: string, apiModels: AvailableModel[]): string | undefined {
  const m =
    apiModels.find((x) => x.model_name === model) ??
    apiModels.find((x) => x.model_name.startsWith(model + '-'));
  if (m) {
    const dbId = resolveProviderId(m.provider);
    if (dbId && dbId !== 'openrouter' && PROVIDERS.find((p) => p.id === dbId)) {
      return dbId;
    }
    const prefixId = inferProviderFromModel(m.model_name);
    if (prefixId && PROVIDERS.find((p) => p.id === prefixId)) return prefixId;
    return dbId ?? prefixId;
  }
  const prefix = inferProviderFromModel(model);
  if (prefix && PROVIDERS.find((p) => p.id === prefix)) return prefix;
  for (const prov of PROVIDERS) {
    if (
      prov.models?.some(
        (pm) =>
          pm.value === model ||
          model.startsWith(pm.value + '-') ||
          pm.value.startsWith(model + '-'),
      )
    ) {
      return prov.id;
    }
  }
  return undefined;
}
