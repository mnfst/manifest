import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AgentDuplicationService } from './agent-duplication.service';
import { Agent } from '../../entities/agent.entity';
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
      const tierRepo = makeRepoMock('TierAssignment');
      const specRepo = makeRepoMock('SpecificityAssignment');
      const modelParamsRepo = makeRepoMock('AgentModelParams');
      const agentProviderAccessRepo = makeRepoMock('AgentProviderAccess');
      const manager = {
        getRepository: (entity: { name: string }) => {
          switch (entity.name) {
            case 'Agent':
              return agentRepo;
            case 'AgentApiKey':
              return apiKeyRepo;
            case 'TierAssignment':
              return tierRepo;
            case 'SpecificityAssignment':
              return specRepo;
            case 'AgentModelParams':
              return modelParamsRepo;
            case 'AgentProviderAccess':
              return agentProviderAccessRepo;
            default:
              throw new Error(`Unexpected entity ${entity.name}`);
          }
        },
        query: jest.fn(async (sql: string, params: unknown[]) => {
          if (!sql.includes('INSERT INTO "agent_model_params"')) return;
          insertedRows['AgentModelParams'] = insertedRows['AgentModelParams'] ?? [];
          insertedRows['AgentModelParams'].push({
            id: params[0],
            user_id: params[1],
            agent_id: params[2],
            scope_key: params[3],
            provider: params[4],
            auth_type: params[5],
            model_name: params[6],
            params: params[7],
            created_at: params[8],
            updated_at: params[9],
          });
        }),
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
    it('returns grant count for providers and counts of other copyable rows for the source agent', async () => {
      mockAgentGetOne.mockResolvedValueOnce({ id: 'src-1', tenant_id: 't1' });
      repoCounts = {
        AgentProviderAccess: 3,
        TierAssignment: 4,
        SpecificityAssignment: 2,
        AgentModelParams: 5,
      };

      const result = await service.getCopySummary('user-1', 'source-agent');
      expect(result).toEqual({
        providers: 3,
        tierAssignments: 4,
        specificityAssignments: 2,
        modelParams: 5,
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

    it('copies provider access grants verbatim (no new credential rows) for both global and custom providers', async () => {
      // The main correctness test: both a global provider (anthropic) grant and a
      // custom provider grant must be copied pointing at the SAME user_providers rows.
      // No new UserProvider rows, no new CustomProvider rows.
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
        AgentProviderAccess: [
          { agent_id: 'src-1', user_provider_id: 'up-global' },
          { agent_id: 'src-1', user_provider_id: 'up-custom' },
        ],
        TierAssignment: [
          {
            id: 't1',
            user_id: 'u1',
            agent_id: 'src-1',
            tier: 'standard',
            override_route: null,
            auto_assigned_route: null,
            fallback_routes: ['x'],
          },
        ],
        SpecificityAssignment: [
          {
            id: 's1',
            user_id: 'u1',
            agent_id: 'src-1',
            category: 'coding',
            is_active: true,
            override_route: null,
            auto_assigned_route: 'auto',
            fallback_routes: null,
          },
        ],
        AgentModelParams: [
          {
            id: 'mp1',
            user_id: 'u1',
            agent_id: 'src-1',
            provider: 'deepseek',
            auth_type: 'api_key',
            model_name: 'deepseek-v4',
            scope_key: 'tier:default',
            params: { thinking: { type: 'disabled' } },
          },
          // custom-provider-keyed row — provider is copied verbatim (user-global, shared)
          {
            id: 'mp2',
            user_id: 'u1',
            agent_id: 'src-1',
            provider: 'custom:cp1',
            auth_type: 'api_key',
            model_name: 'qwen-72b',
            scope_key: 'tier:default',
            params: { thinking: { type: 'enabled' } },
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
      // 2 grants copied: one for the global provider, one for the custom provider
      expect(result.copied).toEqual({
        providers: 2,
        tierAssignments: 1,
        specificityAssignments: 1,
        modelParams: 2,
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

      // Two grants inserted verbatim — pointing at the original user_provider_id values
      const grants = insertedRows['AgentProviderAccess'] as Array<Record<string, unknown>>;
      expect(grants).toHaveLength(2);
      const globalGrant = grants.find((g) => g['user_provider_id'] === 'up-global');
      expect(globalGrant).toBeDefined();
      expect(globalGrant!['agent_id']).toBe(agentRow['id']);
      const customGrant = grants.find((g) => g['user_provider_id'] === 'up-custom');
      expect(customGrant).toBeDefined();
      expect(customGrant!['agent_id']).toBe(agentRow['id']);

      // Per-route model params: both rows copied verbatim (custom:cp1 NOT remapped)
      const mpRows = insertedRows['AgentModelParams'] as Array<Record<string, unknown>>;
      expect(mpRows).toHaveLength(2);
      const deepseekRow = mpRows.find((r) => r['provider'] === 'deepseek')!;
      expect(deepseekRow['agent_id']).toBe(agentRow['id']);
      expect(deepseekRow['model_name']).toBe('deepseek-v4');
      expect(deepseekRow['params']).toEqual({ thinking: { type: 'disabled' } });
      const customMpRow = mpRows.find((r) => r['provider'] === 'custom:cp1')!;
      expect(customMpRow['provider']).toBe('custom:cp1');
      expect(customMpRow['agent_id']).toBe(agentRow['id']);

      expect(mockInvalidateAgent).toHaveBeenCalledWith(agentRow['id']);
    });

    it('skips insert batches when source has no grants or rows', async () => {
      // Covers the `sourceGrants.length === 0` branch and empty-row branches.
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

      // All repoRows default to [] via makeRepoMock — no explicit setup needed
      const result = await service.duplicate('user-1', 'source', {
        name: 'source-copy',
        displayName: 'source-copy',
      });

      expect(result.copied).toEqual({
        providers: 0,
        tierAssignments: 0,
        specificityAssignments: 0,
        modelParams: 0,
      });
      expect(insertedRows['TierAssignment']).toBeUndefined();
      expect(insertedRows['SpecificityAssignment']).toBeUndefined();
      expect(insertedRows['AgentModelParams']).toBeUndefined();
      expect(insertedRows['AgentProviderAccess']).toBeUndefined();
    });

    it('copies multiple grants pointing at their original user_provider_id values', async () => {
      // Covers copying 3 grants (two custom, one global) all verbatim.
      mockAgentGetOne
        .mockResolvedValueOnce({ id: 'src-1', tenant_id: 't1', name: 'source' })
        .mockResolvedValueOnce(null);

      repoRows = {
        AgentProviderAccess: [
          { agent_id: 'src-1', user_provider_id: 'up1' },
          { agent_id: 'src-1', user_provider_id: 'up2' },
          { agent_id: 'src-1', user_provider_id: 'up3' },
        ],
      };

      const result = await service.duplicate('user-1', 'source', {
        name: 'copy',
        displayName: 'copy',
      });

      const grants = insertedRows['AgentProviderAccess'] as Array<Record<string, unknown>>;
      expect(grants).toHaveLength(3);
      expect(grants.map((g) => g['user_provider_id'])).toEqual(
        expect.arrayContaining(['up1', 'up2', 'up3']),
      );
      expect(result.copied.providers).toBe(3);
    });
  });
});
