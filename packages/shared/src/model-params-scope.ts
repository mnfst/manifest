export function modelParamsScopeForTier(tier: string): string {
  return `tier:${tier}`;
}

export function modelParamsScopeForSpecificity(category: string): string {
  return `specificity:${category}`;
}

export function modelParamsScopeForHeaderTier(headerTierId: string): string {
  return `header:${headerTierId}`;
}

export interface ModelParamsRoutingScopeInput {
  tier: string;
  specificityCategory?: string;
  headerTierId?: string;
}

export function modelParamsScopeForRouting(input: ModelParamsRoutingScopeInput): string {
  if (input.headerTierId) return modelParamsScopeForHeaderTier(input.headerTierId);
  if (input.specificityCategory) return modelParamsScopeForSpecificity(input.specificityCategory);
  return modelParamsScopeForTier(input.tier);
}
