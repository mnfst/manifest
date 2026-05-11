import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AgentModelParams } from '../../../entities/agent-model-params.entity';
import { AgentModelParamsService } from '../agent-model-params.service';
import { RoutingCacheService } from '../routing-cache.service';

describe('AgentModelParamsService', () => {
  let service: AgentModelParamsService;
  // Repository<T>.create has overloaded signatures (no-arg, one-arg, array) that
  // are awkward to mock with `jest.Mocked<Pick<…>>`. Type the repo loosely so
  // the constructor accepts our test double; runtime behavior is what we care
  // about here, not the precise overload set.
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  let cache: {
    getModelParams: jest.Mock;
    setModelParams: jest.Mock;
    invalidateModelParams: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((entity) => entity as AgentModelParams),
      delete: jest.fn(),
    };
    cache = {
      getModelParams: jest.fn().mockReturnValue(null),
      setModelParams: jest.fn(),
      invalidateModelParams: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentModelParamsService,
        { provide: getRepositoryToken(AgentModelParams), useValue: repo },
        { provide: RoutingCacheService, useValue: cache },
      ],
    }).compile();

    service = module.get<AgentModelParamsService>(AgentModelParamsService);
  });

  describe('list', () => {
    it('returns the cached rows when present (no DB hit)', async () => {
      const cached = [{ id: '1' } as AgentModelParams];
      cache.getModelParams.mockReturnValueOnce(cached);

      const result = await service.list('agent-1');

      expect(result).toBe(cached);
      expect(repo.find).not.toHaveBeenCalled();
    });

    it('hits the DB and caches the result on a miss', async () => {
      const rows = [{ id: '1' } as AgentModelParams];
      repo.find.mockResolvedValueOnce(rows);

      const result = await service.list('agent-1');

      expect(repo.find).toHaveBeenCalledWith({ where: { agent_id: 'agent-1' } });
      expect(cache.setModelParams).toHaveBeenCalledWith('agent-1', rows);
      expect(result).toBe(rows);
    });
  });

  describe('get', () => {
    it('returns the matching row params (case-insensitive provider match)', async () => {
      const rows = [
        {
          provider: 'DeepSeek',
          auth_type: 'api_key',
          model_name: 'deepseek-v4',
          params: { thinking: { type: 'disabled' } },
        } as unknown as AgentModelParams,
      ];
      repo.find.mockResolvedValueOnce(rows);

      const result = await service.get('agent-1', 'deepseek', 'api_key', 'deepseek-v4');

      expect(result).toEqual({ thinking: { type: 'disabled' } });
    });

    it('returns null when no row matches (steady state for most attempts)', async () => {
      repo.find.mockResolvedValueOnce([]);
      const result = await service.get('agent-1', 'openai', 'api_key', 'gpt-4o');
      expect(result).toBeNull();
    });

    it('matches on full (provider, auth_type, model_name) tuple — same model under different auth is distinct', async () => {
      const rows = [
        {
          provider: 'openai',
          auth_type: 'subscription',
          model_name: 'gpt-4o',
          params: { thinking: { type: 'enabled' } },
        } as unknown as AgentModelParams,
      ];
      repo.find.mockResolvedValueOnce(rows);

      // Same model, different auth_type → no match
      expect(await service.get('agent-1', 'openai', 'api_key', 'gpt-4o')).toBeNull();
    });
  });

  describe('set', () => {
    it('updates the existing row when one is present, invalidates cache', async () => {
      const existing = {
        params: { thinking: { type: 'enabled' } },
      } as AgentModelParams;
      repo.findOne.mockResolvedValueOnce(existing);
      repo.save.mockResolvedValueOnce({
        ...existing,
        params: { thinking: { type: 'disabled' } },
      } as AgentModelParams);

      const result = await service.set('agent-1', 'user-1', 'DeepSeek', 'api_key', 'deepseek-v4', {
        thinking: { type: 'disabled' },
      });

      expect(repo.findOne).toHaveBeenCalledWith({
        where: {
          agent_id: 'agent-1',
          provider: 'deepseek',
          auth_type: 'api_key',
          model_name: 'deepseek-v4',
        },
      });
      expect(existing.params).toEqual({ thinking: { type: 'disabled' } });
      expect(cache.invalidateModelParams).toHaveBeenCalledWith('agent-1');
      expect(result.params).toEqual({ thinking: { type: 'disabled' } });
    });

    it('inserts a new row when none exists', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      repo.save.mockImplementation(async (row) => row as AgentModelParams);

      const result = await service.set('agent-1', 'user-1', 'DeepSeek', 'api_key', 'deepseek-v4', {
        thinking: { type: 'disabled' },
      });

      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
      expect(result.provider).toBe('deepseek');
      expect(result.params).toEqual({ thinking: { type: 'disabled' } });
      expect(cache.invalidateModelParams).toHaveBeenCalledWith('agent-1');
    });
  });

  describe('delete', () => {
    it('removes the row and invalidates the agent cache', async () => {
      await service.delete('agent-1', 'DeepSeek', 'api_key', 'deepseek-v4');
      expect(repo.delete).toHaveBeenCalledWith({
        agent_id: 'agent-1',
        provider: 'deepseek',
        auth_type: 'api_key',
        model_name: 'deepseek-v4',
      });
      expect(cache.invalidateModelParams).toHaveBeenCalledWith('agent-1');
    });
  });
});
