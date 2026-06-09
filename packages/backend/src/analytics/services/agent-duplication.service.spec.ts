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
      const providerRepo = makeRepoMock('UserProvider');
      const customProviderRepo = makeRepoMock('CustomProvider');
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
            case 'UserProvider':
              return providerRepo;
            case 'CustomProvider':
              return customProviderRepo;
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
        CustomProvider: 1,
        TierAssignment: 4,
        SpecificityAssignment: 2,
        AgentModelParams: 5,
      };

      const result = await service.getCopySummary('user-1', 'source-agent');
      expect(result).toEqual({
        providers: 3,
        customProviders: 1,
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

    it('copies global provider access as a grant (no new credential row) and clones custom companion rows', async () => {
      // The main correctness test: a global provider (anthropic) must produce
      // an AgentProviderAccess grant pointing at the SAME user_providers row,
      // NOT a new cloned credential row.  A custom companion row IS cloned with
      // a remapped `custom:<newId>` and also gets a grant.
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

      // The source has two grants: one to a global provider, one to a custom companion.
      repoRows = {
        AgentProviderAccess: [
          { agent_id: 'src-1', user_provider_id: 'up-global' },
          { agent_id: 'src-1', user_provider_id: 'up-custom' },
        ],
        // UserProvider rows that are loaded by the In() query.
        UserProvider: [
          {
            id: 'up-global',
            user_id: 'u1',
            agent_id: null,
            provider: 'anthropic',
            api_key_encrypted: 'enc',
            key_prefix: 'sk-ant',
            auth_type: 'api_key',
            label: 'Research key',
            priority: 2,
            region: null,
            is_active: true,
            cached_models: [{ id: 'm' }],
            models_fetched_at: null,
          },
          {
            id: 'up-custom',
            user_id: 'u1',
            agent_id: 'src-1',
            provider: 'custom:cp1',
            api_key_encrypted: null,
            key_prefix: null,
            auth_type: 'local',
            label: null,
            priority: 0,
            region: null,
            is_active: true,
            cached_models: null,
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
            api_kind: 'openai',
            models: [],
          },
        ],
        TierAssignment: [
          {
            id: 't1',
            user_id: 'u1',
            agent_id: 'src-1',
            tier: 'standard',
            override_route: {
              provider: 'custom:cp1',
              authType: 'local',
              model: 'custom:cp1/qwen-72b',
            },
            auto_assigned_route: {
              provider: 'custom:cp1',
              authType: 'local',
              model: 'custom:cp1/auto',
            },
            fallback_routes: [
              {
                provider: 'custom:cp1',
                authType: 'local',
                model: 'custom:cp1/fallback',
              },
              {
                provider: 'anthropic',
                authType: 'api_key',
                model: 'anthropic/claude-opus-4-6',
              },
            ],
          },
        ],
        SpecificityAssignment: [
          {
            id: 's1',
            user_id: 'u1',
            agent_id: 'src-1',
            category: 'coding',
            is_active: true,
            override_route: {
              provider: 'custom:cp1',
              authType: 'local',
              model: 'custom:cp1/coding',
            },
            auto_assigned_route: null,
            fallback_routes: [
              {
                provider: 'custom:cp1',
                authType: 'local',
                model: 'custom:cp1/spec-fallback',
              },
            ],
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
          // custom-provider-keyed row exercises the remap path
          {
            id: 'mp2',
            user_id: 'u1',
            agent_id: 'src-1',
            provider: 'custom:cp1',
            auth_type: 'local',
            model_name: 'custom:cp1/qwen-72b',
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
      // 2 grants: 1 for global (anthropic) + 1 for custom companion
      expect(result.copied).toEqual({
        providers: 2,
        customProviders: 1,
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

      // Global provider: no new UserProvider row was cloned for 'anthropic'
      const newCpId = (insertedRows['CustomProvider'] as Array<Record<string, unknown>>)[0][
        'id'
      ] as string;
      const upRows = insertedRows['UserProvider'] as Array<Record<string, unknown>>;
      // Only one UserProvider row should be inserted: the custom companion clone
      expect(upRows).toHaveLength(1);
      expect(upRows[0]['provider']).toBe(`custom:${newCpId}`);
      expect(upRows[0]['agent_id']).toBe(agentRow['id']);

      // Custom routes are cloned onto the new custom provider id, including
      // full `custom:<id>/model` model keys.
      const tierRows = insertedRows['TierAssignment'] as Array<Record<string, unknown>>;
      expect(tierRows).toHaveLength(1);
      expect(tierRows[0]['override_route']).toEqual({
        provider: `custom:${newCpId}`,
        authType: 'local',
        model: `custom:${newCpId}/qwen-72b`,
      });
      expect(tierRows[0]['auto_assigned_route']).toEqual({
        provider: `custom:${newCpId}`,
        authType: 'local',
        model: `custom:${newCpId}/auto`,
      });
      expect(tierRows[0]['fallback_routes']).toEqual([
        {
          provider: `custom:${newCpId}`,
          authType: 'local',
          model: `custom:${newCpId}/fallback`,
        },
        {
          provider: 'anthropic',
          authType: 'api_key',
          model: 'anthropic/claude-opus-4-6',
        },
      ]);

      const specRows = insertedRows['SpecificityAssignment'] as Array<Record<string, unknown>>;
      expect(specRows).toHaveLength(1);
      expect(specRows[0]['override_route']).toEqual({
        provider: `custom:${newCpId}`,
        authType: 'local',
        model: `custom:${newCpId}/coding`,
      });
      expect(specRows[0]['fallback_routes']).toEqual([
        {
          provider: `custom:${newCpId}`,
          authType: 'local',
          model: `custom:${newCpId}/spec-fallback`,
        },
      ]);

      // Two grants must be inserted: one pointing at the global row's original
      // id, and one pointing at the freshly-cloned custom companion row.
      const grants = insertedRows['AgentProviderAccess'] as Array<Record<string, unknown>>;
      expect(grants).toHaveLength(2);
      const globalGrant = grants.find((g) => g['user_provider_id'] === 'up-global');
      expect(globalGrant).toBeDefined();
      expect(globalGrant!['agent_id']).toBe(agentRow['id']);
      const customGrant = grants.find((g) => g['user_provider_id'] !== 'up-global');
      expect(customGrant).toBeDefined();
      expect(customGrant!['agent_id']).toBe(agentRow['id']);
      // The custom grant points at the new companion row (not the old up-custom id)
      expect(customGrant!['user_provider_id']).not.toBe('up-custom');

      // Per-route model params: deepseek row copies verbatim, custom:cp1 remaps
      const mpRows = insertedRows['AgentModelParams'] as Array<Record<string, unknown>>;
      expect(mpRows).toHaveLength(2);
      const deepseekRow = mpRows.find((r) => r['provider'] === 'deepseek')!;
      expect(deepseekRow['agent_id']).toBe(agentRow['id']);
      expect(deepseekRow['model_name']).toBe('deepseek-v4');
      expect(deepseekRow['params']).toEqual({ thinking: { type: 'disabled' } });
      const customMpRow = mpRows.find((r) => String(r['provider']).startsWith('custom:'))!;
      expect(customMpRow['provider']).toBe(`custom:${newCpId}`);
      expect(customMpRow['model_name']).toBe(`custom:${newCpId}/qwen-72b`);
      expect(customMpRow['agent_id']).toBe(agentRow['id']);

      expect(mockInvalidateAgent).toHaveBeenCalledWith(agentRow['id']);
    });

    it('copies api_kind field for custom providers', async () => {
      mockAgentGetOne
        .mockResolvedValueOnce({ id: 'src-1', tenant_id: 't1', name: 'source' })
        .mockResolvedValueOnce(null);

      repoRows = {
        CustomProvider: [
          {
            id: 'cp1',
            agent_id: 'src-1',
            user_id: 'u1',
            name: 'my-server',
            base_url: 'http://x',
            api_kind: 'anthropic',
            models: [{ model_name: 'test' }],
          },
        ],
      };

      await service.duplicate('user-1', 'source', {
        name: 'copy',
        displayName: 'copy',
      });

      const cpRow = (insertedRows['CustomProvider'] as Array<Record<string, unknown>>)[0];
      expect(cpRow['api_kind']).toBe('anthropic');
    });

    it('remaps custom:<uuid> references in user providers to new custom provider IDs', async () => {
      // Source has a grant to a custom companion row.  After duplication the
      // new agent should receive a NEW cloned companion row with
      // provider = custom:<newId>, and a grant to that new row.
      mockAgentGetOne
        .mockResolvedValueOnce({ id: 'src-1', tenant_id: 't1', name: 'source' })
        .mockResolvedValueOnce(null);

      repoRows = {
        AgentProviderAccess: [{ agent_id: 'src-1', user_provider_id: 'up1' }],
        CustomProvider: [
          {
            id: 'old-cp-uuid',
            agent_id: 'src-1',
            user_id: 'u1',
            name: 'LM Studio',
            base_url: 'http://localhost:1234',
            api_kind: 'openai',
            models: [],
          },
        ],
        UserProvider: [
          {
            id: 'up1',
            user_id: 'u1',
            agent_id: 'src-1',
            provider: 'custom:old-cp-uuid',
            api_key_encrypted: null,
            key_prefix: null,
            auth_type: 'local',
            region: null,
            is_active: true,
            cached_models: null,
            models_fetched_at: null,
          },
        ],
      };

      await service.duplicate('user-1', 'source', {
        name: 'copy',
        displayName: 'copy',
      });

      const cpRow = (insertedRows['CustomProvider'] as Array<Record<string, unknown>>)[0];
      const newCpId = cpRow['id'] as string;
      expect(newCpId).not.toBe('old-cp-uuid');

      // Custom companion row is cloned with remapped provider key
      const upRow = (insertedRows['UserProvider'] as Array<Record<string, unknown>>)[0];
      expect(upRow['provider']).toBe(`custom:${newCpId}`);
      expect(upRow['auth_type']).toBe('local');

      // A grant is created for the new custom companion row
      const grants = insertedRows['AgentProviderAccess'] as Array<Record<string, unknown>>;
      expect(grants).toHaveLength(1);
      expect(grants[0]['user_provider_id']).toBe(upRow['id']);
    });

    it('skips a custom companion grant when the custom provider id is not in the map', async () => {
      // This covers the `if (!newCustomId) continue;` branch: the source agent
      // has a grant to a custom: user_providers row whose custom provider ID
      // does NOT appear in customProviderIdMap (orphaned grant).  The copy must
      // skip it without crashing.
      // Also covers the fallback branch of remapCustomProviderRef (returns the
      // original provider string when the custom id is not in the map) via a
      // model_params row that references the same orphaned custom id.
      mockAgentGetOne
        .mockResolvedValueOnce({ id: 'src-1', tenant_id: 't1', name: 'source' })
        .mockResolvedValueOnce(null);

      repoRows = {
        AgentProviderAccess: [{ agent_id: 'src-1', user_provider_id: 'up-orphan' }],
        // No CustomProvider rows — so customProviderIdMap is empty
        CustomProvider: [],
        UserProvider: [
          {
            id: 'up-orphan',
            user_id: 'u1',
            agent_id: 'src-1',
            // Provider references a custom id that no longer exists in custom_providers
            provider: 'custom:deleted-cp-id',
            api_key_encrypted: null,
            key_prefix: null,
            auth_type: 'local',
            region: null,
            is_active: true,
            cached_models: null,
            models_fetched_at: null,
          },
        ],
        // A model_params row referencing the same orphaned custom id exercises the
        // fallback arm of remapCustomProviderRef (newId not found → return original).
        AgentModelParams: [
          {
            id: 'mp-orphan',
            user_id: 'u1',
            agent_id: 'src-1',
            provider: 'custom:deleted-cp-id',
            auth_type: 'local',
            model_name: 'some-model',
            scope_key: 'tier:default',
            params: {},
          },
        ],
      };

      const result = await service.duplicate('user-1', 'source', {
        name: 'copy',
        displayName: 'copy',
      });

      // The orphaned grant is skipped: no UserProvider cloned, no grant inserted
      expect(insertedRows['UserProvider']).toBeUndefined();
      expect(insertedRows['AgentProviderAccess']).toBeUndefined();
      // providers count = number of newGrants created = 0 (skipped)
      expect(result.copied.providers).toBe(0);

      // The model_params row is still copied but with the original (unmapped)
      // provider string because remapCustomProviderRef falls back gracefully.
      const mpRows = insertedRows['AgentModelParams'] as Array<Record<string, unknown>>;
      expect(mpRows).toHaveLength(1);
      expect(mpRows[0]['provider']).toBe('custom:deleted-cp-id');
    });

    it('copies global (non-custom) providers as grants pointing at the same user_providers id', async () => {
      // Covers the `else` branch (global provider): grant points at original row id.
      mockAgentGetOne
        .mockResolvedValueOnce({ id: 'src-1', tenant_id: 't1', name: 'source' })
        .mockResolvedValueOnce(null);

      repoRows = {
        AgentProviderAccess: [
          { agent_id: 'src-1', user_provider_id: 'up-openai' },
          { agent_id: 'src-1', user_provider_id: 'up-anthropic' },
        ],
        UserProvider: [
          {
            id: 'up-openai',
            user_id: 'u1',
            agent_id: null,
            provider: 'openai',
            api_key_encrypted: 'enc-openai',
            key_prefix: 'sk-',
            auth_type: 'api_key',
            label: null,
            priority: 0,
            region: null,
            is_active: true,
            cached_models: null,
            models_fetched_at: null,
          },
          {
            id: 'up-anthropic',
            user_id: 'u1',
            agent_id: null,
            provider: 'anthropic',
            api_key_encrypted: 'enc-anth',
            key_prefix: 'sk-ant',
            auth_type: 'subscription',
            label: null,
            priority: 0,
            region: null,
            is_active: true,
            cached_models: null,
            models_fetched_at: null,
          },
        ],
      };

      const result = await service.duplicate('user-1', 'source', {
        name: 'copy',
        displayName: 'copy',
      });

      // No new UserProvider rows — global credentials are shared
      expect(insertedRows['UserProvider']).toBeUndefined();

      // Two grants inserted, pointing at the original ids
      const grants = insertedRows['AgentProviderAccess'] as Array<Record<string, unknown>>;
      expect(grants).toHaveLength(2);
      const upIds = grants.map((g) => g['user_provider_id']);
      expect(upIds).toContain('up-openai');
      expect(upIds).toContain('up-anthropic');

      expect(result.copied.providers).toBe(2);
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
        customProviders: 0,
        tierAssignments: 0,
        specificityAssignments: 0,
        modelParams: 0,
      });
      expect(insertedRows['UserProvider']).toBeUndefined();
      expect(insertedRows['CustomProvider']).toBeUndefined();
      expect(insertedRows['TierAssignment']).toBeUndefined();
      expect(insertedRows['SpecificityAssignment']).toBeUndefined();
      expect(insertedRows['AgentModelParams']).toBeUndefined();
      expect(insertedRows['AgentProviderAccess']).toBeUndefined();
    });

    it('remaps multiple custom providers correctly', async () => {
      mockAgentGetOne
        .mockResolvedValueOnce({ id: 'src-1', tenant_id: 't1', name: 'source' })
        .mockResolvedValueOnce(null);

      repoRows = {
        AgentProviderAccess: [
          { agent_id: 'src-1', user_provider_id: 'up1' },
          { agent_id: 'src-1', user_provider_id: 'up2' },
          { agent_id: 'src-1', user_provider_id: 'up3' },
        ],
        CustomProvider: [
          {
            id: 'cp-lms',
            agent_id: 'src-1',
            user_id: 'u1',
            name: 'LM Studio',
            base_url: 'http://localhost:1234',
            api_kind: 'openai',
            models: [],
          },
          {
            id: 'cp-llama',
            agent_id: 'src-1',
            user_id: 'u1',
            name: 'llama.cpp',
            base_url: 'http://localhost:8080',
            api_kind: 'openai',
            models: [{ model_name: 'mistral' }],
          },
        ],
        UserProvider: [
          {
            id: 'up1',
            user_id: 'u1',
            agent_id: 'src-1',
            provider: 'custom:cp-lms',
            api_key_encrypted: null,
            key_prefix: null,
            auth_type: 'local',
            region: null,
            is_active: true,
            cached_models: null,
            models_fetched_at: null,
          },
          {
            id: 'up2',
            user_id: 'u1',
            agent_id: 'src-1',
            provider: 'custom:cp-llama',
            api_key_encrypted: null,
            key_prefix: null,
            auth_type: 'local',
            region: null,
            is_active: true,
            cached_models: null,
            models_fetched_at: null,
          },
          {
            id: 'up3',
            user_id: 'u1',
            agent_id: 'src-1',
            provider: 'anthropic',
            api_key_encrypted: 'enc',
            key_prefix: 'sk-',
            auth_type: 'api_key',
            region: null,
            is_active: true,
            cached_models: null,
            models_fetched_at: null,
          },
        ],
      };

      const result = await service.duplicate('user-1', 'source', {
        name: 'copy',
        displayName: 'copy',
      });

      // Two custom providers cloned
      const cps = insertedRows['CustomProvider'] as Array<Record<string, unknown>>;
      expect(cps).toHaveLength(2);
      const lmsNewId = cps.find((c) => c['name'] === 'LM Studio')!['id'] as string;
      const llamaNewId = cps.find((c) => c['name'] === 'llama.cpp')!['id'] as string;

      // Two UserProvider companion rows cloned (only custom ones); global anthropic is NOT cloned
      const ups = insertedRows['UserProvider'] as Array<Record<string, unknown>>;
      expect(ups).toHaveLength(2);

      const lmsUp = ups.find((u) => (u['provider'] as string).includes(lmsNewId));
      expect(lmsUp).toBeDefined();
      expect(lmsUp!['provider']).toBe(`custom:${lmsNewId}`);

      const llamaUp = ups.find((u) => (u['provider'] as string).includes(llamaNewId));
      expect(llamaUp).toBeDefined();
      expect(llamaUp!['provider']).toBe(`custom:${llamaNewId}`);

      // Three grants inserted: two for custom companions, one for global anthropic
      const grants = insertedRows['AgentProviderAccess'] as Array<Record<string, unknown>>;
      expect(grants).toHaveLength(3);

      // The anthropic grant points at the original user_provider id (up3)
      const anthGrant = grants.find((g) => g['user_provider_id'] === 'up3');
      expect(anthGrant).toBeDefined();

      expect(result.copied.providers).toBe(3);
    });
  });
});
