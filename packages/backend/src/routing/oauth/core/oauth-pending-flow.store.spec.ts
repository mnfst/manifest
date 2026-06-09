import { DataSource } from 'typeorm';
import { OAuthPendingFlowStore } from './oauth-pending-flow.store';

function buildStore() {
  const query = jest.fn();
  const dataSource = { query } as unknown as DataSource;
  return { store: new OAuthPendingFlowStore(dataSource), query };
}

describe('OAuthPendingFlowStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-01T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stores one active pending flow per provider, agent, and user', async () => {
    const { store, query } = buildStore();
    query.mockResolvedValue([]);

    await store.create(
      'anthropic',
      { state: 's1', verifier: 'v1', agentId: 'agent-1', userId: 'user-1' },
      600_000,
    );

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[0][0]).toContain('DELETE FROM "oauth_pending_flows"');
    expect(query.mock.calls[0][1]).toEqual(['anthropic']);
    expect(query.mock.calls[1][0]).toContain('AND "agent_id" = $2');
    expect(query.mock.calls[1][1]).toEqual(['anthropic', 'agent-1', 'user-1']);
    expect(query.mock.calls[2][0]).toContain('INSERT INTO "oauth_pending_flows"');
    expect(query.mock.calls[2][1]).toEqual([
      'anthropic',
      's1',
      'v1',
      'agent-1',
      'user-1',
      new Date('2026-05-01T12:10:00Z'),
    ]);
  });

  it('consumes a pending flow scoped to the provider, state, agent, and user', async () => {
    const { store, query } = buildStore();
    query.mockResolvedValue([
      {
        provider: 'anthropic',
        state: 's1',
        code_verifier: 'v1',
        agent_id: 'agent-1',
        user_id: 'user-1',
        expires_at: new Date('2026-05-01T12:10:00Z'),
      },
    ]);

    await expect(store.consume('anthropic', 's1', 'agent-1', 'user-1')).resolves.toEqual({
      provider: 'anthropic',
      state: 's1',
      verifier: 'v1',
      agentId: 'agent-1',
      userId: 'user-1',
      expiresAt: new Date('2026-05-01T12:10:00Z').getTime(),
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('RETURNING'), [
      'anthropic',
      's1',
      'agent-1',
      'user-1',
    ]);
    expect(query.mock.calls[0][0]).toContain('AND "expires_at" > NOW()');
  });

  it('unwraps Postgres DELETE RETURNING tuples when consuming a pending flow', async () => {
    const { store, query } = buildStore();
    query.mockResolvedValue([
      [
        {
          provider: 'anthropic',
          state: 's1',
          code_verifier: 'v1',
          agent_id: 'agent-1',
          user_id: 'user-1',
          expires_at: new Date('2026-05-01T12:10:00Z'),
        },
      ],
      1,
    ]);

    await expect(store.consume('anthropic', 's1', 'agent-1', 'user-1')).resolves.toMatchObject({
      agentId: 'agent-1',
      userId: 'user-1',
      verifier: 'v1',
    });
  });

  it('returns null when no pending flow matches', async () => {
    const { store, query } = buildStore();
    query.mockResolvedValue([]);

    await expect(store.consume('anthropic', 'missing', 'agent-1', 'user-1')).resolves.toBeNull();
  });

  it('finds the latest unexpired flow for an agent and user', async () => {
    const { store, query } = buildStore();
    query.mockResolvedValueOnce([]);
    query.mockResolvedValueOnce([
      {
        provider: 'anthropic',
        state: 's1',
        code_verifier: 'v1',
        agent_id: 'agent-1',
        user_id: 'user-1',
        expires_at: '2026-05-01T12:10:00.000Z',
      },
    ]);

    await expect(store.findLatestForAgent('anthropic', 'agent-1', 'user-1')).resolves.toMatchObject(
      {
        provider: 'anthropic',
        state: 's1',
        verifier: 'v1',
        agentId: 'agent-1',
        userId: 'user-1',
      },
    );
    expect(query.mock.calls[1][0]).toContain('AND "user_id" = $3');
    expect(query.mock.calls[1][1]).toEqual(['anthropic', 'agent-1', 'user-1']);
  });

  it('clears a flow by provider and state', async () => {
    const { store, query } = buildStore();
    query.mockResolvedValue([]);

    await store.clear('anthropic', 's1');

    expect(query).toHaveBeenCalledWith(expect.stringContaining('AND "state" = $2'), [
      'anthropic',
      's1',
    ]);
  });

  it('counts active flows after provider-scoped cleanup', async () => {
    const { store, query } = buildStore();
    query.mockResolvedValueOnce([]);
    query.mockResolvedValueOnce([{ count: '2' }]);

    await expect(store.count('anthropic')).resolves.toBe(2);

    expect(query.mock.calls[0][0]).toContain('"expires_at" <= NOW()');
    expect(query.mock.calls[0][1]).toEqual(['anthropic']);
    expect(query.mock.calls[1][0]).toContain('SELECT COUNT(*)::int AS "count"');
    expect(query.mock.calls[1][1]).toEqual(['anthropic']);
  });

  it('cleans expired flows across providers when no provider is supplied', async () => {
    const { store, query } = buildStore();
    query.mockResolvedValue([]);

    await store.cleanupExpired();

    expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE "expires_at" <= NOW()'));
  });

  it('runs hourly cleanup', async () => {
    const { store } = buildStore();
    const cleanupExpired = jest.spyOn(store, 'cleanupExpired').mockResolvedValue(undefined);

    await store.cleanupExpiredCron();

    expect(cleanupExpired).toHaveBeenCalledWith();
  });

  it('logs and swallows hourly cleanup failures', async () => {
    const { store } = buildStore();
    jest.spyOn(store, 'cleanupExpired').mockRejectedValue(new Error('db down'));
    const warn = jest.fn();
    (store as unknown as { logger: { warn: jest.Mock } }).logger = { warn };

    await expect(store.cleanupExpiredCron()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      'Failed to clean expired OAuth pending flows: Error: db down',
    );
  });
});
