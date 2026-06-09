import { getMetadataArgsStorage } from 'typeorm';
import { AgentProviderAccess } from './agent-provider-access.entity';
import { Agent } from './agent.entity';
import { UserProvider } from './user-provider.entity';

describe('AgentProviderAccess entity', () => {
  it('creates an instance with both key columns', () => {
    const access = new AgentProviderAccess();
    access.agent_id = 'agent-1';
    access.user_provider_id = 'provider-1';

    expect(access.agent_id).toBe('agent-1');
    expect(access.user_provider_id).toBe('provider-1');
  });

  it('declares cascade relations to agents and user providers', () => {
    const relations = getMetadataArgsStorage().relations.filter(
      (r) => r.target === AgentProviderAccess,
    );

    const agentRelation = relations.find((r) => r.propertyName === 'agent');
    expect(agentRelation).toBeDefined();
    expect(agentRelation!.relationType).toBe('many-to-one');
    expect((agentRelation!.type as () => unknown)()).toBe(Agent);
    expect(agentRelation!.options.onDelete).toBe('CASCADE');

    const providerRelation = relations.find((r) => r.propertyName === 'userProvider');
    expect(providerRelation).toBeDefined();
    expect(providerRelation!.relationType).toBe('many-to-one');
    expect((providerRelation!.type as () => unknown)()).toBe(UserProvider);
    expect(providerRelation!.options.onDelete).toBe('CASCADE');
  });
});
