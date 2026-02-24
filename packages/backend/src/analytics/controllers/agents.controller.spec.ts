import { Test, TestingModule } from '@nestjs/testing';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { TimeseriesQueriesService } from '../services/timeseries-queries.service';
import { AggregationService } from '../services/aggregation.service';
import { ApiKeyGeneratorService } from '../../otlp/services/api-key.service';
import { CacheInvalidationService } from '../../common/services/cache-invalidation.service';

describe('AgentsController', () => {
  let controller: AgentsController;
  let mockGetAgentList: jest.Mock;
  let mockGetKeyForAgent: jest.Mock;
  let mockRotateKey: jest.Mock;
  let mockConfigGet: jest.Mock;
  let mockDeleteAgent: jest.Mock;
  let mockRenameAgent: jest.Mock;

  const origMode = process.env['MANIFEST_MODE'];

  afterEach(() => {
    if (origMode === undefined) delete process.env['MANIFEST_MODE'];
    else process.env['MANIFEST_MODE'] = origMode;
  });

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

    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [AgentsController],
      providers: [
        {
          provide: TimeseriesQueriesService,
          useValue: { getAgentList: mockGetAgentList },
        },
        {
          provide: AggregationService,
          useValue: { deleteAgent: mockDeleteAgent, renameAgent: mockRenameAgent },
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
          provide: ConfigService,
          useValue: { get: mockConfigGet },
        },
        { provide: CacheInvalidationService, useValue: { trackKey: jest.fn() } },
      ],
    }).compile();

    controller = module.get<AgentsController>(AgentsController);
  });

  it('returns agent list wrapped in agents property', async () => {
    const user = { id: 'u1' };
    const result = await controller.getAgents(user as never);

    expect(result.agents).toHaveLength(2);
    expect(result.agents[0].agent_name).toBe('bot-1');
    expect(mockGetAgentList).toHaveBeenCalledWith('u1');
  });

  it('returns agent key prefix without pluginEndpoint when env is not set', async () => {
    const user = { id: 'u1' };
    const result = await controller.getAgentKey(user as never, 'bot-1');

    expect(result).toMatchObject({ keyPrefix: 'mnfst_test1234' });
    expect(result).not.toHaveProperty('pluginEndpoint');
    expect(mockGetKeyForAgent).toHaveBeenCalledWith('u1', 'bot-1');
  });

  it('returns agent key prefix with pluginEndpoint when env is set', async () => {
    mockConfigGet.mockReturnValue('http://localhost:3001/otlp');
    const user = { id: 'u1' };
    const result = await controller.getAgentKey(user as never, 'bot-1');

    expect(result).toMatchObject({ keyPrefix: 'mnfst_test1234', pluginEndpoint: 'http://localhost:3001/otlp' });
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

  it('renames agent and returns success', async () => {
    const user = { id: 'u1' };
    const result = await controller.renameAgent(user as never, 'bot-1', { name: 'bot-renamed' } as never);

    expect(result).toEqual({ renamed: true, name: 'bot-renamed' });
    expect(mockRenameAgent).toHaveBeenCalledWith('u1', 'bot-1', 'bot-renamed');
  });

  it('deletes agent and returns success', async () => {
    delete process.env['MANIFEST_MODE'];
    const user = { id: 'u1' };
    const result = await controller.deleteAgent(user as never, 'bot-1');

    expect(result).toEqual({ deleted: true });
    expect(mockDeleteAgent).toHaveBeenCalledWith('u1', 'bot-1');
  });

  it('throws ForbiddenException when deleting in local mode', async () => {
    process.env['MANIFEST_MODE'] = 'local';
    const user = { id: 'u1' };
    await expect(controller.deleteAgent(user as never, 'bot-1')).rejects.toThrow(ForbiddenException);
    expect(mockDeleteAgent).not.toHaveBeenCalled();
  });
});
