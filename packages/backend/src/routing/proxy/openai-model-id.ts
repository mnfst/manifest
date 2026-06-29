import type { ModelRoute } from 'manifest-shared';
import type { DiscoveredModel } from '../../model-discovery/model-fetcher';

export const OPENAI_MODEL_ID_AUTO = 'auto';
const SUBSCRIPTION_MODEL_SUFFIX = '-subscription';

export function openAiModelId(model: DiscoveredModel): string {
  const provider = model.provider.toLowerCase();
  if (provider.startsWith('custom:')) return model.id;

  const prefix = `${provider}/`;
  const routeId = model.id.toLowerCase().startsWith(prefix) ? model.id : `${provider}/${model.id}`;
  if (model.authType !== 'subscription' || routeId.endsWith(SUBSCRIPTION_MODEL_SUFFIX)) {
    return routeId;
  }
  return `${routeId}${SUBSCRIPTION_MODEL_SUFFIX}`;
}

export function routeForOpenAiModelId(
  modelId: string,
  models: readonly DiscoveredModel[],
): ModelRoute | null {
  for (const model of models) {
    if (!model.authType) continue;
    if (openAiModelId(model) !== modelId) continue;
    return {
      provider: model.provider,
      authType: model.authType,
      model: model.id,
    };
  }
  return null;
}
