import { TierAssignment } from './tier-assignment.entity';

describe('TierAssignment entity', () => {
  it('should instantiate with all fields assignable', () => {
    const entity = new TierAssignment();
    entity.id = 't1';
    entity.user_id = 'u1';
    entity.tier = 'complex';
    entity.override_model = 'gpt-4o';
    entity.auto_assigned_model = 'claude-opus-4-6';
    entity.updated_at = '2025-06-01T00:00:00Z';

    expect(entity.id).toBe('t1');
    expect(entity.user_id).toBe('u1');
    expect(entity.tier).toBe('complex');
    expect(entity.override_model).toBe('gpt-4o');
    expect(entity.auto_assigned_model).toBe('claude-opus-4-6');
    expect(entity.updated_at).toBe('2025-06-01T00:00:00Z');
  });

  it('should allow nullable fields to be null', () => {
    const entity = new TierAssignment();
    entity.override_model = null;
    entity.auto_assigned_model = null;

    expect(entity.override_model).toBeNull();
    expect(entity.auto_assigned_model).toBeNull();
  });
});
