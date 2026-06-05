import type { UserProvider } from '../entities/user-provider.entity';

export function serializeProviderConnection(p: UserProvider) {
  return {
    id: p.id,
    provider: p.provider,
    auth_type: p.auth_type ?? 'api_key',
    is_active: p.is_active,
    has_api_key: !!p.api_key_encrypted,
    key_prefix: p.key_prefix ?? null,
    label: p.label,
    priority: p.priority,
    region: p.region ?? null,
    connected_at: p.connected_at,
    models_fetched_at: p.models_fetched_at ?? null,
    cached_model_count: Array.isArray(p.cached_models) ? p.cached_models.length : 0,
  };
}
