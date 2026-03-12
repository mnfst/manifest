import { getModelPrices } from './api.js';
import { getModelLabel } from './provider-utils.js';
import { inferProviderFromModel, stripCustomPrefix } from './routing-utils.js';

interface ModelPriceEntry {
  model_name: string;
  provider: string;
  display_name?: string;
}

let cache: Map<string, string> | null = null;
let loading: Promise<void> | null = null;

function buildCache(models: ModelPriceEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of models) {
    if (m.display_name) map.set(m.model_name, m.display_name);
  }
  return map;
}

async function ensureCache(): Promise<void> {
  if (cache) return;
  if (loading) return loading;
  loading = (async () => {
    try {
      const data = (await getModelPrices()) as { models: ModelPriceEntry[] };
      cache = buildCache(data.models);
    } catch {
      cache = new Map();
    }
  })();
  return loading;
}

export function preloadModelDisplayNames(): void {
  ensureCache();
}

export function getModelDisplayName(slug: string): string {
  if (cache) {
    const cached = cache.get(slug);
    if (cached) return cached;
  }
  const provId = inferProviderFromModel(slug);
  if (provId) return getModelLabel(provId, slug);
  return stripCustomPrefix(slug);
}
