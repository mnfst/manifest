import type { UserProvider } from '../entities/user-provider.entity';

export interface ProviderConnectionResponse {
  id: string;
  provider: string;
  auth_type: string;
  is_active: boolean;
  has_api_key: boolean;
  key_prefix: string | null;
  label: string | undefined;
  priority: number;
  region: string | null;
  connected_at: string;
  models_fetched_at: string | null;
  cached_model_count: number;
}

/**
 * Serialize a UserProvider row to the shared provider-connection response
 * shape used by both GlobalProvidersController and ProviderController.
 */
export function serializeProviderConnection(p: UserProvider): ProviderConnectionResponse {
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
