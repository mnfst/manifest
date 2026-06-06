import { serializeProviderConnection } from './provider-response';
import type { UserProvider } from '../entities/user-provider.entity';

function makeRow(overrides: Partial<UserProvider> = {}): UserProvider {
  return {
    id: 'p1',
    provider: 'openai',
    auth_type: 'api_key',
    is_active: true,
    api_key_encrypted: 'enc-secret',
    key_prefix: 'sk-proj-',
    label: 'Work',
    priority: 0,
    region: null,
    connected_at: '2025-01-01T00:00:00.000Z',
    models_fetched_at: '2026-04-01T10:00:00.000Z',
    cached_models: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }],
    ...overrides,
  } as UserProvider;
}

describe('serializeProviderConnection', () => {
  it('maps all fields from a fully-populated row', () => {
    const result = serializeProviderConnection(makeRow());
    expect(result).toEqual({
      id: 'p1',
      provider: 'openai',
      auth_type: 'api_key',
      is_active: true,
      has_api_key: true,
      key_prefix: 'sk-proj-',
      label: 'Work',
      priority: 0,
      region: null,
      connected_at: '2025-01-01T00:00:00.000Z',
      models_fetched_at: '2026-04-01T10:00:00.000Z',
      cached_model_count: 2,
    });
  });

  it('returns has_api_key: false when api_key_encrypted is null', () => {
    const result = serializeProviderConnection(makeRow({ api_key_encrypted: null }));
    expect(result.has_api_key).toBe(false);
  });

  it('falls back auth_type to "api_key" when undefined', () => {
    const result = serializeProviderConnection(makeRow({ auth_type: undefined }));
    expect(result.auth_type).toBe('api_key');
  });

  it('falls back key_prefix to null when undefined', () => {
    const result = serializeProviderConnection(makeRow({ key_prefix: undefined }));
    expect(result.key_prefix).toBeNull();
  });

  it('falls back region to null when undefined', () => {
    const result = serializeProviderConnection(makeRow({ region: undefined }));
    expect(result.region).toBeNull();
  });

  it('falls back models_fetched_at to null when undefined', () => {
    const result = serializeProviderConnection(makeRow({ models_fetched_at: undefined }));
    expect(result.models_fetched_at).toBeNull();
  });

  it('returns cached_model_count: 0 when cached_models is null', () => {
    const result = serializeProviderConnection(makeRow({ cached_models: null as never }));
    expect(result.cached_model_count).toBe(0);
  });

  it('returns cached_model_count: 0 when cached_models is not an array', () => {
    const result = serializeProviderConnection(makeRow({ cached_models: 'bad' as never }));
    expect(result.cached_model_count).toBe(0);
  });

  it('does not expose api_key_encrypted in the output', () => {
    const result = serializeProviderConnection(makeRow());
    expect(result).not.toHaveProperty('api_key_encrypted');
  });
});
