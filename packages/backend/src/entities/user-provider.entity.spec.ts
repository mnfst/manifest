import { UserProvider } from './user-provider.entity';

describe('UserProvider entity', () => {
  it('should instantiate with all fields assignable', () => {
    const entity = new UserProvider();
    entity.id = 'p1';
    entity.user_id = 'u1';
    entity.provider = 'openai';
    entity.api_key_encrypted = 'enc-key';
    entity.key_prefix = 'enc-key-';
    entity.region = 'singapore';
    entity.is_active = true;
    entity.connected_at = '2025-01-01T00:00:00Z';
    entity.updated_at = '2025-01-01T00:00:00Z';

    expect(entity.id).toBe('p1');
    expect(entity.user_id).toBe('u1');
    expect(entity.provider).toBe('openai');
    expect(entity.api_key_encrypted).toBe('enc-key');
    expect(entity.key_prefix).toBe('enc-key-');
    expect(entity.region).toBe('singapore');
    expect(entity.is_active).toBe(true);
    expect(entity.connected_at).toBe('2025-01-01T00:00:00Z');
    expect(entity.updated_at).toBe('2025-01-01T00:00:00Z');
  });

  it('should allow is_active to be set to false', () => {
    const entity = new UserProvider();
    entity.is_active = false;
    expect(entity.is_active).toBe(false);
  });

  it('should allow api_key_encrypted to be null', () => {
    const entity = new UserProvider();
    entity.api_key_encrypted = null;
    expect(entity.api_key_encrypted).toBeNull();
  });

  it('should allow key_prefix to be null', () => {
    const entity = new UserProvider();
    entity.key_prefix = null;
    expect(entity.key_prefix).toBeNull();
  });

  it('should allow region to be null', () => {
    const entity = new UserProvider();
    entity.region = null;
    expect(entity.region).toBeNull();
  });
});
