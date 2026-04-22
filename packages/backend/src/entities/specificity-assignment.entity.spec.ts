import { SpecificityAssignment } from './specificity-assignment.entity';

describe('SpecificityAssignment entity', () => {
  it('should instantiate with all fields assignable', () => {
    const entity = new SpecificityAssignment();
    entity.id = 'sa1';
    entity.user_id = 'u1';
    entity.agent_id = 'agent-1';
    entity.category = 'coding';
    entity.is_active = true;
    entity.override_model = 'gpt-4o';
    entity.override_provider = 'openai';
    entity.override_provider_id = 'up-abc123';
    entity.override_auth_type = 'api_key';
    entity.auto_assigned_model = 'claude-opus-4-6';
    entity.fallback_models = ['gpt-4o-mini'];
    entity.updated_at = '2025-06-01T00:00:00Z';

    expect(entity.id).toBe('sa1');
    expect(entity.user_id).toBe('u1');
    expect(entity.agent_id).toBe('agent-1');
    expect(entity.category).toBe('coding');
    expect(entity.is_active).toBe(true);
    expect(entity.override_model).toBe('gpt-4o');
    expect(entity.override_provider).toBe('openai');
    expect(entity.override_provider_id).toBe('up-abc123');
    expect(entity.override_auth_type).toBe('api_key');
    expect(entity.auto_assigned_model).toBe('claude-opus-4-6');
    expect(entity.fallback_models).toEqual(['gpt-4o-mini']);
    expect(entity.updated_at).toBe('2025-06-01T00:00:00Z');
  });

  it('should allow nullable fields to be null', () => {
    const entity = new SpecificityAssignment();
    entity.override_model = null;
    entity.override_provider = null;
    entity.override_provider_id = null;
    entity.override_auth_type = null;
    entity.auto_assigned_model = null;
    entity.fallback_models = null;

    expect(entity.override_model).toBeNull();
    expect(entity.override_provider).toBeNull();
    expect(entity.override_provider_id).toBeNull();
    expect(entity.override_auth_type).toBeNull();
    expect(entity.auto_assigned_model).toBeNull();
    expect(entity.fallback_models).toBeNull();
  });

  it('should allow is_active to be set to false', () => {
    const entity = new SpecificityAssignment();
    entity.is_active = false;
    expect(entity.is_active).toBe(false);
  });
});
