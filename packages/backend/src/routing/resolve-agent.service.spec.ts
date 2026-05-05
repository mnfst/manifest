import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import { Agent } from '../entities/agent.entity';
import { TenantCacheService } from '../common/services/tenant-cache.service';

describe('ResolveAgentService', () => {
  let service: ResolveAgentService;
  let mockFindOne: jest.Mock;
  let mockTenantResolve: jest.Mock;

  beforeEach(async () => {
    mockFindOne = jest.fn();
    mockTenantResolve = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResolveAgentService,
        {
          provide: getRepositoryToken(Agent),
          useValue: { findOne: mockFindOne },
        },
        {
          provide: TenantCacheService,
          useValue: { resolve: mockTenantResolve },
        },
      ],
    }).compile();

    service = module.get<ResolveAgentService>(ResolveAgentService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('throws NotFoundException when tenant not found', async () => {
    mockTenantResolve.mockResolvedValue(null);

    await expect(service.resolve('user-1', 'my-agent')).rejects.toThrow(NotFoundException);
    await expect(service.resolve('user-1', 'my-agent')).rejects.toThrow('Tenant not found');
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when agent not found', async () => {
    mockTenantResolve.mockResolvedValue('tenant-123');
    mockFindOne.mockResolvedValue(null);

    await expect(service.resolve('user-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    await expect(service.resolve('user-1', 'nonexistent')).rejects.toThrow(
      'Agent "nonexistent" not found',
    );
  });

  it('returns agent when found', async () => {
    const agent = { id: 'agent-1', name: 'my-agent', tenant_id: 'tenant-123' } as Agent;
    mockTenantResolve.mockResolvedValueOnce('tenant-123');
    mockFindOne.mockResolvedValueOnce(agent);

    const result = await service.resolve('user-1', 'my-agent');

    expect(result).toEqual(agent);
    expect(mockFindOne).toHaveBeenCalledWith({
      where: { tenant_id: 'tenant-123', name: 'my-agent', deleted_at: expect.anything() },
    });
  });

  it('returns cached agent on second call without hitting DB again', async () => {
    const agent = { id: 'agent-1', name: 'my-agent', tenant_id: 'tenant-123' } as Agent;
    mockTenantResolve.mockResolvedValue('tenant-123');
    mockFindOne.mockResolvedValueOnce(agent);

    const first = await service.resolve('user-1', 'my-agent');
    const second = await service.resolve('user-1', 'my-agent');

    expect(first).toEqual(agent);
    expect(second).toEqual(agent);
    expect(mockFindOne).toHaveBeenCalledTimes(1);
  });

  it('evicts oldest entry when cache reaches MAX_ENTRIES', async () => {
    const cache = (service as any).cache as Map<string, unknown>;
    for (let i = 0; i < 5_000; i++) {
      cache.set(`t-${i}:a-${i}`, { agent: { id: `a-${i}` }, expiresAt: Date.now() + 120_000 });
    }
    expect(cache.size).toBe(5_000);

    const agent = { id: 'new-agent', name: 'new', tenant_id: 'tenant-123' } as Agent;
    mockTenantResolve.mockResolvedValueOnce('tenant-123');
    mockFindOne.mockResolvedValueOnce(agent);

    await service.resolve('user-1', 'new');

    expect(cache.size).toBe(5_000);
    expect(cache.has('t-0:a-0')).toBe(false);
  });

  it('cache expires after TTL (120_000ms)', async () => {
    jest.useFakeTimers();
    const agentV1 = { id: 'agent-1', name: 'my-agent', tenant_id: 'tenant-123' } as Agent;
    const agentV2 = { id: 'agent-1', name: 'my-agent', tenant_id: 'tenant-123' } as Agent;
    mockTenantResolve.mockResolvedValue('tenant-123');
    mockFindOne.mockResolvedValueOnce(agentV1).mockResolvedValueOnce(agentV2);

    await service.resolve('user-1', 'my-agent');
    expect(mockFindOne).toHaveBeenCalledTimes(1);

    // Advance past TTL
    jest.advanceTimersByTime(120_001);

    const result = await service.resolve('user-1', 'my-agent');
    expect(result).toEqual(agentV2);
    expect(mockFindOne).toHaveBeenCalledTimes(2);
  });
});
