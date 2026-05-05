import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ResolveAgentService } from './resolve-agent.service';
import { Agent } from '../../entities/agent.entity';
import { TenantCacheService } from '../../common/services/tenant-cache.service';

function makeAgentRepo(findOne: jest.Mock): Repository<Agent> {
  return { findOne } as unknown as Repository<Agent>;
}

function makeTenantCache(resolve: jest.Mock): TenantCacheService {
  return { resolve } as unknown as TenantCacheService;
}

describe('ResolveAgentService', () => {
  let findOne: jest.Mock;
  let tenantResolve: jest.Mock;
  let svc: ResolveAgentService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-20T12:00:00Z'));
    findOne = jest.fn();
    tenantResolve = jest.fn();
    svc = new ResolveAgentService(makeAgentRepo(findOne), makeTenantCache(tenantResolve));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('throws NotFoundException when the user has no tenant', async () => {
    tenantResolve.mockResolvedValue(null);
    await expect(svc.resolve('user-1', 'demo-agent')).rejects.toBeInstanceOf(NotFoundException);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the agent does not exist for the tenant', async () => {
    tenantResolve.mockResolvedValue('tenant-1');
    findOne.mockResolvedValue(null);
    await expect(svc.resolve('user-1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(findOne).toHaveBeenCalledWith({
      where: { tenant_id: 'tenant-1', name: 'missing', deleted_at: expect.anything() },
    });
  });

  it('returns and caches the agent on a successful lookup', async () => {
    const agent = { id: 'agent-1', name: 'demo-agent' } as Agent;
    tenantResolve.mockResolvedValue('tenant-1');
    findOne.mockResolvedValue(agent);

    const first = await svc.resolve('user-1', 'demo-agent');
    const second = await svc.resolve('user-1', 'demo-agent');

    expect(first).toBe(agent);
    expect(second).toBe(agent);
    // Second call hits the cache — repo should only be consulted once.
    expect(findOne).toHaveBeenCalledTimes(1);
    // Tenant resolution still happens on every call (it has its own cache).
    expect(tenantResolve).toHaveBeenCalledTimes(2);
  });

  it('re-queries the repo after the TTL expires', async () => {
    const agent = { id: 'agent-1', name: 'demo-agent' } as Agent;
    tenantResolve.mockResolvedValue('tenant-1');
    findOne.mockResolvedValue(agent);

    await svc.resolve('user-1', 'demo-agent');
    jest.advanceTimersByTime(120_001);
    await svc.resolve('user-1', 'demo-agent');

    expect(findOne).toHaveBeenCalledTimes(2);
  });

  it('scopes the cache by tenant — two users with the same agent name do not collide', async () => {
    const agentA = { id: 'a', name: 'agent' } as Agent;
    const agentB = { id: 'b', name: 'agent' } as Agent;

    tenantResolve
      .mockResolvedValueOnce('tenant-A')
      .mockResolvedValueOnce('tenant-B')
      .mockResolvedValueOnce('tenant-A')
      .mockResolvedValueOnce('tenant-B');
    findOne.mockResolvedValueOnce(agentA).mockResolvedValueOnce(agentB);

    expect(await svc.resolve('user-A', 'agent')).toBe(agentA);
    expect(await svc.resolve('user-B', 'agent')).toBe(agentB);
    // Repeats should be cache hits.
    expect(await svc.resolve('user-A', 'agent')).toBe(agentA);
    expect(await svc.resolve('user-B', 'agent')).toBe(agentB);
    expect(findOne).toHaveBeenCalledTimes(2);
  });

  it('invalidate removes the cached entry so the next resolve re-queries', async () => {
    const agent = { id: 'agent-1', name: 'demo-agent' } as Agent;
    tenantResolve.mockResolvedValue('tenant-1');
    findOne.mockResolvedValue(agent);

    await svc.resolve('user-1', 'demo-agent');
    expect(findOne).toHaveBeenCalledTimes(1);

    svc.invalidate('tenant-1', 'demo-agent');

    await svc.resolve('user-1', 'demo-agent');
    expect(findOne).toHaveBeenCalledTimes(2);
  });
});
