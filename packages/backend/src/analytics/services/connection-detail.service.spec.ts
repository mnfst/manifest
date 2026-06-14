import { ConnectionDetailService } from './connection-detail.service';
import type { Repository } from 'typeorm';
import type { UserProvider } from '../../entities/user-provider.entity';
import type { AgentMessage } from '../../entities/agent-message.entity';
import type { TenantCacheService } from '../../common/services/tenant-cache.service';

interface ConnectionDetailFull {
  connection: { last_used_at: string | null; [k: string]: unknown };
  agents: Array<Record<string, unknown>>;
  model_usage: Array<Record<string, unknown>>;
  recent_messages: Array<Record<string, unknown>>;
}

/**
 * A chainable QueryBuilder mock whose terminal getRawOne/getRawMany return
 * values are supplied per-instance. The service builds a fresh builder for each
 * query, so each createQueryBuilder() call shifts the next scripted result.
 */
function makeQb(result: { rawOne?: unknown; rawMany?: unknown[] }) {
  const qb: Record<string, jest.Mock> = {
    select: jest.fn(),
    addSelect: jest.fn(),
    leftJoin: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    groupBy: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    getRawOne: jest.fn().mockResolvedValue(result.rawOne),
    getRawMany: jest.fn().mockResolvedValue(result.rawMany ?? []),
  };
  for (const k of Object.keys(qb)) {
    if (!k.startsWith('getRaw')) qb[k].mockReturnValue(qb);
  }
  return qb;
}

describe('ConnectionDetailService', () => {
  let providerRepo: { findOne: jest.Mock };
  let messageRepo: { createQueryBuilder: jest.Mock };
  let tenantCache: { resolve: jest.Mock };
  let service: ConnectionDetailService;

  beforeEach(() => {
    providerRepo = { findOne: jest.fn() };
    messageRepo = { createQueryBuilder: jest.fn() };
    tenantCache = { resolve: jest.fn().mockResolvedValue('tenant-1') };

    service = new ConnectionDetailService(
      providerRepo as unknown as Repository<UserProvider>,
      messageRepo as unknown as Repository<AgentMessage>,
      tenantCache as unknown as TenantCacheService,
    );
  });

  it('returns the empty shape (incl. model_usage) when connectionId is missing', async () => {
    const out = await service.getConnectionDetail('u1', undefined);
    expect(out).toEqual({ connection: null, agents: [], model_usage: [], recent_messages: [] });
    expect(providerRepo.findOne).not.toHaveBeenCalled();
  });

  it('returns the empty shape when the connection is not found / not owned', async () => {
    providerRepo.findOne.mockResolvedValue(null);
    const out = await service.getConnectionDetail('u1', 'c1');
    expect(providerRepo.findOne).toHaveBeenCalledWith({ where: { id: 'c1', user_id: 'u1' } });
    expect(out).toEqual({ connection: null, agents: [], model_usage: [], recent_messages: [] });
  });

  it('resolves the tenant via TenantCacheService, not a per-request tenant query', async () => {
    providerRepo.findOne.mockResolvedValue({
      id: 'c1',
      provider: 'openai',
      auth_type: 'api_key',
      label: 'My OpenAI',
      cached_models: null,
      key_prefix: 'sk-abc',
      connected_at: '2026-01-01',
      is_active: true,
    });
    messageRepo.createQueryBuilder
      .mockReturnValueOnce(makeQb({ rawOne: { last_used_at: null } }))
      .mockReturnValueOnce(makeQb({ rawMany: [] }))
      .mockReturnValueOnce(makeQb({ rawMany: [] }))
      .mockReturnValueOnce(makeQb({ rawMany: [] }));

    await service.getConnectionDetail('u1', 'c1');
    expect(tenantCache.resolve).toHaveBeenCalledWith('u1');
  });

  it('returns the connection-only shape when the tenant is missing', async () => {
    providerRepo.findOne.mockResolvedValue({
      id: 'c1',
      provider: 'openai',
      auth_type: 'api_key',
      label: 'My OpenAI',
      cached_models: [{ id: 'm1' }, { id: 'm2' }],
      key_prefix: 'sk-abc',
      connected_at: '2026-01-01',
    });
    tenantCache.resolve.mockResolvedValue(null);

    const out = (await service.getConnectionDetail('u1', 'c1')) as unknown as ConnectionDetailFull;
    expect(out.connection).toMatchObject({ id: 'c1', cached_model_count: 2 });
    expect(out.agents).toEqual([]);
    expect(out.model_usage).toEqual([]);
    expect(out.recent_messages).toEqual([]);
    // No usage queries are run when there is no tenant.
    expect(messageRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('aggregates agents, models and recent messages with percentages', async () => {
    providerRepo.findOne.mockResolvedValue({
      id: 'c1',
      provider: 'openai',
      auth_type: 'api_key',
      label: 'My OpenAI',
      cached_models: null, // non-array -> count 0
      key_prefix: 'sk-abc',
      connected_at: '2026-01-01',
      is_active: true,
    });
    tenantCache.resolve.mockResolvedValue('tenant-1');

    const lastUsedDate = new Date('2026-02-01T10:00:00Z');
    // Query order: lastUsed, agentRows, modelRows, recentMessages
    messageRepo.createQueryBuilder
      .mockReturnValueOnce(makeQb({ rawOne: { last_used_at: lastUsedDate } }))
      .mockReturnValueOnce(
        makeQb({
          rawMany: [
            {
              agent_name: 'agent-a',
              tokens: 80,
              cost: 1.5,
              messages: 3,
              last_used: lastUsedDate,
              agent_platform: 'openclaw',
            },
            {
              agent_name: 'agent-b',
              tokens: 20,
              cost: 0.5,
              messages: 1,
              last_used: '2026-02-01T09:00:00Z',
              agent_platform: null,
            },
          ],
        }),
      )
      .mockReturnValueOnce(
        makeQb({
          rawMany: [
            { model: 'gpt-4o', tokens: 60, cost: 1.0, messages: 2 },
            { model: 'gpt-4o-mini', tokens: 40, cost: 0.2, messages: 2 },
          ],
        }),
      )
      .mockReturnValueOnce(makeQb({ rawMany: [{ id: 'msg-1' }] }));

    const out = (await service.getConnectionDetail('u1', 'c1')) as unknown as ConnectionDetailFull;

    expect(out.connection).toMatchObject({
      id: 'c1',
      cached_model_count: 0,
      is_active: true,
      last_used_at: lastUsedDate.toISOString(),
    });
    // agent percentages: 80/100=80, 20/100=20
    expect(out.agents[0]).toMatchObject({
      agent_name: 'agent-a',
      agent_platform: 'openclaw',
      pct_of_total: 80,
      last_used: lastUsedDate.toISOString(),
    });
    expect(out.agents[1]).toMatchObject({
      agent_name: 'agent-b',
      agent_platform: null,
      pct_of_total: 20,
      last_used: '2026-02-01T09:00:00Z',
    });
    // model percentages: 60/100=60, 40/100=40
    expect(out.model_usage[0]).toMatchObject({ model: 'gpt-4o', pct_of_total: 60 });
    expect(out.model_usage[1]).toMatchObject({ model: 'gpt-4o-mini', pct_of_total: 40 });
    expect(out.recent_messages).toEqual([{ id: 'msg-1' }]);
  });

  it('handles zero totals (pct 0), null last_used and string last_used_at', async () => {
    providerRepo.findOne.mockResolvedValue({
      id: 'c1',
      provider: 'openai',
      auth_type: 'api_key',
      label: 'My OpenAI',
      cached_models: null,
      key_prefix: null,
      connected_at: '2026-01-01',
      is_active: false,
    });
    tenantCache.resolve.mockResolvedValue('tenant-1');

    messageRepo.createQueryBuilder
      // last_used_at as a raw string (not a Date)
      .mockReturnValueOnce(makeQb({ rawOne: { last_used_at: '2026-02-01T00:00:00Z' } }))
      .mockReturnValueOnce(
        makeQb({
          rawMany: [{ agent_name: 'agent-a', tokens: 0, cost: 0, messages: 0, last_used: null }],
        }),
      )
      .mockReturnValueOnce(
        makeQb({ rawMany: [{ model: 'gpt-4o', tokens: 0, cost: 0, messages: 0 }] }),
      )
      .mockReturnValueOnce(makeQb({ rawMany: [] }));

    const out = (await service.getConnectionDetail('u1', 'c1')) as unknown as ConnectionDetailFull;
    expect(out.connection.last_used_at).toBe('2026-02-01T00:00:00Z');
    expect(out.agents[0].pct_of_total).toBe(0);
    expect(out.agents[0].last_used).toBeNull();
    expect(out.model_usage[0].pct_of_total).toBe(0);
  });

  it('scopes every usage query to the connection id, not the provider/auth/label tuple', async () => {
    // Two keys can share provider+auth_type+label; only user_provider_id is
    // unique per key, so every usage query must filter on conn.id — and must NOT
    // fall back to the old provider_key_label predicate.
    providerRepo.findOne.mockResolvedValue({
      id: 'c1',
      provider: 'openai',
      auth_type: 'api_key',
      label: 'Work',
      cached_models: [],
      key_prefix: 'sk',
      connected_at: '2026-01-01',
      is_active: true,
    });
    tenantCache.resolve.mockResolvedValue('tenant-1');

    const qbs = [
      makeQb({ rawOne: { last_used_at: null } }),
      makeQb({ rawMany: [] }),
      makeQb({ rawMany: [] }),
      makeQb({ rawMany: [] }),
    ];
    messageRepo.createQueryBuilder
      .mockReturnValueOnce(qbs[0])
      .mockReturnValueOnce(qbs[1])
      .mockReturnValueOnce(qbs[2])
      .mockReturnValueOnce(qbs[3]);

    await service.getConnectionDetail('u1', 'c1');

    for (const qb of qbs) {
      const idCall = qb.andWhere.mock.calls.find((c) =>
        String(c[0]).includes('at.user_provider_id = :userProviderId'),
      );
      expect(idCall).toBeDefined();
      expect(idCall![1]).toEqual({ userProviderId: 'c1' });
      // The legacy label predicate must be gone — that was the merge bug.
      const labelCall = qb.andWhere.mock.calls.find((c) =>
        String(c[0]).includes("LOWER(COALESCE(at.provider_key_label, 'Default'))"),
      );
      expect(labelCall).toBeUndefined();
    }
  });

  it('scopes by connection id even when the connection label is null', async () => {
    providerRepo.findOne.mockResolvedValue({
      id: 'c1',
      provider: 'openai',
      auth_type: 'api_key',
      label: null,
      cached_models: [],
      key_prefix: 'sk',
      connected_at: '2026-01-01',
      is_active: true,
    });
    tenantCache.resolve.mockResolvedValue('tenant-1');

    const firstQb = makeQb({ rawOne: { last_used_at: null } });
    messageRepo.createQueryBuilder
      .mockReturnValueOnce(firstQb)
      .mockReturnValueOnce(makeQb({ rawMany: [] }))
      .mockReturnValueOnce(makeQb({ rawMany: [] }))
      .mockReturnValueOnce(makeQb({ rawMany: [] }));

    await service.getConnectionDetail('u1', 'c1');

    const idCall = firstQb.andWhere.mock.calls.find((c) =>
      String(c[0]).includes('at.user_provider_id = :userProviderId'),
    );
    expect(idCall![1]).toEqual({ userProviderId: 'c1' });
  });

  it('returns null last_used_at when no rows have ever been recorded', async () => {
    providerRepo.findOne.mockResolvedValue({
      id: 'c1',
      provider: 'openai',
      auth_type: 'api_key',
      label: 'My OpenAI',
      cached_models: [],
      key_prefix: 'sk',
      connected_at: '2026-01-01',
      is_active: true,
    });
    tenantCache.resolve.mockResolvedValue('tenant-1');

    messageRepo.createQueryBuilder
      .mockReturnValueOnce(makeQb({ rawOne: { last_used_at: null } }))
      .mockReturnValueOnce(makeQb({ rawMany: [] }))
      .mockReturnValueOnce(makeQb({ rawMany: [] }))
      .mockReturnValueOnce(makeQb({ rawMany: [] }));

    const out = (await service.getConnectionDetail('u1', 'c1')) as unknown as ConnectionDetailFull;
    expect(out.connection.last_used_at).toBeNull();
    expect(out.agents).toEqual([]);
    expect(out.model_usage).toEqual([]);
  });

  it('returns null last_used_at when the last-used query yields no row at all', async () => {
    // Covers the lastUsedRow?.last_used_at ?? null branch when getRawOne is null.
    providerRepo.findOne.mockResolvedValue({
      id: 'c1',
      provider: 'openai',
      auth_type: 'api_key',
      label: 'My OpenAI',
      cached_models: [],
      key_prefix: 'sk',
      connected_at: '2026-01-01',
      is_active: true,
    });
    tenantCache.resolve.mockResolvedValue('tenant-1');

    messageRepo.createQueryBuilder
      .mockReturnValueOnce(makeQb({ rawOne: undefined }))
      .mockReturnValueOnce(makeQb({ rawMany: [] }))
      .mockReturnValueOnce(makeQb({ rawMany: [] }))
      .mockReturnValueOnce(makeQb({ rawMany: [] }));

    const out = (await service.getConnectionDetail('u1', 'c1')) as unknown as ConnectionDetailFull;
    expect(out.connection.last_used_at).toBeNull();
  });
});
