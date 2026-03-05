import { getMetadataArgsStorage } from 'typeorm';
import { Agent } from './agent.entity';
import { Tenant } from './tenant.entity';
import { AgentApiKey } from './agent-api-key.entity';

describe('Agent entity', () => {
  it('creates an instance with all fields', () => {
    const agent = new Agent();
    agent.id = 'agent-1';
    agent.name = 'demo-agent';
    agent.display_name = 'Demo Agent';
    agent.description = 'A test agent';
    agent.is_active = true;
    agent.tenant_id = 'tenant-1';
    agent.created_at = '2024-01-01T00:00:00Z';
    agent.updated_at = '2024-01-02T00:00:00Z';

    expect(agent.id).toBe('agent-1');
    expect(agent.name).toBe('demo-agent');
    expect(agent.display_name).toBe('Demo Agent');
    expect(agent.description).toBe('A test agent');
    expect(agent.is_active).toBe(true);
    expect(agent.tenant_id).toBe('tenant-1');
  });

  it('allows nullable fields to be null', () => {
    const agent = new Agent();
    agent.id = 'agent-2';
    agent.name = 'test';
    agent.display_name = null;
    agent.description = null;

    expect(agent.display_name).toBeNull();
    expect(agent.description).toBeNull();
  });

  describe('TypeORM relation callbacks', () => {
    it('ManyToOne callback resolves to Tenant with inverse side', () => {
      const relations = getMetadataArgsStorage().relations.filter((r) => r.target === Agent);
      const manyToOne = relations.find((r) => r.relationType === 'many-to-one');
      expect(manyToOne).toBeDefined();
      const resolved = (manyToOne!.type as () => unknown)();
      expect(resolved).toBe(Tenant);

      // Invoke the inverse side callback
      const tenant = new Tenant();
      tenant.agents = [new Agent()];
      const inverseFn = manyToOne!.inverseSideProperty as (obj: Tenant) => unknown;
      expect(inverseFn(tenant)).toBe(tenant.agents);
    });

    it('OneToOne callback resolves to AgentApiKey with inverse side', () => {
      const relations = getMetadataArgsStorage().relations.filter((r) => r.target === Agent);
      const oneToOne = relations.find((r) => r.relationType === 'one-to-one');
      expect(oneToOne).toBeDefined();
      const resolved = (oneToOne!.type as () => unknown)();
      expect(resolved).toBe(AgentApiKey);

      // Invoke the inverse side callback
      const apiKey = new AgentApiKey();
      apiKey.agent = new Agent();
      const inverseFn = oneToOne!.inverseSideProperty as (obj: AgentApiKey) => unknown;
      expect(inverseFn(apiKey)).toBe(apiKey.agent);
    });
  });
});
