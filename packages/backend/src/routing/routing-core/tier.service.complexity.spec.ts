import { TierService } from './tier.service';
import { RoutingCacheService } from './routing-cache.service';

function makeRepo() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(),
    insert: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  };
}

describe('TierService — complexity flag', () => {
  let agentRepo: ReturnType<typeof makeRepo>;
  let cache: Partial<RoutingCacheService> & {
    getComplexityEnabled: jest.Mock;
    setComplexityEnabled: jest.Mock;
    invalidateAgent: jest.Mock;
  };
  let service: TierService;

  beforeEach(() => {
    agentRepo = makeRepo();
    cache = {
      getComplexityEnabled: jest.fn().mockReturnValue(undefined),
      setComplexityEnabled: jest.fn(),
      invalidateAgent: jest.fn(),
    };
    service = new TierService(
      makeRepo() as never,
      makeRepo() as never,
      agentRepo as never,
      {} as never,
      cache as unknown as RoutingCacheService,
      {} as never,
      {} as never,
    );
  });

  describe('isComplexityEnabled', () => {
    it('reads through the cache when a value is present', async () => {
      cache.getComplexityEnabled.mockReturnValue(true);
      const enabled = await service.isComplexityEnabled('agent-1');
      expect(enabled).toBe(true);
      expect(agentRepo.findOne).not.toHaveBeenCalled();
    });

    it('falls back to the DB and caches the result on a miss', async () => {
      agentRepo.findOne.mockResolvedValue({ id: 'agent-1', complexity_routing_enabled: true });
      const enabled = await service.isComplexityEnabled('agent-1');
      expect(enabled).toBe(true);
      expect(agentRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'agent-1' },
        select: ['id', 'complexity_routing_enabled'],
      });
      expect(cache.setComplexityEnabled).toHaveBeenCalledWith('agent-1', true);
    });

    it('defaults to false when the agent row is missing', async () => {
      agentRepo.findOne.mockResolvedValue(null);
      const enabled = await service.isComplexityEnabled('agent-1');
      expect(enabled).toBe(false);
      expect(cache.setComplexityEnabled).toHaveBeenCalledWith('agent-1', false);
    });
  });

  describe('setComplexityEnabled', () => {
    it('updates the agent row and invalidates cache', async () => {
      await service.setComplexityEnabled('agent-1', true);
      expect(agentRepo.update).toHaveBeenCalledWith(
        { id: 'agent-1' },
        { complexity_routing_enabled: true },
      );
      expect(cache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });
  });
});
