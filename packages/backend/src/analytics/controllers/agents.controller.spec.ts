import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER, CacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { AgentsController } from './agents.controller';
import { TimeseriesQueriesService } from '../services/timeseries-queries.service';
import { AgentLifecycleService } from '../services/agent-lifecycle.service';
import { AgentDuplicationService } from '../services/agent-duplication.service';
import { ApiKeyGeneratorService } from '../../otlp/services/api-key.service';
import { TenantCacheService } from '../../common/services/tenant-cache.service';
import { IngestEventBusService } from '../../common/services/ingest-event-bus.service';

describe('AgentsController', () => {
  let controller: AgentsController;
  let cacheManager: Cache;
  let mockGetAgentList: jest.Mock;
  let mockGetKeyForAgent: jest.Mock;
  let mockRotateKey: jest.Mock;
  let mockConfigGet: jest.Mock;
  let mockDeleteAgent: jest.Mock;
  let mockRenameAgent: jest.Mock;
  let mockTenantResolve: jest.Mock;
  let mockDuplicate: jest.Mock;
  let mockGetCopySummary: jest.Mock;
  let mockSuggestName: jest.Mock;

  beforeEach(async () => {
    mockGetAgentList = jest.fn().mockResolvedValue([
      { agent_name: 'bot-1', agent_id: 'id-1', message_count: 100 },
      { agent_name: 'bot-2', agent_id: 'id-2', message_count: 50 },
    ]);
    mockGetKeyForAgent = jest.fn().mockResolvedValue({ keyPrefix: 'mnfst_test1234' });
    mockRotateKey = jest.fn().mockResolvedValue({ apiKey: 'mnfst_new_key_123' });
    mockConfigGet = jest.fn().mockReturnValue('');
    mockDeleteAgent = jest.fn().mockResolvedValue(undefined);
    mockRenameAgent = jest.fn().mockResolvedValue(undefined);
    mockTenantResolve = jest.fn().mockResolvedValue('tenant-123');
    mockDuplicate = jest.fn().mockResolvedValue({
      agentId: 'new-id',
      agentName: 'bot-copy',
      displayName: 'bot-copy',
      apiKey: 'mnfst_new',
      copied: { providers: 1, customProviders: 0, tierAssignments: 2, specificityAssignments: 0 },
    });
    mockGetCopySummary = jest.fn().mockResolvedValue({
      providers: 1,
      customProviders: 0,
      tierAssignments: 2,
      specificityAssignments: 0,
    });
    mockSuggestName = jest.fn().mockResolvedValue('bot-copy');

    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [AgentsController],
      providers: [
        {
          provide: TimeseriesQueriesService,
          useValue: { getAgentList: mockGetAgentList },
        },
        {
          provide: AgentLifecycleService,
          useValue: {
            deleteAgent: mockDeleteAgent,
            renameAgent: mockRenameAgent,
            updateAgentType: jest.fn(),
            findAgentInfo: jest.fn(async (_userId: string, agentName: string) =>
              agentName === 'bot-1'
                ? {
                    agent_name: 'bot-1',
                    display_name: 'Bot One',
                    agent_category: 'app',
                    agent_platform: 'openai-sdk',
                  }
                : null,
            ),
          },
        },
        {
          provide: ApiKeyGeneratorService,
          useValue: {
            onboardAgent: jest.fn(),
            getKeyForAgent: mockGetKeyForAgent,
            rotateKey: mockRotateKey,
          },
        },
        {
          provide: AgentDuplicationService,
          useValue: {
            duplicate: mockDuplicate,
            getCopySummary: mockGetCopySummary,
            suggestName: mockSuggestName,
          },
        },
        {
          provide: ConfigService,
          useValue: { get: mockConfigGet },
        },
        {
          provide: TenantCacheService,
          useValue: { resolve: mockTenantResolve },
        },
        {
          provide: IngestEventBusService,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<AgentsController>(AgentsController);
    cacheManager = module.get<Cache>(CACHE_MANAGER);
    jest.spyOn(cacheManager, 'del').mockResolvedValue(true);
  });

  it('returns agent list wrapped in agents property', async () => {
    const user = { id: 'u1' };
    const result = await controller.getAgents(user as never);

    expect(result.agents).toHaveLength(2);
    expect(result.agents[0].agent_name).toBe('bot-1');
    expect(mockGetAgentList).toHaveBeenCalledWith('u1', 'tenant-123');
  });

  it('passes undefined tenantId when tenant not found', async () => {
    mockTenantResolve.mockResolvedValueOnce(null);
    const user = { id: 'u1' };
    await controller.getAgents(user as never);

    expect(mockGetAgentList).toHaveBeenCalledWith('u1', undefined);
  });

  it('GET /agents/:agentName returns metadata for an existing agent', async () => {
    const user = { id: 'u1' };
    const result = await controller.getAgentInfo(user as never, 'bot-1');
    expect(result).toEqual({
      agent: {
        agent_name: 'bot-1',
        display_name: 'Bot One',
        agent_category: 'app',
        agent_platform: 'openai-sdk',
      },
    });
  });

  it('GET /agents/:agentName returns { agent: null } when not found', async () => {
    const user = { id: 'u1' };
    const result = await controller.getAgentInfo(user as never, 'missing');
    expect(result).toEqual({ agent: null });
  });

  it('returns agent key prefix', async () => {
    const user = { id: 'u1' };
    const result = await controller.getAgentKey(user as never, 'bot-1');

    expect(result).toMatchObject({ keyPrefix: 'mnfst_test1234' });
    expect(mockGetKeyForAgent).toHaveBeenCalledWith('u1', 'bot-1');
  });

  it('returns full apiKey when service returns fullKey', async () => {
    mockGetKeyForAgent.mockResolvedValueOnce({
      keyPrefix: 'mnfst_test1234',
      fullKey: 'mnfst_full_decrypted',
    });
    const user = { id: 'u1' };
    const result = await controller.getAgentKey(user as never, 'bot-1');

    expect(result).toMatchObject({ keyPrefix: 'mnfst_test1234', apiKey: 'mnfst_full_decrypted' });
  });

  it('returns full apiKey when service returns fullKey', async () => {
    mockGetKeyForAgent.mockResolvedValue({
      keyPrefix: 'mnfst_test1234',
      fullKey: 'mnfst_full_decrypted',
    });
    const user = { id: 'u1' };
    const result = await controller.getAgentKey(user as never, 'bot-1');

    expect(result).toMatchObject({ keyPrefix: 'mnfst_test1234', apiKey: 'mnfst_full_decrypted' });
  });

  it('does not return apiKey when service returns no fullKey', async () => {
    mockGetKeyForAgent.mockResolvedValue({ keyPrefix: 'mnfst_test1234' });
    const user = { id: 'u1' };
    const result = await controller.getAgentKey(user as never, 'bot-1');

    expect(result).toMatchObject({ keyPrefix: 'mnfst_test1234' });
    expect(result).not.toHaveProperty('apiKey');
  });

  it('returns empty agents array when no agents exist', async () => {
    mockGetAgentList.mockResolvedValue([]);

    const user = { id: 'u1' };
    const result = await controller.getAgents(user as never);

    expect(result.agents).toEqual([]);
  });

  it('rotates agent key and returns new raw key', async () => {
    const user = { id: 'u1' };
    const result = await controller.rotateAgentKey(user as never, 'bot-1');

    expect(result).toEqual({ apiKey: 'mnfst_new_key_123' });
    expect(mockRotateKey).toHaveBeenCalledWith('u1', 'bot-1');
  });

  it('renames agent and returns success with slug', async () => {
    const user = { id: 'u1' };
    const result = await controller.updateAgent(user as never, 'bot-1', {
      name: 'Bot Renamed',
    } as never);

    expect(result).toEqual({ renamed: true, name: 'bot-renamed', display_name: 'Bot Renamed' });
    expect(mockRenameAgent).toHaveBeenCalledWith('u1', 'bot-1', 'bot-renamed', 'Bot Renamed');
    expect(cacheManager.del).toHaveBeenCalledWith('u1:/api/v1/agents');
  });

  it('rejects rename with empty slug', async () => {
    const user = { id: 'u1' };
    await expect(
      controller.updateAgent(user as never, 'bot-1', { name: '!!!' } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('deletes agent and returns success', async () => {
    const user = { id: 'u1' };
    const result = await controller.deleteAgent(user as never, 'bot-1');

    expect(result).toEqual({ deleted: true });
    expect(mockDeleteAgent).toHaveBeenCalledWith('u1', 'bot-1');
    expect(cacheManager.del).toHaveBeenCalledWith('u1:/api/v1/agents');
  });

  it('passes agent_category and agent_platform to onboardAgent', async () => {
    const mockOnboard = jest.fn().mockResolvedValue({
      tenantId: 't1',
      agentId: 'a1',
      apiKey: 'mnfst_key',
    });
    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [AgentsController],
      providers: [
        { provide: TimeseriesQueriesService, useValue: { getAgentList: jest.fn() } },
        {
          provide: AgentLifecycleService,
          useValue: {
            deleteAgent: jest.fn(),
            renameAgent: jest.fn(),
            updateAgentType: jest.fn(),
            findAgentInfo: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: ApiKeyGeneratorService,
          useValue: { onboardAgent: mockOnboard, getKeyForAgent: jest.fn(), rotateKey: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: TenantCacheService, useValue: { resolve: jest.fn().mockResolvedValue(null) } },
        { provide: IngestEventBusService, useValue: { emit: jest.fn() } },
        {
          provide: AgentDuplicationService,
          useValue: { duplicate: jest.fn(), getCopySummary: jest.fn(), suggestName: jest.fn() },
        },
      ],
    }).compile();

    const ctrl = module.get<AgentsController>(AgentsController);
    const cm = module.get<Cache>(CACHE_MANAGER);
    jest.spyOn(cm, 'del').mockResolvedValue(true);
    const user = { id: 'user-123', email: 'test@example.com' };
    const result = await ctrl.createAgent(
      user as never,
      {
        name: 'My Agent',
        agent_category: 'personal',
        agent_platform: 'openclaw',
      } as never,
    );

    expect(mockOnboard).toHaveBeenCalledWith(
      expect.objectContaining({
        agentCategory: 'personal',
        agentPlatform: 'openclaw',
      }),
    );
    expect(result.agent.agent_category).toBe('personal');
    expect(result.agent.agent_platform).toBe('openclaw');
  });

  it('returns null category/platform when not provided', async () => {
    const mockOnboard = jest.fn().mockResolvedValue({
      tenantId: 't1',
      agentId: 'a1',
      apiKey: 'mnfst_key',
    });
    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [AgentsController],
      providers: [
        { provide: TimeseriesQueriesService, useValue: { getAgentList: jest.fn() } },
        {
          provide: AgentLifecycleService,
          useValue: {
            deleteAgent: jest.fn(),
            renameAgent: jest.fn(),
            updateAgentType: jest.fn(),
            findAgentInfo: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: ApiKeyGeneratorService,
          useValue: { onboardAgent: mockOnboard, getKeyForAgent: jest.fn(), rotateKey: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: TenantCacheService, useValue: { resolve: jest.fn().mockResolvedValue(null) } },
        { provide: IngestEventBusService, useValue: { emit: jest.fn() } },
        {
          provide: AgentDuplicationService,
          useValue: { duplicate: jest.fn(), getCopySummary: jest.fn(), suggestName: jest.fn() },
        },
      ],
    }).compile();

    const ctrl = module.get<AgentsController>(AgentsController);
    const cm = module.get<Cache>(CACHE_MANAGER);
    jest.spyOn(cm, 'del').mockResolvedValue(true);
    const user = { id: 'user-123', email: 'test@example.com' };
    const result = await ctrl.createAgent(user as never, { name: 'My Agent' } as never);

    expect(result.agent.agent_category).toBeNull();
    expect(result.agent.agent_platform).toBeNull();
  });

  it('passes category/platform to updateAgentType on PATCH', async () => {
    const mockUpdateType = jest.fn().mockResolvedValue(undefined);
    const user = { id: 'u1' };
    const result = await controller.updateAgent(user as never, 'bot-1', {
      agent_category: 'app',
      agent_platform: 'openai-sdk',
    } as never);

    expect(result).toMatchObject({
      agent_category: 'app',
      agent_platform: 'openai-sdk',
    });
  });

  it('invalidates agent list cache after successful createAgent', async () => {
    const mockOnboard = jest.fn().mockResolvedValue({
      tenantId: 't1',
      agentId: 'a1',
      apiKey: 'mnfst_key',
    });
    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [AgentsController],
      providers: [
        { provide: TimeseriesQueriesService, useValue: { getAgentList: jest.fn() } },
        {
          provide: AgentLifecycleService,
          useValue: {
            deleteAgent: jest.fn(),
            renameAgent: jest.fn(),
            updateAgentType: jest.fn(),
            findAgentInfo: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: ApiKeyGeneratorService,
          useValue: { onboardAgent: mockOnboard, getKeyForAgent: jest.fn(), rotateKey: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: TenantCacheService, useValue: { resolve: jest.fn().mockResolvedValue(null) } },
        { provide: IngestEventBusService, useValue: { emit: jest.fn() } },
        {
          provide: AgentDuplicationService,
          useValue: { duplicate: jest.fn(), getCopySummary: jest.fn(), suggestName: jest.fn() },
        },
      ],
    }).compile();

    const ctrl = module.get<AgentsController>(AgentsController);
    const cm = module.get<Cache>(CACHE_MANAGER);
    const delSpy = jest.spyOn(cm, 'del').mockResolvedValue(true);
    const user = { id: 'user-123', email: 'test@example.com' };
    const result = await ctrl.createAgent(user as never, { name: 'My Agent' } as never);

    expect(result.agent.name).toBe('my-agent');
    expect(delSpy).toHaveBeenCalledWith('user-123:/api/v1/agents');
  });

  it('rejects createAgent with empty slug', async () => {
    const mockOnboard = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [AgentsController],
      providers: [
        { provide: TimeseriesQueriesService, useValue: { getAgentList: jest.fn() } },
        {
          provide: AgentLifecycleService,
          useValue: {
            deleteAgent: jest.fn(),
            renameAgent: jest.fn(),
            updateAgentType: jest.fn(),
            findAgentInfo: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: ApiKeyGeneratorService,
          useValue: { onboardAgent: mockOnboard, getKeyForAgent: jest.fn(), rotateKey: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: TenantCacheService, useValue: { resolve: jest.fn().mockResolvedValue(null) } },
        { provide: IngestEventBusService, useValue: { emit: jest.fn() } },
        {
          provide: AgentDuplicationService,
          useValue: { duplicate: jest.fn(), getCopySummary: jest.fn(), suggestName: jest.fn() },
        },
      ],
    }).compile();

    const ctrl = module.get<AgentsController>(AgentsController);
    const user = { id: 'user-123', email: 'test@example.com' };
    await expect(ctrl.createAgent(user as never, { name: '!!!' } as never)).rejects.toThrow(
      BadRequestException,
    );
    expect(mockOnboard).not.toHaveBeenCalled();
  });

  it('throws ConflictException when onboardAgent hits unique constraint', async () => {
    const queryError = new QueryFailedError('INSERT', [], new Error('unique constraint violation'));
    const mockOnboard = jest.fn().mockRejectedValue(queryError);
    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [AgentsController],
      providers: [
        { provide: TimeseriesQueriesService, useValue: { getAgentList: jest.fn() } },
        {
          provide: AgentLifecycleService,
          useValue: {
            deleteAgent: jest.fn(),
            renameAgent: jest.fn(),
            updateAgentType: jest.fn(),
            findAgentInfo: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: ApiKeyGeneratorService,
          useValue: { onboardAgent: mockOnboard, getKeyForAgent: jest.fn(), rotateKey: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: TenantCacheService, useValue: { resolve: jest.fn().mockResolvedValue(null) } },
        { provide: IngestEventBusService, useValue: { emit: jest.fn() } },
        {
          provide: AgentDuplicationService,
          useValue: { duplicate: jest.fn(), getCopySummary: jest.fn(), suggestName: jest.fn() },
        },
      ],
    }).compile();

    const ctrl = module.get<AgentsController>(AgentsController);
    const user = { id: 'user-123', email: 'test@example.com' };
    await expect(ctrl.createAgent(user as never, { name: 'My Agent' } as never)).rejects.toThrow(
      ConflictException,
    );
  });

  it('returns duplicate preview with copy counts and suggested name', async () => {
    const user = { id: 'u1' };
    const result = await controller.getDuplicatePreview(user as never, 'bot-1');

    expect(result).toEqual({
      copied: { providers: 1, customProviders: 0, tierAssignments: 2, specificityAssignments: 0 },
      suggested_name: 'bot-copy',
    });
    expect(mockGetCopySummary).toHaveBeenCalledWith('u1', 'bot-1');
    expect(mockSuggestName).toHaveBeenCalledWith('u1', 'bot-1');
  });

  it('duplicates agent and invalidates cache', async () => {
    const user = { id: 'u1' };
    const result = await controller.duplicateAgent(user as never, 'bot-1', {
      name: 'Bot Copy',
    } as never);

    expect(result.agent.name).toBe('bot-copy');
    expect(result.apiKey).toBe('mnfst_new');
    expect(result.copied.providers).toBe(1);
    expect(mockDuplicate).toHaveBeenCalledWith('u1', 'bot-1', {
      name: 'bot-copy',
      displayName: 'Bot Copy',
    });
    expect(cacheManager.del).toHaveBeenCalledWith('u1:/api/v1/agents');
  });

  it('rejects duplicateAgent with empty slug', async () => {
    const user = { id: 'u1' };
    await expect(
      controller.duplicateAgent(user as never, 'bot-1', { name: '!!!' } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('converts duplicate-name QueryFailedError into ConflictException on duplicateAgent', async () => {
    mockDuplicate.mockRejectedValueOnce(
      new QueryFailedError('INSERT', [], new Error('unique constraint violation')),
    );
    const user = { id: 'u1' };
    await expect(
      controller.duplicateAgent(user as never, 'bot-1', { name: 'bot-copy' } as never),
    ).rejects.toThrow(ConflictException);
  });

  it('re-throws non-duplicate errors from duplicate()', async () => {
    mockDuplicate.mockRejectedValueOnce(new Error('boom'));
    const user = { id: 'u1' };
    await expect(
      controller.duplicateAgent(user as never, 'bot-1', { name: 'bot-copy' } as never),
    ).rejects.toThrow('boom');
  });

  it('re-throws non-duplicate QueryFailedError from onboardAgent', async () => {
    const queryError = new QueryFailedError('INSERT', [], new Error('connection refused'));
    const mockOnboard = jest.fn().mockRejectedValue(queryError);
    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [AgentsController],
      providers: [
        { provide: TimeseriesQueriesService, useValue: { getAgentList: jest.fn() } },
        {
          provide: AgentLifecycleService,
          useValue: {
            deleteAgent: jest.fn(),
            renameAgent: jest.fn(),
            updateAgentType: jest.fn(),
            findAgentInfo: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: ApiKeyGeneratorService,
          useValue: { onboardAgent: mockOnboard, getKeyForAgent: jest.fn(), rotateKey: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: TenantCacheService, useValue: { resolve: jest.fn().mockResolvedValue(null) } },
        { provide: IngestEventBusService, useValue: { emit: jest.fn() } },
        {
          provide: AgentDuplicationService,
          useValue: { duplicate: jest.fn(), getCopySummary: jest.fn(), suggestName: jest.fn() },
        },
      ],
    }).compile();

    const ctrl = module.get<AgentsController>(AgentsController);
    const user = { id: 'user-123', email: 'test@example.com' };
    await expect(ctrl.createAgent(user as never, { name: 'My Agent' } as never)).rejects.toThrow(
      QueryFailedError,
    );
  });
});
