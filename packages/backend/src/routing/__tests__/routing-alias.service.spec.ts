import { RoutingAliasService } from '../routing-alias.service';
import type { Repository } from 'typeorm';
import type { Agent } from '../../entities/agent.entity';
import type { TierService } from '../routing-core/tier.service';
import type { SpecificityService } from '../routing-core/specificity.service';
import type { HeaderTierService } from '../header-tiers/header-tier.service';

describe('RoutingAliasService', () => {
  let svc: RoutingAliasService;
  let agentRepo: jest.Mocked<Pick<Repository<Agent>, 'findOne'>>;
  let tierService: jest.Mocked<Pick<TierService, 'getTiers'>>;
  let specificityService: jest.Mocked<Pick<SpecificityService, 'getActiveAssignments'>>;
  let headerTierService: jest.Mocked<Pick<HeaderTierService, 'list'>>;

  beforeEach(() => {
    agentRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'agent-1', complexity_routing_enabled: true }),
    };
    tierService = { getTiers: jest.fn().mockResolvedValue([]) };
    specificityService = { getActiveAssignments: jest.fn().mockResolvedValue([]) };
    headerTierService = { list: jest.fn().mockResolvedValue([]) };
    svc = new RoutingAliasService(
      agentRepo as unknown as Repository<Agent>,
      tierService as unknown as TierService,
      specificityService as unknown as SpecificityService,
      headerTierService as unknown as HeaderTierService,
    );
  });

  it('always includes auto', async () => {
    expect(await svc.listConfiguredAliases('agent-1')).toEqual(['auto']);
  });

  it('includes scoring tier slots when complexity routing is enabled', async () => {
    tierService.getTiers.mockResolvedValue([
      {
        tier: 'simple',
        override_route: { provider: 'openai', authType: 'api_key', model: 'gpt-4o-mini' },
        auto_assigned_route: null,
      },
      {
        tier: 'default',
        override_route: { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
        auto_assigned_route: null,
      },
      {
        tier: 'reasoning',
        override_route: null,
        auto_assigned_route: { provider: 'openai', authType: 'api_key', model: 'o3' },
      },
    ] as never);

    expect(await svc.listConfiguredAliases('agent-1')).toEqual(['auto', 'simple', 'reasoning']);
  });

  it('includes only the default tier when complexity routing is disabled', async () => {
    agentRepo.findOne.mockResolvedValue({
      id: 'agent-1',
      complexity_routing_enabled: false,
    } as Agent);
    tierService.getTiers.mockResolvedValue([
      {
        tier: 'simple',
        override_route: { provider: 'openai', authType: 'api_key', model: 'gpt-4o-mini' },
        auto_assigned_route: null,
      },
      {
        tier: 'default',
        override_route: { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
        auto_assigned_route: null,
      },
    ] as never);

    expect(await svc.listConfiguredAliases('agent-1')).toEqual(['auto', 'default']);
  });

  it('includes active specificity categories with a route only', async () => {
    specificityService.getActiveAssignments.mockResolvedValue([
      {
        category: 'coding',
        is_active: true,
        override_route: { provider: 'anthropic', authType: 'api_key', model: 'claude-sonnet-4' },
        auto_assigned_route: null,
      },
      {
        category: 'web_browsing',
        is_active: true,
        override_route: null,
        auto_assigned_route: null,
      },
    ] as never);

    expect(await svc.listConfiguredAliases('agent-1')).toEqual(['auto', 'coding']);
  });

  it('includes enabled custom tiers with a primary model only', async () => {
    headerTierService.list.mockResolvedValue([
      {
        name: 'Super',
        enabled: true,
        override_route: { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
      },
      { name: 'Draft', enabled: true, override_route: null },
      {
        name: 'Legacy',
        enabled: false,
        override_route: { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
      },
    ] as never);

    expect(await svc.listConfiguredAliases('agent-1')).toEqual(['auto', 'super']);
  });
});
