import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ResolveAgentService } from './resolve-agent.service';
import { Agent } from '../../entities/agent.entity';

function makeAgentRepo(findOne: jest.Mock): Repository<Agent> {
  return { findOne } as unknown as Repository<Agent>;
}

describe('ResolveAgentService', () => {
  let findOne: jest.Mock;
  let svc: ResolveAgentService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-20T12:00:00Z'));
    findOne = jest.fn();
    svc = new ResolveAgentService(makeAgentRepo(findOne));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('throws NotFoundException when the tenant is null', async () => {
    await expect(svc.resolve(null, 'demo-agent')).rejects.toBeInstanceOf(NotFoundException);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the agent does not exist for the tenant', async () => {
    findOne.mockResolvedValue(null);
    await expect(svc.resolve('tenant-1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(findOne).toHaveBeenCalledWith({
      where: { tenant_id: 'tenant-1', name: 'missing', deleted_at: expect.anything() },
    });
  });

  it('returns and caches the agent on a successful lookup', async () => {
    const agent = { id: 'agent-1', name: 'demo-agent', is_playground: false } as Agent;
    findOne.mockResolvedValue(agent);

    const first = await svc.resolve('tenant-1', 'demo-agent');
    const second = await svc.resolve('tenant-1', 'demo-agent');

    expect(first).toBe(agent);
    expect(second).toBe(agent);
    // Second call hits the cache — repo should only be consulted once.
    expect(findOne).toHaveBeenCalledTimes(1);
  });

  it('re-queries the repo after the TTL expires', async () => {
    const agent = { id: 'agent-1', name: 'demo-agent', is_playground: false } as Agent;
    findOne.mockResolvedValue(agent);

    await svc.resolve('tenant-1', 'demo-agent');
    jest.advanceTimersByTime(120_001);
    await svc.resolve('tenant-1', 'demo-agent');

    expect(findOne).toHaveBeenCalledTimes(2);
  });

  it('scopes the cache by tenant — two tenants with the same agent name do not collide', async () => {
    const agentA = { id: 'a', name: 'agent', is_playground: false } as Agent;
    const agentB = { id: 'b', name: 'agent', is_playground: false } as Agent;

    findOne.mockResolvedValueOnce(agentA).mockResolvedValueOnce(agentB);

    expect(await svc.resolve('tenant-A', 'agent')).toBe(agentA);
    expect(await svc.resolve('tenant-B', 'agent')).toBe(agentB);
    // Repeats should be cache hits.
    expect(await svc.resolve('tenant-A', 'agent')).toBe(agentA);
    expect(await svc.resolve('tenant-B', 'agent')).toBe(agentB);
    expect(findOne).toHaveBeenCalledTimes(2);
  });

  it('invalidate removes the cached entry so the next resolve re-queries', async () => {
    const agent = { id: 'agent-1', name: 'demo-agent', is_playground: false } as Agent;
    findOne.mockResolvedValue(agent);

    await svc.resolve('tenant-1', 'demo-agent');
    expect(findOne).toHaveBeenCalledTimes(1);

    svc.invalidate('tenant-1', 'demo-agent');

    await svc.resolve('tenant-1', 'demo-agent');
    expect(findOne).toHaveBeenCalledTimes(2);
  });

  it('evicts the oldest entry when the cache is at MAX_ENTRIES capacity', async () => {
    // Fill the internal cache to MAX_ENTRIES (5000) via the private map so we
    // can exercise the LRU eviction path without making 5000 real calls.
    const cacheField = (svc as unknown as { cache: Map<string, unknown> }).cache;
    for (let i = 0; i < 5000; i++) {
      cacheField.set(`tenant-x:agent-${i}`, {
        agent: { id: `a${i}`, name: `agent-${i}`, is_playground: false } as Agent,
        expiresAt: Date.now() + 120_000,
      });
    }
    expect(cacheField.size).toBe(5000);

    // The new agent to resolve — its cache key is NOT in the map yet, so the
    // LRU eviction branch runs and the oldest entry is dropped.
    const newAgent = { id: 'new-1', name: 'new-agent', is_playground: false } as Agent;
    findOne.mockResolvedValue(newAgent);

    const result = await svc.resolve('tenant-1', 'new-agent');
    expect(result).toBe(newAgent);
    // One entry was evicted, then the new one was added — size stays at 5000.
    expect(cacheField.size).toBe(5000);
    expect(cacheField.has('tenant-1:new-agent')).toBe(true);
  });

  // P1-A: playground agent rejection
  it('throws NotFoundException for a playground agent when allowPlayground is not set (default)', async () => {
    const playgroundAgent = { id: 'sys-1', name: 'Playground', is_playground: true } as Agent;
    findOne.mockResolvedValue(playgroundAgent);

    await expect(svc.resolve('tenant-1', 'Playground')).rejects.toBeInstanceOf(NotFoundException);
    // The error message matches the not-found shape so callers cannot distinguish
    // a missing agent from a playground agent.
    await expect(svc.resolve('tenant-1', 'Playground')).rejects.toThrow(
      'Agent "Playground" not found',
    );
  });

  it('returns the playground agent when allowPlayground is true', async () => {
    const playgroundAgent = { id: 'sys-1', name: 'Playground', is_playground: true } as Agent;
    findOne.mockResolvedValue(playgroundAgent);

    const result = await svc.resolve('tenant-1', 'Playground', { allowPlayground: true });
    expect(result).toBe(playgroundAgent);
  });

  it('caches the playground agent and still enforces is_playground check on cache hits', async () => {
    const playgroundAgent = { id: 'sys-1', name: 'Playground', is_playground: true } as Agent;
    findOne.mockResolvedValue(playgroundAgent);

    // First call with allowPlayground: true — agent is loaded and cached.
    const first = await svc.resolve('tenant-1', 'Playground', { allowPlayground: true });
    expect(first).toBe(playgroundAgent);
    expect(findOne).toHaveBeenCalledTimes(1);

    // Second call without allowPlayground — cache hit but is_playground check rejects it.
    await expect(svc.resolve('tenant-1', 'Playground')).rejects.toBeInstanceOf(NotFoundException);
    // Repo was NOT queried again (it was a cache hit).
    expect(findOne).toHaveBeenCalledTimes(1);

    // Third call with allowPlayground: true again — still cache hit, succeeds.
    const third = await svc.resolve('tenant-1', 'Playground', { allowPlayground: true });
    expect(third).toBe(playgroundAgent);
    expect(findOne).toHaveBeenCalledTimes(1);
  });
});
