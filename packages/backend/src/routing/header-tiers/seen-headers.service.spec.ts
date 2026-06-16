import { SeenHeadersService } from './seen-headers.service';
import type { Repository } from 'typeorm';
import type { AgentMessage } from '../../entities/agent-message.entity';

function makeService() {
  const queryMock = jest.fn();
  const repo = { query: queryMock } as unknown as Repository<AgentMessage>;
  const svc = new SeenHeadersService(repo);
  return { svc, queryMock };
}

describe('SeenHeadersService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-21T00:00:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs the aggregate query and maps the rows', async () => {
    const { svc, queryMock } = makeService();
    queryMock.mockResolvedValue([
      { key: 'x-custom', count: 12, top_values: ['a', 'b'], sdks: ['openai-js'] },
      { key: 'user-agent', count: 5, top_values: null, sdks: null },
    ]);
    const out = await svc.getSeenHeaders('t1');
    expect(out).toEqual([
      { key: 'x-custom', count: 12, top_values: ['a', 'b'], sdks: ['openai-js'] },
      { key: 'user-agent', count: 5, top_values: [], sdks: [] },
    ]);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/jsonb_each_text/);
    expect(sql).toMatch(/ORDER BY count DESC/);
    expect(params).toEqual(['t1']);
  });

  it('scopes by tenant_id', async () => {
    const { svc, queryMock } = makeService();
    queryMock.mockResolvedValue([]);
    await svc.getSeenHeaders('tenant-42');
    const [sql, params] = queryMock.mock.calls[0];
    expect(params).toEqual(['tenant-42']);
    expect(sql).toMatch(/at\.tenant_id = \$1/);
  });

  it('adds an agent_name filter when provided', async () => {
    const { svc, queryMock } = makeService();
    queryMock.mockResolvedValue([]);
    await svc.getSeenHeaders('t1', 'demo-agent');
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/at\.agent_name = \$2/);
    expect(params).toEqual(['t1', 'demo-agent']);
  });

  it('caches the result for 5 minutes per (tenant, agent) pair', async () => {
    const { svc, queryMock } = makeService();
    queryMock.mockResolvedValue([]);
    await svc.getSeenHeaders('t1');
    await svc.getSeenHeaders('t1'); // same key — cached
    expect(queryMock).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(5 * 60_000 + 1);
    await svc.getSeenHeaders('t1');
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it('evicts the oldest entry once MAX_ENTRIES is exceeded', async () => {
    const { svc, queryMock } = makeService();
    queryMock.mockResolvedValue([]);
    // Fill cache with 200 unique (tenant, agent) pairs, then add a 201st.
    for (let i = 0; i < 201; i++) {
      await svc.getSeenHeaders('t1', `agent-${i}`);
    }
    expect(queryMock).toHaveBeenCalledTimes(201);

    // The oldest (agent-0) was evicted; querying it again re-runs.
    await svc.getSeenHeaders('t1', 'agent-0');
    expect(queryMock).toHaveBeenCalledTimes(202);
    // agent-200 (just added) is still cached.
    await svc.getSeenHeaders('t1', 'agent-200');
    expect(queryMock).toHaveBeenCalledTimes(202);
  });
});
