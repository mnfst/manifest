import { ServiceUnavailableException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { CrmMetricsService } from './crm-metrics.service';
import { toLocalSqlTimestamp } from '../common/utils/postgres-sql';

const NOW = new Date('2026-09-04T12:00:00.000Z');

interface Scripted {
  index?: unknown[];
  cohort?: unknown[];
  providers?: unknown[];
  claims?: unknown[];
}

function cohortRow(over: Record<string, unknown> = {}) {
  return {
    email: 'matheus@example.com',
    user_name: 'Matheus Vitorio',
    tenant_id: 'tenant-a',
    healed_recent: '260',
    healed_all: '1241',
    first_heal_at: '2026-07-30T15:17:31.000Z',
    last_heal_at: '2026-09-04T09:47:30.000Z',
    ...over,
  };
}

describe('CrmMetricsService', () => {
  let query: jest.Mock;
  let commitTransaction: jest.Mock;
  let rollbackTransaction: jest.Mock;
  let release: jest.Mock;
  let connect: jest.Mock;
  let startTransaction: jest.Mock;
  let service: CrmMetricsService;
  let scripted: Scripted;

  function setup(next: Scripted = {}): void {
    scripted = { index: [{ '?column?': 1 }], ...next };
    query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('SET LOCAL')) return Promise.resolve([]);
      if (sql.includes('pg_index')) return Promise.resolve(scripted.index ?? []);
      if (sql.includes('JOIN tenants t')) return Promise.resolve(scripted.cohort ?? []);
      if (sql.includes('JOIN agent_messages am')) return Promise.resolve(scripted.providers ?? []);
      if (sql.includes('FROM waitlist_claims')) return Promise.resolve(scripted.claims ?? []);
      throw new Error(`unexpected SQL: ${sql}`);
    });
    commitTransaction = jest.fn();
    rollbackTransaction = jest.fn();
    release = jest.fn();
    connect = jest.fn();
    startTransaction = jest.fn();
    const runner = {
      connect,
      startTransaction,
      commitTransaction,
      rollbackTransaction,
      release,
      query,
    };
    service = new CrmMetricsService({ createQueryRunner: () => runner } as unknown as DataSource);
  }

  const sqlFor = (needle: string): string =>
    query.mock.calls.map(([sql]) => String(sql)).find((sql) => sql.includes(needle)) ?? '';
  const paramsFor = (needle: string): unknown[] =>
    query.mock.calls.find(([sql]) => String(sql).includes(needle))?.[1] ?? [];

  beforeEach(() => setup());

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('transaction handling', () => {
    it('bounds the work with transaction-scoped timeouts', async () => {
      await service.getHealedCohort(7, NOW);

      expect(sqlFor('lock_timeout')).toBe(`SET LOCAL lock_timeout = '5000ms'`);
      expect(sqlFor('statement_timeout')).toBe(`SET LOCAL statement_timeout = '1500ms'`);
      expect(commitTransaction).toHaveBeenCalled();
    });

    it('rolls back and releases the runner when a query fails', async () => {
      setup();
      query.mockRejectedValueOnce(new Error('boom'));

      await expect(service.getHealedCohort(7, NOW)).rejects.toThrow('boom');
      expect(rollbackTransaction).toHaveBeenCalled();
      expect(commitTransaction).not.toHaveBeenCalled();
      expect(release).toHaveBeenCalled();
    });

    it('releases the runner on the happy path too', async () => {
      await service.getHealedCohort(7, NOW);

      expect(release).toHaveBeenCalled();
    });

    it('opens the transaction before setting the timeouts, and commits after the work', async () => {
      setup({ cohort: [cohortRow()] });

      await service.getHealedCohort(7, NOW);

      // `SET LOCAL` outside a transaction is silently a no-op, so hoisting
      // these above startTransaction would disable both bounds without
      // changing a single line of SQL text.
      expect(connect.mock.invocationCallOrder[0]).toBeLessThan(
        startTransaction.mock.invocationCallOrder[0],
      );
      expect(startTransaction.mock.invocationCallOrder[0]).toBeLessThan(
        query.mock.invocationCallOrder[0],
      );
      expect(query.mock.calls.slice(0, 2).map(([sql]) => String(sql))).toEqual([
        `SET LOCAL lock_timeout = '5000ms'`,
        `SET LOCAL statement_timeout = '1500ms'`,
      ]);
      expect(commitTransaction.mock.invocationCallOrder[0]).toBeGreaterThan(
        query.mock.invocationCallOrder[query.mock.invocationCallOrder.length - 1],
      );
    });
  });

  describe('index guard', () => {
    it('refuses to run an unindexed scan when the index is missing or invalid', async () => {
      setup({ index: [], cohort: [cohortRow()] });

      const error = await service.getHealedCohort(7, NOW).then(
        () => null,
        (thrown: unknown) => thrown,
      );

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as Error).message).toContain('IDX_requests_autofix_healed');
      // Cohort rows were scripted, so an empty result here would mean the
      // guard let the unindexed scan run and merely found nothing.
      expect(sqlFor('JOIN tenants t')).toBe('');
      expect(rollbackTransaction).toHaveBeenCalled();
      expect(release).toHaveBeenCalled();
    });

    it('reports the outage as a rejection, never as an empty cohort', async () => {
      setup({ cohort: [] });
      await expect(service.getHealedCohort(7, NOW)).resolves.toEqual([]);

      setup({ index: [] });
      const outcome = await service.getHealedCohort(7, NOW).then(
        (users) => ({ resolved: users }),
        (error: unknown) => ({ error }),
      );

      // "Nobody was healed" and "the index is gone" must not look alike to the
      // CRM: a `catch { return [] }` here would silently empty the feed.
      expect(outcome).toEqual({ error: expect.any(ServiceUnavailableException) });
    });

    it('probes for the index by name', async () => {
      await service.getHealedCohort(7, NOW);

      expect(paramsFor('pg_index')).toEqual(['IDX_requests_autofix_healed']);
    });
  });

  describe('cohort window', () => {
    it('bounds both queries with a local wall-clock cutoff, not UTC', async () => {
      setup({ cohort: [cohortRow()] });

      await service.getHealedCohort(7, NOW);

      const expected = toLocalSqlTimestamp(new Date(NOW.getTime() - 7 * 86_400_000));
      expect(paramsFor('JOIN tenants t')).toEqual([expected]);
      expect(paramsFor('JOIN agent_messages am')).toEqual([expected]);
    });

    it('defaults to the current time when no clock is injected', async () => {
      setup({ cohort: [cohortRow()] });

      await expect(service.getHealedCohort(7)).resolves.toHaveLength(1);
      await expect(service.getConversions(90)).resolves.toEqual([]);

      const cutoff = paramsFor('JOIN tenants t')[0] as string;
      expect(cutoff).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('applies the canonical healed predicate, not autofix_status alone', async () => {
      await service.getHealedCohort(7, NOW);

      const sql = sqlFor('JOIN tenants t');
      expect(sql).toContain(`r.autofix_status = 'retry_succeeded'`);
      expect(sql).toContain('r.status IS NULL OR r.status IN');
      expect(sql).toContain('u."emailVerified" = true');
    });

    it('counts every heal ever, but only surfaces people healed inside the window', async () => {
      await service.getHealedCohort(7, NOW);

      const sql = sqlFor('JOIN tenants t');
      expect(sql).toContain('count(*) FILTER (WHERE r.timestamp > $1)');
      expect(sql).toContain('HAVING count(*) FILTER (WHERE r.timestamp > $1) > 0');
      // `healed_all` is deliberately unbounded. Narrowing the WHERE by the
      // cutoff would collapse it onto `healed_recent` and quietly turn the
      // "heals since Autofix shipped" number into a duplicate of the window.
      expect(sql).not.toContain('AND r.timestamp >');
    });

    it('breaks providers down over patched attempts only, inside the window', async () => {
      setup({ cohort: [cohortRow()] });

      await service.getHealedCohort(7, NOW);

      const sql = sqlFor('JOIN agent_messages am');
      expect(sql).toContain('am.autofix_applied = true');
      expect(sql).toContain('AND r.timestamp > $1');
      // The status disjunction has to stay parenthesised: bare
      // `A AND B OR C AND D` binds OR last and would let failed requests into
      // the breakdown.
      expect(sql).toContain(`(r.status IS NULL OR r.status IN ('ok', 'success'))`);
    });
  });

  describe('cohort shaping', () => {
    it('maps a single person with their provider breakdown', async () => {
      setup({
        cohort: [cohortRow()],
        providers: [
          { tenant_id: 'tenant-a', provider: 'openrouter', n: '200' },
          { tenant_id: 'tenant-a', provider: 'anthropic', n: '60' },
        ],
      });

      const [user] = await service.getHealedCohort(7, NOW);

      expect(user).toEqual({
        email: 'matheus@example.com',
        name: 'Matheus Vitorio',
        healed_recent: 260,
        healed_all: 1241,
        first_heal_at: '2026-07-30T15:17:31.000Z',
        last_heal_at: '2026-09-04T09:47:30.000Z',
        providers: ['openrouter', 'anthropic'],
        top_provider: 'openrouter',
      });
    });

    it('sums a person who owns more than one tenant', async () => {
      setup({
        cohort: [
          cohortRow({ tenant_id: 'tenant-a', healed_recent: '10', healed_all: '20' }),
          cohortRow({
            tenant_id: 'tenant-b',
            user_name: null,
            healed_recent: '5',
            healed_all: '7',
            first_heal_at: '2026-07-01T00:00:00.000Z',
            last_heal_at: '2026-09-05T00:00:00.000Z',
          }),
        ],
        providers: [
          { tenant_id: 'tenant-a', provider: 'openai', n: '4' },
          { tenant_id: 'tenant-b', provider: 'openai', n: '6' },
          { tenant_id: 'tenant-b', provider: 'gemini', n: '9' },
        ],
      });

      const [user] = await service.getHealedCohort(7, NOW);

      expect(user.healed_recent).toBe(15);
      expect(user.healed_all).toBe(27);
      expect(user.first_heal_at).toBe('2026-07-01T00:00:00.000Z');
      expect(user.last_heal_at).toBe('2026-09-05T00:00:00.000Z');
      // openai totals 10 across both tenants, so it outranks gemini's 9.
      expect(user.providers).toEqual(['openai', 'gemini']);
      expect(user.name).toBe('Matheus Vitorio');
    });

    it('keeps the first name seen when a later tenant carries a different one', async () => {
      setup({
        cohort: [
          cohortRow({ tenant_id: 'tenant-a', user_name: 'First Name' }),
          cohortRow({ tenant_id: 'tenant-b', user_name: 'Stale Name' }),
        ],
      });

      const [user] = await service.getHealedCohort(7, NOW);

      // First non-null wins; flipping the coalesce to `row.user_name ?? existing`
      // would make the last tenant's copy of the name win instead.
      expect(user.name).toBe('First Name');
    });

    it('leaves the name null when no row for the person ever carried one', async () => {
      setup({
        cohort: [
          cohortRow({ tenant_id: 'tenant-a', user_name: null }),
          cohortRow({ tenant_id: 'tenant-b', user_name: null }),
        ],
      });

      const [user] = await service.getHealedCohort(7, NOW);

      expect(user.name).toBeNull();
      expect(user.email).toBe('matheus@example.com');
    });

    it('keeps a later name when the first row for a person had none', async () => {
      setup({
        cohort: [
          cohortRow({ tenant_id: 'tenant-a', user_name: null }),
          cohortRow({ tenant_id: 'tenant-b', user_name: 'Late Name' }),
        ],
      });

      const [user] = await service.getHealedCohort(7, NOW);

      expect(user.name).toBe('Late Name');
    });

    it('drops excluded addresses before they reach the payload', async () => {
      setup({
        cohort: [
          cohortRow({ email: 'bruno@buddyweb.fr' }),
          cohortRow({ email: 'improving_poison241@dralias.com' }),
          cohortRow({ email: 'real@example.com' }),
        ],
      });

      const users = await service.getHealedCohort(7, NOW);

      expect(users.map((u) => u.email)).toEqual(['real@example.com']);
    });

    it('normalises case and whitespace on the grouping key', async () => {
      setup({
        cohort: [
          cohortRow({ email: '  Matheus@Example.com ', tenant_id: 'tenant-a', healed_recent: '3' }),
          cohortRow({ email: 'matheus@example.com', tenant_id: 'tenant-b', healed_recent: '4' }),
        ],
      });

      const users = await service.getHealedCohort(7, NOW);

      expect(users).toHaveLength(1);
      expect(users[0].healed_recent).toBe(7);
    });

    it('orders people by heals in the window, most first', async () => {
      setup({
        cohort: [
          cohortRow({ email: 'quiet@example.com', tenant_id: 't1', healed_recent: '2' }),
          cohortRow({ email: 'loud@example.com', tenant_id: 't2', healed_recent: '99' }),
        ],
      });

      const users = await service.getHealedCohort(7, NOW);

      expect(users.map((u) => u.email)).toEqual(['loud@example.com', 'quiet@example.com']);
    });

    it('skips the provider query entirely when nobody qualifies', async () => {
      setup({ cohort: [cohortRow({ email: 'bruno@buddyweb.fr' })] });

      await expect(service.getHealedCohort(7, NOW)).resolves.toEqual([]);
      expect(sqlFor('JOIN agent_messages am')).toBe('');
    });

    it('ranks providers by their numeric attempt count, not by concatenated strings', async () => {
      setup({
        cohort: [cohortRow({ tenant_id: 'tenant-a' }), cohortRow({ tenant_id: 'tenant-b' })],
        providers: [
          { tenant_id: 'tenant-a', provider: 'anthropic', n: '1' },
          { tenant_id: 'tenant-b', provider: 'anthropic', n: '2' },
          { tenant_id: 'tenant-a', provider: 'openai', n: '5' },
        ],
      });

      const [user] = await service.getHealedCohort(7, NOW);

      // pg returns bigint counts as strings: anthropic is 1 + 2 = 3 and loses
      // to openai's 5. Dropping the Number() would make it '012' and win.
      expect(user.providers).toEqual(['openai', 'anthropic']);
      expect(user.top_provider).toBe('openai');
    });

    it('keeps both sides of a tie, in the order the database returned them', async () => {
      setup({
        cohort: [cohortRow()],
        providers: [
          { tenant_id: 'tenant-a', provider: 'openai', n: '5' },
          { tenant_id: 'tenant-a', provider: 'anthropic', n: '5' },
        ],
      });

      const [user] = await service.getHealedCohort(7, NOW);

      expect(user.providers).toEqual(['openai', 'anthropic']);
      expect(user.top_provider).toBe(user.providers[0]);
    });

    it('ignores provider rows belonging to a tenant this person does not own', async () => {
      setup({
        cohort: [cohortRow({ tenant_id: 'tenant-a' })],
        providers: [
          { tenant_id: 'tenant-a', provider: 'openai', n: '3' },
          { tenant_id: 'someone-elses-tenant', provider: 'gemini', n: '900' },
        ],
      });

      const [user] = await service.getHealedCohort(7, NOW);

      expect(user.providers).toEqual(['openai']);
      expect(user.top_provider).toBe('openai');
    });

    it('drops attempts with no provider instead of letting them top the ranking', async () => {
      setup({
        cohort: [cohortRow()],
        providers: [
          { tenant_id: 'tenant-a', provider: null, n: '99' },
          { tenant_id: 'tenant-a', provider: 'openai', n: '3' },
        ],
      });

      const [user] = await service.getHealedCohort(7, NOW);

      expect(user.providers).toEqual(['openai']);
      expect(user.top_provider).toBe('openai');
    });

    it('reports no providers when the attempts carry none', async () => {
      setup({
        cohort: [cohortRow()],
        providers: [
          { tenant_id: 'tenant-a', provider: null, n: '5' },
          { tenant_id: 'other-tenant', provider: 'openai', n: '5' },
        ],
      });

      const [user] = await service.getHealedCohort(7, NOW);

      expect(user.providers).toEqual([]);
      expect(user.top_provider).toBeNull();
    });
  });

  describe('conversions', () => {
    it('normalises claims and bounds the window in UTC', async () => {
      setup({
        claims: [
          { email: 'Someone@Example.com', source: 'cloud', claimed_at: '2026-09-01T08:00:00.000Z' },
        ],
      });

      const claims = await service.getConversions(90, NOW);

      expect(claims).toEqual([
        { email: 'someone@example.com', source: 'cloud', claimed_at: '2026-09-01T08:00:00.000Z' },
      ]);
      // claimed_at is `timestamp WITH time zone`, unlike requests.timestamp.
      expect(paramsFor('FROM waitlist_claims')).toEqual([
        new Date(NOW.getTime() - 90 * 86_400_000).toISOString(),
      ]);
    });

    it('runs the claims query alone: no index probe, no cross-tenant scan', async () => {
      setup({ claims: [] });

      await service.getConversions(90, NOW);

      expect(query.mock.calls.map(([sql]) => String(sql).trim().split('\n')[0])).toEqual([
        `SET LOCAL lock_timeout = '5000ms'`,
        `SET LOCAL statement_timeout = '1500ms'`,
        'SELECT email, source, claimed_at',
      ]);
      expect(commitTransaction).toHaveBeenCalled();
    });

    it('reports every claim, including addresses the cohort filters out', async () => {
      setup({
        claims: [
          {
            email: 'bruno@buddyweb.fr',
            source: 'self-hosted',
            claimed_at: '2026-09-02T00:00:00.000Z',
          },
          {
            email: 'info@realcompany.com',
            source: 'cloud',
            claimed_at: '2026-09-01T00:00:00.000Z',
          },
        ],
      });

      const claims = await service.getConversions(90, NOW);

      // Deliverability filtering is about who we may email; a conversion count
      // that quietly drops our own signups would understate the campaign.
      expect(claims.map((claim) => claim.email)).toEqual([
        'bruno@buddyweb.fr',
        'info@realcompany.com',
      ]);
    });
  });

  describe('caching', () => {
    it('serves a repeated cohort request without touching the database', async () => {
      setup({ cohort: [cohortRow()] });

      const first = await service.getHealedCohort(7, NOW);
      const callsAfterFirst = query.mock.calls.length;
      const second = await service.getHealedCohort(7, NOW);

      expect(second).toBe(first);
      expect(query.mock.calls).toHaveLength(callsAfterFirst);
    });

    it('caches per window, so a different day count recomputes', async () => {
      setup({ cohort: [cohortRow()] });

      await service.getHealedCohort(7, NOW);
      const callsAfterFirst = query.mock.calls.length;
      await service.getHealedCohort(30, NOW);

      expect(query.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });

    it('does not cache a failed scan, so the next call retries the database', async () => {
      setup({ cohort: [cohortRow()] });
      query.mockRejectedValueOnce(new Error('canceling statement due to statement timeout'));

      await expect(service.getHealedCohort(7, NOW)).rejects.toThrow('statement timeout');
      const users = await service.getHealedCohort(7, NOW);

      expect(users.map((u) => u.email)).toEqual(['matheus@example.com']);
    });

    it('does not cache a missing index either, so the feed recovers once it is rebuilt', async () => {
      setup({ index: [], cohort: [cohortRow()] });

      await expect(service.getHealedCohort(7, NOW)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      scripted.index = [{ '?column?': 1 }];

      await expect(service.getHealedCohort(7, NOW)).resolves.toHaveLength(1);
    });

    it('caches an empty window too, so an idle feed stops re-scanning', async () => {
      setup({ cohort: [] });

      await expect(service.getHealedCohort(7, NOW)).resolves.toEqual([]);
      const callsAfterFirst = query.mock.calls.length;
      await service.getHealedCohort(7, NOW);

      expect(query.mock.calls).toHaveLength(callsAfterFirst);
    });

    it('keeps the cohort and the conversion caches apart at the same window', async () => {
      setup({
        cohort: [cohortRow()],
        claims: [
          { email: 'someone@example.com', source: 'cloud', claimed_at: '2026-09-01T08:00:00.000Z' },
        ],
      });

      const users = await service.getHealedCohort(7, NOW);
      const claims = await service.getConversions(7, NOW);

      // One cache keyed on `days` alone would hand the cohort array back here.
      expect(users.map((u) => u.email)).toEqual(['matheus@example.com']);
      expect(claims).toEqual([
        { email: 'someone@example.com', source: 'cloud', claimed_at: '2026-09-01T08:00:00.000Z' },
      ]);
    });

    it('recomputes once the 60s ttl lapses', async () => {
      jest.useFakeTimers();
      setup({ cohort: [cohortRow()] });

      await service.getHealedCohort(7, NOW);
      const callsAfterFirst = query.mock.calls.length;

      jest.advanceTimersByTime(59_000);
      await service.getHealedCohort(7, NOW);
      expect(query.mock.calls).toHaveLength(callsAfterFirst);

      jest.advanceTimersByTime(2_000);
      await service.getHealedCohort(7, NOW);
      expect(query.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });

    it('caches conversions too', async () => {
      setup({ claims: [] });

      const first = await service.getConversions(90, NOW);
      const callsAfterFirst = query.mock.calls.length;
      const second = await service.getConversions(90, NOW);

      expect(second).toBe(first);
      expect(query.mock.calls).toHaveLength(callsAfterFirst);
    });
  });
});
