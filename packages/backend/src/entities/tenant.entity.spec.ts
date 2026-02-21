import { Tenant } from './tenant.entity';

describe('Tenant entity', () => {
  it('creates an instance with all fields', () => {
    const t = new Tenant();
    t.id = 'tenant-1';
    t.name = 'test-tenant';
    t.organization_name = 'Test Org';
    t.email = 'test@example.com';
    t.is_active = true;
    t.agents = [];
    t.created_at = '2024-01-01T00:00:00Z';
    t.updated_at = '2024-01-02T00:00:00Z';
    expect(t.id).toBe('tenant-1');
    expect(t.name).toBe('test-tenant');
    expect(t.organization_name).toBe('Test Org');
    expect(t.email).toBe('test@example.com');
    expect(t.is_active).toBe(true);
    expect(t.agents).toEqual([]);
  });

  it('allows nullable fields to be null', () => {
    const t = new Tenant();
    t.id = 'tenant-2';
    t.name = 'test';
    t.organization_name = null;
    t.email = null;
    expect(t.organization_name).toBeNull();
    expect(t.email).toBeNull();
  });
});
