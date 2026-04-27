import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AgentDuplicationService } from './agent-duplication.service';
import { Agent } from '../../entities/agent.entity';
import { AgentApiKey } from '../../entities/agent-api-key.entity';
import { UserProvider } from '../../entities/user-provider.entity';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import { SpecificityAssignment } from '../../entities/specificity-assignment.entity';
import { RoutingCacheService } from '../../routing/routing-core/routing-cache.service';

process.env['BETTER_AUTH_SECRET'] = 'a'.repeat(64);

describe('AgentDuplicationService', () => {
  let service: AgentDuplicationService;
  let mockAgentGetOne: jest.Mock;
  let mockAgentGetRawMany: jest.Mock;
  let mockAgentQb: Record<string, jest.Mock>;
  let mockTransaction: jest.Mock;
  let mockInvalidateAgent: jest.Mock;
  let repoCounts: Record<string, number>;
  let repoRows: Record<string, unknown[]>;
  let countMock: jest.Mock;
  let insertedRows: Record<string, unknown[]>;

  const makeRepoMock = (entityName: string) => ({
    find: jest.fn(async () => repoRows[entityName] ?? []),
    count: jest.fn(async () => repoCounts[entityName] ?? 0),
    insert: jest.fn(async (rows: unknown[] | unknown) => {
      insertedRows[entityName] = insertedRows[entityName] ?? [];
      if (Array.isArray(rows)) insertedRows[entityName].push(...rows);
      else insertedRows[entityName].push(rows);
    }),
  });

  beforeEach(async () => {
    insertedRows = {};
    repoRows = {};
    repoCounts = {};
    mockAgentGetOne = jest.fn().mockResolvedValue(null);
    mockAgentGetRawMany = jest.fn().mockResolvedValue([]);
    countMock = jest.fn(async () => 0);

    mockAgentQb = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getOne: mockAgentGetOne,
      getRawMany: mockAgentGetRawMany,
    };

    mockInvalidateAgent = jest.fn();

    mockTransaction = jest.fn(async (cb: (manager: unknown) => unknown) => {
      const agentRepo = makeRepoMock('Agent');
      const apiKeyRepo = makeRepoMock('AgentApiKey');
      const providerRepo = makeRepoMock('UserProvider');
      const customProviderRepo = makeRepoMock('CustomProvider');
      const tierRepo = makeRepoMock('TierAssignment');
      const specRepo = makeRepoMock('SpecificityAssignment');
      const manager = {
        getRepository: (entity: { name: string }) => {
          switch (entity.name) {
            case 'Agent':
              return agentRepo;
            case 'AgentApiKey':
              return apiKeyRepo;
            case 'UserProvider':
              return providerRepo;
            case 'CustomProvider':
              return customProviderRepo;
            case 'TierAssignment':
              return tierRepo;
            case 'SpecificityAssignment':
              return specRepo;
            default:
              throw new Error(`Unexpected entity ${entity.name}`);
          }
        },
      };
      return cb(manager);
    });

    const dataSourceMock = {
      transaction: mockTransaction,
      getRepository: (entity: { name: string }) => ({
        count: jest.fn(async (args: unknown) => {
          const res = countMock(entity.name, args);
          if (typeof res === 'number') return res;
          return repoCounts[entity.name] ?? 0;
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentDuplicationService,
        {
          provide: getRepositoryToken(Agent),
          useValue: { createQueryBuilder: jest.fn(() => mockAgentQb) },
        },
        { provide: DataSource, useValue: dataSourceMock },
        {
          provide: RoutingCacheService,
          useValue: { invalidateAgent: mockInvalidateAgent },
        },
      ],
    }).compile();

    service = module.get<AgentDuplicationService>(AgentDuplicationService);
  });

  describe('getCopySummary', () => {
    it('returns counts of copyable rows for the source agent', async () => {
      mockAgentGetOne.mockResolvedValueOnce({ id: 'src-1', tenant_id: 't1' });
      repoCounts = {
        UserProvider: 3,
        CustomProvider: 1,
        TierAssignment: 4,
        SpecificityAssignment: 2,
      };

      const result = await service.getCopySummary('user-1', 'source-agent');
      expect(result).toEqual({
        providers: 3,
        customProviders: 1,
        tierAssignments: 4,
        specificityAssignments: 2,
      });
    });

    it('throws NotFoundException when source agent is missing', async () => {
      mockAgentGetOne.mockResolvedValueOnce(null);
      await expect(service.getCopySummary('user-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('suggestName', () => {
    it('returns "<name>-copy" when unused', async () => {
      mockAgentGetOne.mockResolvedValueOnce({ id: 'src-1' });
      mockAgentGetRawMany.mockResolvedValueOnce([{ name: 'source' }]);
      const result = await service.suggestName('user-1', 'source');
      expect(result).toBe('source-copy');
    });

    it('increments suffix when copy name is taken', async () => {
      mockAgentGetOne.mockResolvedValueOnce({ id: 'src-1' });
      mockAgentGetRawMany.mockResolvedValueOnce([
        { name: 'source' },
        { name: 'source-copy' },
        { name: 'source-copy-2' },
      ]);
      const result = await service.suggestName('user-1', 'source');
      expect(result).toBe('source-copy-3');
    });

    it('throws NotFoundException when agent missing', async () => {
      mockAgentGetOne.mockResolvedValueOnce(null);
      await expect(service.suggestName('user-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('falls back to a timestamp suffix when all preset suffixes collide', async () => {
      mockAgentGetOne.mockResolvedValueOnce({ id: 'src-1' });
      const names: { name: string }[] = [{ name: 'source-copy' }];
      for (let i = 2; i <= 999; i++) names.push({ name: `source-copy-${i}` });
      mockAgentGetRawMany.mockResolvedValueOnce(names);

      const result = await service.suggestName('user-1', 'source');
      expect(result).toMatch(/^source-copy-\d+$/);
      expect(result).not.toBe('source-copy-999');
    });
  });

  describe('duplicate', () => {
    it('throws NotFoundException when source does not exist', async () => {
      mockAgentGetOne.mockResolvedValueOnce(null);
      await expect(
        service.duplicate('user-1', 'missing', { name: 'copy', displayName: 'copy' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when new name already exists', async () => {
      mockAgentGetOne
        .mockResolvedValueOnce({ id: 'src-1', tenant_id: 't1' })
        .mockResolvedValueOnce({ id: 'clash', tenant_id: 't1' });
      await expect(
        service.duplicate('user-1', 'src', { name: 'clash', displayName: 'clash' }),
      ).rejects.toThrow(ConflictException);
    });

    it('duplicates the agent, api key, and all config rows in a transaction', async () => {
      mockAgentGetOne
        .mockResolvedValueOnce({
          id: 'src-1',
          tenant_id: 't1',
          name: 'source',
          description: 'a desc',
          agent_category: 'personal',
          agent_platform: 'openclaw',
          complexity_routing_enabled: true,
        })
        .mockResolvedValueOnce(null);

      repoRows = {
        UserProvider: [
          {
            id: 'up1',
            user_id: 'u1',
            agent_id: 'src-1',
            provider: 'anthropic',
            api_key_encrypted: 'enc',
            key_prefix: 'sk-',
            auth_type: 'api_key',
            region: null,
            is_active: true,
            cached_models: [{ id: 'm' }],
            models_fetched_at: null,
          },
        ],
        CustomProvider: [
          {
            id: 'cp1',
            agent_id: 'src-1',
            user_id: 'u1',
            name: 'local',
            base_url: 'http://x',
            models: [],
          },
        ],
        TierAssignment: [
          {
            id: 't1',
            user_id: 'u1',
            agent_id: 'src-1',
            tier: 'standard',
            override_model: 'm',
            override_provider: 'anthropic',
            override_auth_type: 'api_key',
            auto_assigned_model: null,
            fallback_models: ['x'],
          },
        ],
        SpecificityAssignment: [
          {
            id: 's1',
            user_id: 'u1',
            agent_id: 'src-1',
            category: 'coding',
            is_active: true,
            override_model: null,
            override_provider: null,
            override_auth_type: null,
            auto_assigned_model: 'auto',
            fallback_models: null,
          },
        ],
      };

      const result = await service.duplicate('user-1', 'source', {
        name: 'source-copy',
        displayName: 'source-copy',
      });

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(result.agentName).toBe('source-copy');
      expect(result.apiKey).toMatch(/^mnfst_/);
      expect(result.copied).toEqual({
        providers: 1,
        customProviders: 1,
        tierAssignments: 1,
        specificityAssignments: 1,
      });

      expect(insertedRows['Agent']).toHaveLength(1);
      const [agentRow] = insertedRows['Agent'] as Array<Record<string, unknown>>;
      expect(agentRow['name']).toBe('source-copy');
      expect(agentRow['tenant_id']).toBe('t1');
      expect(agentRow['agent_category']).toBe('personal');
      expect(agentRow['complexity_routing_enabled']).toBe(true);

      expect(insertedRows['AgentApiKey']).toHaveLength(1);
      const [apiKeyRow] = insertedRows['AgentApiKey'] as Array<Record<string, unknown>>;
      expect(apiKeyRow['agent_id']).toBe(agentRow['id']);
      expect(apiKeyRow['label']).toContain('source-copy');

      const userProviderRow = (insertedRows['UserProvider'] as Array<Record<string, unknown>>)[0];
      expect(userProviderRow['agent_id']).toBe(agentRow['id']);
      expect(userProviderRow['api_key_encrypted']).toBe('enc');
      expect(userProviderRow['id']).not.toBe('up1');

      expect(mockInvalidateAgent).toHaveBeenCalledWith(agentRow['id']);
    });

    it('skips insert batches when source has no rows', async () => {
      mockAgentGetOne
        .mockResolvedValueOnce({
          id: 'src-1',
          tenant_id: 't1',
          name: 'source',
          description: null,
          agent_category: null,
          agent_platform: null,
        })
        .mockResolvedValueOnce(null);

      const result = await service.duplicate('user-1', 'source', {
        name: 'source-copy',
        displayName: 'source-copy',
      });

      expect(result.copied).toEqual({
        providers: 0,
        customProviders: 0,
        tierAssignments: 0,
        specificityAssignments: 0,
      });
      expect(insertedRows['UserProvider']).toBeUndefined();
      expect(insertedRows['CustomProvider']).toBeUndefined();
      expect(insertedRows['TierAssignment']).toBeUndefined();
      expect(insertedRows['SpecificityAssignment']).toBeUndefined();
    });
  });
});
