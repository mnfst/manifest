import { getMetadataArgsStorage } from 'typeorm';
import { AgentEnabledProvider } from './agent-enabled-provider.entity';
import { Agent } from './agent.entity';
import { TenantProvider } from './tenant-provider.entity';

describe('AgentEnabledProvider entity', () => {
  it('creates an instance with both key columns', () => {
    const access = new AgentEnabledProvider();
    access.agent_id = 'agent-1';
    access.tenant_provider_id = 'provider-1';

    expect(access.agent_id).toBe('agent-1');
    expect(access.tenant_provider_id).toBe('provider-1');
  });

  it('declares cascade relations to agents and tenant providers', () => {
    const relations = getMetadataArgsStorage().relations.filter(
      (r) => r.target === AgentEnabledProvider,
    );

    const agentRelation = relations.find((r) => r.propertyName === 'agent');
    expect(agentRelation).toBeDefined();
    expect(agentRelation!.relationType).toBe('many-to-one');
    expect((agentRelation!.type as () => unknown)()).toBe(Agent);
    expect(agentRelation!.options.onDelete).toBe('CASCADE');

    const providerRelation = relations.find((r) => r.propertyName === 'tenantProvider');
    expect(providerRelation).toBeDefined();
    expect(providerRelation!.relationType).toBe('many-to-one');
    expect((providerRelation!.type as () => unknown)()).toBe(TenantProvider);
    expect(providerRelation!.options.onDelete).toBe('CASCADE');
  });
});
