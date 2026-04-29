import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { BenchmarkHistoryService, MAX_RUNS_PER_AGENT } from './benchmark-history.service';
import type { BenchmarkRun } from '../entities/benchmark-run.entity';
import type { BenchmarkColumn } from '../entities/benchmark-column.entity';

interface RepoMock {
  find: jest.Mock;
  findOne: jest.Mock;
  insert: jest.Mock;
  delete: jest.Mock;
  createQueryBuilder: jest.Mock;
}

interface QbChain {
  select: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  offset: jest.Mock;
  limit: jest.Mock;
  take: jest.Mock;
  getRawMany: jest.Mock;
  getMany: jest.Mock;
  getOne: jest.Mock;
  insert: jest.Mock;
  into: jest.Mock;
  values: jest.Mock;
  orIgnore: jest.Mock;
  execute: jest.Mock;
}

function buildQbChain(): QbChain {
  // Same object services every chain entry from runRepo.createQueryBuilder():
  // prune SELECT, listRuns/getRun read chains, and run-insert chain. Each
  // terminal method (`getRawMany`, `getMany`, `getOne`, `execute`) is its
  // own jest.fn so tests can assert calls and override return values per
  // scenario.
  const chain: Partial<QbChain> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.where = jest.fn().mockReturnValue(chain);
  chain.andWhere = jest.fn().mockReturnValue(chain);
  chain.orderBy = jest.fn().mockReturnValue(chain);
  chain.offset = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.take = jest.fn().mockReturnValue(chain);
  chain.getRawMany = jest.fn().mockResolvedValue([]);
  chain.getMany = jest.fn().mockResolvedValue([]);
  chain.getOne = jest.fn().mockResolvedValue(null);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.into = jest.fn().mockReturnValue(chain);
  chain.values = jest.fn().mockReturnValue(chain);
  chain.orIgnore = jest.fn().mockReturnValue(chain);
  chain.execute = jest.fn().mockResolvedValue({ identifiers: [{ id: 'inserted' }] });
  return chain as QbChain;
}

function buildRepos(): {
  runRepo: RepoMock;
  columnRepo: RepoMock;
  qb: jest.Mock;
  chain: QbChain;
} {
  const chain = buildQbChain();
  const qb = jest.fn().mockReturnValue(chain);
  const runRepo: RepoMock = {
    find: jest.fn(),
    findOne: jest.fn(),
    insert: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: qb,
  };
  const columnRepo: RepoMock = {
    find: jest.fn(),
    findOne: jest.fn(),
    insert: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(),
  };
  return { runRepo, columnRepo, qb, chain };
}

interface ServiceCtx {
  service: BenchmarkHistoryService;
  runRepo: RepoMock;
  columnRepo: RepoMock;
  qb: jest.Mock;
  chain: QbChain;
  tenantResolve: jest.Mock;
}

function buildService(opts?: { tenantId?: string | null }): ServiceCtx {
  const { runRepo, columnRepo, qb, chain } = buildRepos();
  // Differentiate "not provided" (default 'tenant-1') from "explicitly null"
  // (test the user_id-fallback path). `??` would coalesce null to default.
  const resolved = opts && 'tenantId' in opts ? opts.tenantId : 'tenant-1';
  const tenantResolve = jest.fn().mockResolvedValue(resolved);
  const service = new BenchmarkHistoryService(
    runRepo as unknown as Repository<BenchmarkRun>,
    columnRepo as unknown as Repository<BenchmarkColumn>,
    {
      resolve: tenantResolve,
    } as unknown as import('../common/services/tenant-cache.service').TenantCacheService,
  );
  return { service, runRepo, columnRepo, qb, chain, tenantResolve };
}

const AGENT = { id: 'agent-1', tenant_id: 'tenant-1', name: 'demo' };

describe('BenchmarkHistoryService', () => {
  describe('saveColumn', () => {
    it('creates the run on first column and inserts the column', async () => {
      const { service, columnRepo, chain } = buildService();
      chain.execute.mockResolvedValueOnce({ identifiers: [{ id: 'fresh-run' }] });
      await service.saveColumn({
        userId: 'user-1',
        agent: AGENT,
        prompt: 'hello world',
        model: 'openai/gpt-4o-mini',
        provider: 'openai',
        authType: 'api_key',
        displayName: 'GPT-4o Mini',
        position: 0,
        status: 'success',
        content: 'hi there',
        headers: { 'x-request-id': 'abc' },
        errorMessage: null,
        metrics: { inputTokens: 5, outputTokens: 2, cost: 0.0001, durationMs: 120 },
      });
      expect(chain.into).toHaveBeenCalledWith('benchmark_runs');
      expect(chain.values.mock.calls[0][0]).toMatchObject({
        user_id: 'user-1',
        agent_id: 'agent-1',
        prompt: 'hello world',
      });
      expect(chain.orIgnore).toHaveBeenCalled();
      expect(columnRepo.insert).toHaveBeenCalledTimes(1);
      expect(columnRepo.insert.mock.calls[0][0]).toMatchObject({
        model: 'openai/gpt-4o-mini',
        status: 'success',
        content: 'hi there',
        input_tokens: 5,
        output_tokens: 2,
      });
    });

    it('skips the prune step when the run row already existed (idempotent insert)', async () => {
      const { service, runRepo, columnRepo, chain } = buildService();
      // ON CONFLICT DO NOTHING returns no identifiers when the row pre-exists.
      chain.execute.mockResolvedValueOnce({ identifiers: [] });
      await service.saveColumn({
        userId: 'user-1',
        agent: AGENT,
        runId: 'run-42',
        prompt: 'hello',
        model: 'gpt-4o',
        provider: 'openai',
        authType: 'api_key',
        displayName: null,
        position: 1,
        status: 'error',
        content: null,
        headers: null,
        errorMessage: 'boom',
        metrics: null,
      });
      expect(columnRepo.insert).toHaveBeenCalledTimes(1);
      expect(columnRepo.insert.mock.calls[0][0]).toMatchObject({
        benchmark_run_id: 'run-42',
        status: 'error',
        error_message: 'boom',
        position: 1,
      });
      // Prune triggers a SELECT chain; no select means we did not prune.
      expect(chain.select).not.toHaveBeenCalled();
      expect(runRepo.delete).not.toHaveBeenCalled();
    });

    it('truncates very long prompts before insert', async () => {
      const { service, chain } = buildService();
      const longPrompt = 'x'.repeat(20_000);
      await service.saveColumn({
        userId: 'u',
        agent: AGENT,
        prompt: longPrompt,
        model: 'm',
        provider: 'p',
        authType: 'api_key',
        displayName: null,
        position: 0,
        status: 'success',
        content: 'c',
        headers: null,
        errorMessage: null,
        metrics: { inputTokens: 1, outputTokens: 1, cost: 0, durationMs: 1 },
      });
      const inserted = chain.values.mock.calls[0][0] as { prompt: string };
      expect(inserted.prompt.length).toBe(10_000);
    });

    it('does not throw when persistence fails — history is best-effort', async () => {
      const { service, chain } = buildService();
      chain.execute.mockRejectedValue(new Error('db down'));
      await expect(
        service.saveColumn({
          userId: 'u',
          agent: AGENT,
          prompt: 'x',
          model: 'm',
          provider: 'p',
          authType: 'api_key',
          displayName: null,
          position: 0,
          status: 'success',
          content: 'c',
          headers: null,
          errorMessage: null,
          metrics: { inputTokens: 1, outputTokens: 1, cost: 0, durationMs: 1 },
        }),
      ).resolves.toBeUndefined();
    });

    it('still persists the column when the prune step fails', async () => {
      const { service, columnRepo, chain } = buildService();
      chain.execute.mockResolvedValueOnce({ identifiers: [{ id: 'fresh' }] });
      // Force the prune SELECT to throw so we exercise the prune-error path.
      chain.getRawMany.mockRejectedValue(new Error('prune failed'));
      await service.saveColumn({
        userId: 'u',
        agent: AGENT,
        prompt: 'x',
        model: 'm',
        provider: 'p',
        authType: 'api_key',
        displayName: null,
        position: 0,
        status: 'success',
        content: 'c',
        headers: null,
        errorMessage: null,
        metrics: { inputTokens: 1, outputTokens: 1, cost: 0, durationMs: 1 },
      });
      expect(columnRepo.insert).toHaveBeenCalledTimes(1);
    });

    it('logs and returns when the column insert itself fails', async () => {
      const { service, columnRepo } = buildService();
      columnRepo.insert.mockRejectedValue(new Error('column write failed'));
      await expect(
        service.saveColumn({
          userId: 'u',
          agent: AGENT,
          prompt: 'x',
          model: 'm',
          provider: 'p',
          authType: 'api_key',
          displayName: null,
          position: 0,
          status: 'success',
          content: 'c',
          headers: null,
          errorMessage: null,
          metrics: { inputTokens: 1, outputTokens: 1, cost: 0, durationMs: 1 },
        }),
      ).resolves.toBeUndefined();
    });

    it('handles non-Error thrown values in the column-insert catch (covers the ternary)', async () => {
      // The catch coerces err to a string only when it is not an Error
      // instance — exercise that branch by throwing a bare string.
      const { service, columnRepo } = buildService();
      columnRepo.insert.mockRejectedValue('plain string failure');
      await expect(
        service.saveColumn({
          userId: 'u',
          agent: AGENT,
          prompt: 'x',
          model: 'm',
          provider: 'p',
          authType: 'api_key',
          displayName: null,
          position: 0,
          status: 'success',
          content: 'c',
          headers: null,
          errorMessage: null,
          metrics: { inputTokens: 1, outputTokens: 1, cost: 0, durationMs: 1 },
        }),
      ).resolves.toBeUndefined();
    });

    it('handles non-Error thrown values in the prune catch (covers the ternary)', async () => {
      const { service, chain } = buildService();
      chain.execute.mockResolvedValueOnce({ identifiers: [{ id: 'fresh' }] });
      // Throw a non-Error from the prune SELECT chain to hit the alternate
      // branch of the `err instanceof Error ? err.message : err` ternary.
      chain.getRawMany.mockRejectedValueOnce('weird-string-rejection');
      await expect(
        service.saveColumn({
          userId: 'u',
          agent: AGENT,
          prompt: 'x',
          model: 'm',
          provider: 'p',
          authType: 'api_key',
          displayName: null,
          position: 0,
          status: 'success',
          content: 'c',
          headers: null,
          errorMessage: null,
          metrics: { inputTokens: 1, outputTokens: 1, cost: 0, durationMs: 1 },
        }),
      ).resolves.toBeUndefined();
    });

    it('skips the column insert when ensureRun fails (FK would not resolve)', async () => {
      // The benchmark_columns row has a FK on benchmark_run_id; without a
      // benchmark_runs row there's nothing for the column to attach to. The
      // bare (no-tx) path swallows the ensureRun error and returns rather
      // than producing a dangling column-without-run.
      const { service, columnRepo, chain } = buildService();
      chain.execute.mockRejectedValueOnce(new Error('insert failed'));
      await service.saveColumn({
        userId: 'u',
        agent: AGENT,
        prompt: 'p',
        model: 'm',
        provider: 'pr',
        authType: 'api_key',
        displayName: null,
        position: 0,
        status: 'success',
        content: 'c',
        headers: null,
        errorMessage: null,
        metrics: { inputTokens: 1, outputTokens: 1, cost: 0, durationMs: 1 },
      });
      expect(columnRepo.insert).not.toHaveBeenCalled();
      expect(chain.select).not.toHaveBeenCalled();
    });

    it('handles a non-Error rejection from ensureRun and still skips the column insert', async () => {
      const { service, columnRepo, chain } = buildService();
      chain.execute.mockRejectedValueOnce('non-error rejection');
      await expect(
        service.saveColumn({
          userId: 'u',
          agent: AGENT,
          prompt: 'p',
          model: 'm',
          provider: 'pr',
          authType: 'api_key',
          displayName: null,
          position: 0,
          status: 'success',
          content: 'c',
          headers: null,
          errorMessage: null,
          metrics: { inputTokens: 1, outputTokens: 1, cost: 0, durationMs: 1 },
        }),
      ).resolves.toBeUndefined();
      expect(columnRepo.insert).not.toHaveBeenCalled();
    });

    it('treats a missing identifiers field as "did not insert"', async () => {
      // `(result.identifiers ?? []).length > 0` defends against drivers that
      // don't return identifiers; without identifiers we should *not* prune.
      const { service, chain } = buildService();
      chain.execute.mockResolvedValueOnce({});
      await service.saveColumn({
        userId: 'u',
        agent: AGENT,
        prompt: 'p',
        model: 'm',
        provider: 'pr',
        authType: 'api_key',
        displayName: null,
        position: 0,
        status: 'success',
        content: 'c',
        headers: null,
        errorMessage: null,
        metrics: { inputTokens: 1, outputTokens: 1, cost: 0, durationMs: 1 },
      });
      expect(chain.select).not.toHaveBeenCalled();
    });
  });

  describe('listRuns', () => {
    it('returns summaries with model names from joined columns and scopes by tenant', async () => {
      const { service, columnRepo, chain, tenantResolve } = buildService({ tenantId: 'tenant-1' });
      chain.getMany.mockResolvedValue([
        { id: 'r1', prompt: 'first', created_at: '2026-01-02T00:00:00Z' },
        { id: 'r2', prompt: 'second', created_at: '2026-01-01T00:00:00Z' },
      ]);
      columnRepo.find.mockResolvedValue([
        { benchmark_run_id: 'r1', model: 'gpt-4o', display_name: 'GPT-4o', position: 0 },
        { benchmark_run_id: 'r1', model: 'claude', display_name: 'Claude Sonnet', position: 1 },
        { benchmark_run_id: 'r2', model: 'gpt-4o-mini', display_name: null, position: 0 },
      ]);
      const result = await service.listRuns('user-1', 'agent-1');
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'r1',
        prompt: 'first',
        modelCount: 2,
        models: ['GPT-4o', 'Claude Sonnet'],
      });
      expect(result[1]).toMatchObject({
        id: 'r2',
        modelCount: 1,
        models: ['gpt-4o-mini'],
      });
      expect(tenantResolve).toHaveBeenCalledWith('user-1');
      // Ownership predicate must be tenant_id when a tenant is resolved —
      // bare user_id filtering would diverge from the project-wide pattern.
      expect(chain.andWhere).toHaveBeenCalledWith('r.tenant_id = :tenantId', {
        tenantId: 'tenant-1',
      });
    });

    it('falls back to user_id filtering when no tenant is resolved', async () => {
      const { service, chain } = buildService({ tenantId: null });
      chain.getMany.mockResolvedValue([]);
      await service.listRuns('user-2', 'agent-1');
      expect(chain.andWhere).toHaveBeenCalledWith('r.user_id = :userId', { userId: 'user-2' });
    });

    it('returns an empty list when the user has no runs for the agent', async () => {
      const { service, chain } = buildService();
      chain.getMany.mockResolvedValue([]);
      expect(await service.listRuns('u', 'a')).toEqual([]);
    });

    it('uses an empty model list when a run has no joined columns', async () => {
      // Hits the `modelsByRun.get(r.id) ?? []` fallback when one of the
      // returned runs has no columns at all (e.g. the column inserts failed
      // but the run row succeeded).
      const { service, columnRepo, chain } = buildService();
      chain.getMany.mockResolvedValue([
        { id: 'r1', prompt: 'p1', created_at: '2026-01-01T00:00:00Z' },
        { id: 'r2', prompt: 'p2', created_at: '2026-01-02T00:00:00Z' },
      ]);
      columnRepo.find.mockResolvedValue([
        { benchmark_run_id: 'r1', model: 'gpt-4o', display_name: null, position: 0 },
      ]);
      const result = await service.listRuns('u', 'a');
      const r2 = result.find((r) => r.id === 'r2');
      expect(r2?.models).toEqual([]);
      expect(r2?.modelCount).toBe(0);
    });
  });

  describe('getRun', () => {
    it('returns a detail with columns ordered by position', async () => {
      const { service, columnRepo, chain } = buildService();
      chain.getOne.mockResolvedValue({
        id: 'r1',
        prompt: 'p',
        created_at: '2026-01-01T00:00:00Z',
      });
      columnRepo.find.mockResolvedValue([
        {
          id: 'c1',
          model: 'gpt-4o',
          provider: 'openai',
          auth_type: 'api_key',
          display_name: 'GPT-4o',
          status: 'success',
          content: 'hello',
          headers: { 'x-rate': '1' },
          error_message: null,
          input_tokens: 10,
          output_tokens: 5,
          cost_usd: 0.001,
          duration_ms: 120,
          position: 0,
        },
        {
          id: 'c2',
          model: 'claude',
          provider: 'anthropic',
          auth_type: 'api_key',
          display_name: null,
          status: 'error',
          content: null,
          headers: null,
          error_message: 'rate limited',
          input_tokens: null,
          output_tokens: null,
          cost_usd: null,
          duration_ms: null,
          position: 1,
        },
      ]);
      const detail = await service.getRun('user-1', 'r1');
      expect(detail.columns).toHaveLength(2);
      // numericTransformer on the entity coerces string→number on reads in real
      // queries; in the unit test we feed a number directly to mirror the
      // contract.
      expect(detail.columns[0]?.metrics?.cost).toBe(0.001);
      expect(detail.columns[0]?.content).toBe('hello');
      expect(detail.columns[1]?.status).toBe('error');
      expect(detail.columns[1]?.metrics).toBeNull();
    });

    it('throws NotFoundException when the run does not belong to the user', async () => {
      const { service, chain } = buildService();
      chain.getOne.mockResolvedValue(null);
      await expect(service.getRun('other', 'r1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it("refuses to return another tenant's run (cross-user isolation)", async () => {
      // Regression: getRun used to filter by user_id only, diverging from the
      // project-wide tenant_id pattern. With the fix, the SELECT runs with
      // r.tenant_id = $1 — so a hostile request from user B for user A's
      // run id resolves to NotFound because their tenant differs.
      const { service, chain, tenantResolve } = buildService({ tenantId: 'tenant-attacker' });
      chain.getOne.mockResolvedValue(null);
      await expect(service.getRun('attacker', 'victim-run-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(tenantResolve).toHaveBeenCalledWith('attacker');
      expect(chain.andWhere).toHaveBeenCalledWith('r.tenant_id = :tenantId', {
        tenantId: 'tenant-attacker',
      });
    });

    it('returns an empty columns array when the run has no columns yet', async () => {
      const { service, columnRepo, chain } = buildService();
      chain.getOne.mockResolvedValue({
        id: 'r1',
        prompt: 'p',
        created_at: '2026-01-01T00:00:00Z',
      });
      columnRepo.find.mockResolvedValue([]);
      const detail = await service.getRun('u', 'r1');
      expect(detail.modelCount).toBe(0);
      expect(detail.models).toEqual([]);
      expect(detail.columns).toEqual([]);
    });

    it('coerces a null auth_type and null cost_usd to null in the column projection', async () => {
      // Covers the `(c.auth_type ?? null)` and `c.cost_usd ?? null`
      // fallbacks: success rows can land in the DB with no auth_type and a
      // null cost (e.g. a model with no pricing data).
      const { service, columnRepo, chain } = buildService();
      chain.getOne.mockResolvedValue({
        id: 'r1',
        prompt: 'p',
        created_at: '2026-01-01T00:00:00Z',
      });
      columnRepo.find.mockResolvedValue([
        {
          id: 'c1',
          model: 'm',
          provider: 'p',
          auth_type: null,
          display_name: null,
          status: 'success',
          content: 'hi',
          headers: null,
          error_message: null,
          input_tokens: 1,
          output_tokens: 1,
          cost_usd: null,
          duration_ms: 10,
          position: 0,
        },
      ]);
      const detail = await service.getRun('u', 'r1');
      expect(detail.columns[0]?.authType).toBeNull();
      expect(detail.columns[0]?.metrics?.cost).toBeNull();
    });
  });

  describe('pruneOldRuns', () => {
    it('deletes runs older than MAX_RUNS_PER_AGENT for this tenant+agent', async () => {
      const { service, runRepo, chain } = buildService({ tenantId: 'tenant-1' });
      // Run insert "succeeded" — owner triggers a prune.
      chain.execute.mockResolvedValueOnce({ identifiers: [{ id: 'fresh' }] });
      chain.getRawMany.mockResolvedValueOnce([{ id: 'old-1' }, { id: 'old-2' }]);
      await service.saveColumn({
        userId: 'u',
        agent: AGENT,
        prompt: 'x',
        model: 'm',
        provider: 'p',
        authType: 'api_key',
        displayName: null,
        position: 0,
        status: 'success',
        content: 'c',
        headers: null,
        errorMessage: null,
        metrics: { inputTokens: 1, outputTokens: 1, cost: 0, durationMs: 1 },
      });
      expect(runRepo.delete).toHaveBeenCalled();
      // Ensure the OFFSET uses the cap and the LIMIT keeps a single fetch bounded.
      expect(chain.offset).toHaveBeenCalledWith(MAX_RUNS_PER_AGENT);
      expect(chain.limit).toHaveBeenCalled();
      // Prune SELECT must be tenant-scoped.
      expect(chain.andWhere).toHaveBeenCalledWith('r.tenant_id = :tenantId', {
        tenantId: 'tenant-1',
      });
    });
  });
});
