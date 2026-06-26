import type { ModelAlias } from './api.js';

export interface ExposedSetupModel {
  id: string;
  name: string;
}

export function exposedSetupModels(
  aliases: readonly Pick<ModelAlias, 'model_id' | 'display_name' | 'enabled'>[] | undefined,
): ExposedSetupModel[] {
  const seen = new Set<string>();
  const models: ExposedSetupModel[] = [];
  const add = (id: string, name: string) => {
    const key = id.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    models.push({ id, name });
  };

  add('auto', 'Manifest Auto');
  add('manifest/auto', 'Manifest Auto');
  for (const alias of aliases ?? []) {
    if (!alias.enabled) continue;
    add(alias.model_id, alias.display_name ?? alias.model_id);
  }
  return models;
}
