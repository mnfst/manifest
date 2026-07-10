import type { ModelRoute } from 'manifest-shared';
import type { DiscoveredModel } from '../../model-discovery/model-fetcher';
import { unambiguousRoute } from '../routing-core/route-helpers';

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

/**
 * Resolve the `model` field of an OpenAI-compatible request to a route.
 *
 * Matches the provider-qualified id published by `/v1/models`
 * (`openai/gpt-5.4-nano`) first, then the bare provider-native name
 * (`gpt-5.4-nano`) when it names exactly one discovered model. Most SDKs send a
 * bare name because the field is mandatory, and refusing to resolve it stranded
 * the request on an error even though the model was connected.
 *
 * Returns null for an unknown name, and for a bare name carried by more than
 * one connection (the same id under both an API key and a subscription) — the
 * caller cannot guess which was meant, so it falls back to configured routing.
 */
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
  return unambiguousRoute(modelId, [...models]);
}
