import { getMetadataArgsStorage } from 'typeorm';
import { AgentApiKey } from './agent-api-key.entity';
import { Tenant } from './tenant.entity';
import { Agent } from './agent.entity';

describe('AgentApiKey entity', () => {
  it('creates an instance with all fields', () => {
    const key = new AgentApiKey();
    key.id = 'aak-1';
    key.key = 'mnfst_abc123';
    key.key_hash = 'hash123';
    key.key_prefix = 'mnfst_abc1';
    key.label = 'default';
    key.tenant_id = 'tenant-1';
    key.agent_id = 'agent-1';
    key.is_active = true;
    key.expires_at = null;
    key.last_used_at = null;
    key.created_at = '2024-01-01T00:00:00Z';

    expect(key.id).toBe('aak-1');
    expect(key.key).toBe('mnfst_abc123');
    expect(key.key_hash).toBe('hash123');
    expect(key.key_prefix).toBe('mnfst_abc1');
    expect(key.label).toBe('default');
    expect(key.is_active).toBe(true);
    expect(key.expires_at).toBeNull();
    expect(key.last_used_at).toBeNull();
  });

  it('allows nullable fields to be null', () => {
    const key = new AgentApiKey();
    key.id = 'aak-2';
    key.key = null;
    key.label = null;
    key.expires_at = null;
    key.last_used_at = null;

    expect(key.key).toBeNull();
    expect(key.label).toBeNull();
    expect(key.expires_at).toBeNull();
    expect(key.last_used_at).toBeNull();
  });

  describe('TypeORM relation callbacks', () => {
    it('ManyToOne callback resolves to Tenant', () => {
      const relations = getMetadataArgsStorage().relations.filter((r) => r.target === AgentApiKey);
      const manyToOne = relations.find((r) => r.relationType === 'many-to-one');
      expect(manyToOne).toBeDefined();
      const resolved = (manyToOne!.type as () => unknown)();
      expect(resolved).toBe(Tenant);
    });

    it('OneToOne callback resolves to Agent with inverse side', () => {
      const relations = getMetadataArgsStorage().relations.filter((r) => r.target === AgentApiKey);
      const oneToOne = relations.find((r) => r.relationType === 'one-to-one');
      expect(oneToOne).toBeDefined();
      const resolved = (oneToOne!.type as () => unknown)();
      expect(resolved).toBe(Agent);

      // Invoke the inverse side callback
      const agent = new Agent();
      agent.apiKey = new AgentApiKey();
      const inverseFn = oneToOne!.inverseSideProperty as (obj: Agent) => unknown;
      expect(inverseFn(agent)).toBe(agent.apiKey);
    });
  });
});
