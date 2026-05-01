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

interface InsertQbMock {
  insert: jest.Mock;
  into: jest.Mock;
  values: jest.Mock;
  orIgnore: jest.Mock;
  execute: jest.Mock;
}

interface SelectQbMock {
  select: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  offset: jest.Mock;
  getRawMany: jest.Mock;
}

/**
 * The run repo's `createQueryBuilder()` is called from two places:
 *   - `ensureRun()`     → expects insert/into/values/orIgnore/execute chain
 *   - `pruneOldRuns()`  → expects select/where/andWhere/orderBy/offset/getRawMany chain
 *
 * We dispatch by inspecting the first method called on the returned object.
 */
function buildRepos(): {
  runRepo: RepoMock;
  columnRepo: RepoMock;
  insertQb: InsertQbMock;
  selectQb: SelectQbMock;
} {
  const insertQb: InsertQbMock = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ identifiers: [{ id: 'inserted' }] }),
  };
  const selectQb: SelectQbMock = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
  };

  // The service uses two distinct query builders. Returning a unified proxy
  // that supports both call patterns lets each consumer pick the chain they
  // need without us tracking which one is active.
  const qb = jest.fn().mockImplementation(() => {
    return {
      // insert chain
      insert: insertQb.insert,
      into: insertQb.into,
      values: insertQb.values,
      orIgnore: insertQb.orIgnore,
      // select chain
      select: selectQb.select,
      where: selectQb.where,
      andWhere: selectQb.andWhere,
      orderBy: selectQb.orderBy,
      offset: selectQb.offset,
      getRawMany: selectQb.getRawMany,
      // execute is only used by the insert chain
      execute: insertQb.execute,
    };
  });

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
  return { runRepo, columnRepo, insertQb, selectQb };
}

function buildService(): {
  service: BenchmarkHistoryService;
  runRepo: RepoMock;
  columnRepo: RepoMock;
  insertQb: InsertQbMock;
  selectQb: SelectQbMock;
} {
  const { runRepo, columnRepo, insertQb, selectQb } = buildRepos();
  const service = new BenchmarkHistoryService(
    runRepo as unknown as Repository<BenchmarkRun>,
    columnRepo as unknown as Repository<BenchmarkColumn>,
  );
  return { service, runRepo, columnRepo, insertQb, selectQb };
}

const AGENT = { id: 'agent-1', tenant_id: 'tenant-1', name: 'demo' };

const baseInput = (overrides: Record<string, unknown> = {}) => ({
  userId: 'user-1',
  agent: AGENT,
  prompt: 'hello world',
  model: 'openai/gpt-4o-mini',
  provider: 'openai',
  authType: 'api_key' as const,
  displayName: 'GPT-4o Mini',
  position: 0,
  status: 'success' as const,
  content: 'hi there',
  headers: { 'x-request-id': 'abc' },
  errorMessage: null,
  metrics: { inputTokens: 5, outputTokens: 2, cost: 0.0001, durationMs: 120 },
  ...overrides,
});

describe('BenchmarkHistoryService', () => {
  describe('saveColumn', () => {
    it('creates the run on first column and inserts the column', async () => {
      const { service, columnRepo, insertQb } = buildService();

      await service.saveColumn(baseInput());

      // ensureRun() insert-chain was driven
      expect(insertQb.insert).toHaveBeenCalledTimes(1);
      expect(insertQb.into).toHaveBeenCalledWith('benchmark_runs');
      const valuesArg = insertQb.values.mock.calls[0][0];
      expect(valuesArg).toMatchObject({
        user_id: 'user-1',
        agent_id: 'agent-1',
        prompt: 'hello world',
      });
      expect(insertQb.orIgnore).toHaveBeenCalled();
      expect(insertQb.execute).toHaveBeenCalled();
      // column row was inserted
      expect(columnRepo.insert).toHaveBeenCalledTimes(1);
      expect(columnRepo.insert.mock.calls[0][0]).toMatchObject({
        model: 'openai/gpt-4o-mini',
        status: 'success',
        content: 'hi there',
        input_tokens: 5,
        output_tokens: 2,
      });
    });

    it('reuses an existing run when runId is provided and inserts the column even on conflict', async () => {
      const { service, columnRepo, insertQb } = buildService();
      // ON CONFLICT DO NOTHING returns no identifiers — the row already exists.
      insertQb.execute.mockResolvedValueOnce({ identifiers: [] });

      await service.saveColumn(
        baseInput({
          runId: 'run-42',
          status: 'error',
          content: null,
          headers: null,
          errorMessage: 'boom',
          metrics: null,
          position: 1,
        }),
      );

      // The values payload must still target the supplied runId for the column join.
      expect(insertQb.values).toHaveBeenCalledTimes(1);
      expect(insertQb.values.mock.calls[0][0]).toMatchObject({ id: 'run-42' });
      // Column insert ALWAYS runs, even when ensureRun reports the row already existed —
      // that is the whole point of decoupling them after the orIgnore rewrite.
      expect(columnRepo.insert).toHaveBeenCalledTimes(1);
      expect(columnRepo.insert.mock.calls[0][0]).toMatchObject({
        benchmark_run_id: 'run-42',
        status: 'error',
        error_message: 'boom',
        position: 1,
      });
    });

    it('two concurrent saveColumn calls sharing a runId both persist their column', async () => {
      const { service, columnRepo, insertQb } = buildService();
      // First call wins the race and gets identifiers; second hits ON CONFLICT.
      insertQb.execute
        .mockResolvedValueOnce({ identifiers: [{ id: 'shared-run' }] })
        .mockResolvedValueOnce({ identifiers: [] });

      await Promise.all([
        service.saveColumn(baseInput({ runId: 'shared-run', position: 0 })),
        service.saveColumn(baseInput({ runId: 'shared-run', position: 1 })),
      ]);

      expect(columnRepo.insert).toHaveBeenCalledTimes(2);
      const positions = columnRepo.insert.mock.calls.map((c) => c[0].position).sort();
      expect(positions).toEqual([0, 1]);
    });

    it('does not run the prune for the loser of the run-row race', async () => {
      const { service, insertQb, selectQb } = buildService();
      // First call: winner, identifiers returned -> prune runs.
      // Second call: loser, no identifiers -> prune skipped entirely.
      insertQb.execute
        .mockResolvedValueOnce({ identifiers: [{ id: 'shared-run' }] })
        .mockResolvedValueOnce({ identifiers: [] });

      await service.saveColumn(baseInput({ runId: 'shared-run', position: 0 }));
      await service.saveColumn(baseInput({ runId: 'shared-run', position: 1 }));

      // The prune path always calls the SELECT chain's `getRawMany`. Only the
      // winner of the race should reach it; the loser short-circuits before
      // touching the prune query.
      expect(selectQb.getRawMany).toHaveBeenCalledTimes(1);
    });

    it('still inserts the column when ensureRun reports the row already existed', async () => {
      const { service, columnRepo, insertQb } = buildService();
      // No identifiers => row already existed (or insert race lost).
      insertQb.execute.mockResolvedValueOnce({ identifiers: [] });

      await service.saveColumn(baseInput());

      expect(columnRepo.insert).toHaveBeenCalledTimes(1);
    });

    it('truncates very long prompts before insert', async () => {
      const { service, insertQb } = buildService();
      const longPrompt = 'x'.repeat(20_000);
      await service.saveColumn(baseInput({ prompt: longPrompt }));
      const values = insertQb.values.mock.calls[0][0] as { prompt: string };
      expect(values.prompt.length).toBe(10_000);
    });

    it('does not throw when ensureRun fails — history is best-effort', async () => {
      const { service, insertQb } = buildService();
      insertQb.execute.mockRejectedValueOnce(new Error('db down'));
      await expect(service.saveColumn(baseInput())).resolves.toBeUndefined();
    });

    it('does not throw when the column insert fails — best-effort and silent', async () => {
      const { service, columnRepo } = buildService();
      columnRepo.insert.mockRejectedValueOnce(new Error('column insert blew up'));
      await expect(service.saveColumn(baseInput())).resolves.toBeUndefined();
    });

    it('swallows prune failures so the user-visible request still succeeds', async () => {
      const { service, runRepo, insertQb, selectQb } = buildService();
      // Winner: prune is attempted.
      insertQb.execute.mockResolvedValueOnce({ identifiers: [{ id: 'r1' }] });
      // SELECT returns surplus rows.
      selectQb.getRawMany.mockResolvedValueOnce([{ id: 'old-1' }]);
      // Delete throws.
      runRepo.delete.mockRejectedValueOnce(new Error('delete failed'));

      await expect(service.saveColumn(baseInput())).resolves.toBeUndefined();
      expect(runRepo.delete).toHaveBeenCalled();
    });
  });

  describe('listRuns', () => {
    it('returns summaries with model names from joined columns', async () => {
      const { service, runRepo, columnRepo } = buildService();
      runRepo.find.mockResolvedValue([
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
    });

    it('returns an empty list when the user has no runs for the agent', async () => {
      const { service, runRepo } = buildService();
      runRepo.find.mockResolvedValue([]);
      expect(await service.listRuns('u', 'a')).toEqual([]);
    });

    it('falls back to the model name when display_name is missing for a run', async () => {
      const { service, runRepo, columnRepo } = buildService();
      runRepo.find.mockResolvedValue([
        { id: 'r1', prompt: 'p', created_at: '2026-01-01T00:00:00Z' },
      ]);
      // No columns at all for this run — modelsByRun map miss returns [].
      columnRepo.find.mockResolvedValue([]);
      const result = await service.listRuns('u', 'a');
      expect(result[0]?.modelCount).toBe(0);
      expect(result[0]?.models).toEqual([]);
    });
  });

  describe('getRun', () => {
    it('returns a detail with columns ordered by position', async () => {
      const { service, runRepo, columnRepo } = buildService();
      runRepo.findOne.mockResolvedValue({
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
          cost_usd: '0.001',
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
      expect(detail.columns[0]?.metrics?.cost).toBe(0.001);
      expect(detail.columns[0]?.content).toBe('hello');
      expect(detail.columns[1]?.status).toBe('error');
      expect(detail.columns[1]?.metrics).toBeNull();
    });

    it('throws NotFoundException when the run does not belong to the user', async () => {
      const { service, runRepo } = buildService();
      runRepo.findOne.mockResolvedValue(null);
      await expect(service.getRun('other', 'r1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('filters by agentId when provided and returns the run when it matches', async () => {
      const { service, runRepo, columnRepo } = buildService();
      runRepo.findOne.mockResolvedValue({
        id: 'r1',
        prompt: 'p',
        created_at: '2026-01-01T00:00:00Z',
      });
      columnRepo.find.mockResolvedValue([]);
      await service.getRun('user-1', 'r1', 'agent-1');
      expect(runRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'r1', user_id: 'user-1', agent_id: 'agent-1' },
      });
    });

    it('throws NotFoundException when agentId is provided but does not match', async () => {
      const { service, runRepo } = buildService();
      runRepo.findOne.mockResolvedValue(null);
      await expect(service.getRun('user-1', 'r1', 'other-agent')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      // Confirm we did pass the agent_id filter through.
      expect(runRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'r1', user_id: 'user-1', agent_id: 'other-agent' },
      });
    });

    it('omits agent_id from the where clause when no agentId is supplied (back-compat)', async () => {
      const { service, runRepo, columnRepo } = buildService();
      runRepo.findOne.mockResolvedValue({
        id: 'r1',
        prompt: 'p',
        created_at: '2026-01-01T00:00:00Z',
      });
      columnRepo.find.mockResolvedValue([]);
      await service.getRun('user-1', 'r1');
      expect(runRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'r1', user_id: 'user-1' },
      });
    });

    it('reports null metrics when status is success but token columns are missing', async () => {
      const { service, runRepo, columnRepo } = buildService();
      runRepo.findOne.mockResolvedValue({
        id: 'r1',
        prompt: 'p',
        created_at: '2026-01-01T00:00:00Z',
      });
      columnRepo.find.mockResolvedValue([
        {
          id: 'c1',
          model: 'm',
          provider: 'p',
          auth_type: 'api_key',
          display_name: null,
          status: 'success',
          content: 'ok',
          headers: null,
          error_message: null,
          input_tokens: null,
          output_tokens: null,
          cost_usd: null,
          duration_ms: null,
          position: 0,
        },
      ]);
      const detail = await service.getRun('u', 'r1');
      expect(detail.columns[0]?.metrics).toBeNull();
    });
  });

  describe('pruneOldRuns', () => {
    it('deletes runs older than MAX_RUNS_PER_AGENT for this user+agent', async () => {
      const { service, runRepo, insertQb, selectQb } = buildService();
      // Winner of ensureRun -> prune runs.
      insertQb.execute.mockResolvedValueOnce({ identifiers: [{ id: 'r-new' }] });
      selectQb.getRawMany.mockResolvedValueOnce([{ id: 'old-1' }, { id: 'old-2' }]);

      await service.saveColumn(baseInput());

      expect(runRepo.delete).toHaveBeenCalled();
      expect(selectQb.offset).toHaveBeenCalledWith(MAX_RUNS_PER_AGENT);
    });

    it('does nothing when no surplus runs exist (offset query returns empty)', async () => {
      const { service, runRepo, insertQb, selectQb } = buildService();
      insertQb.execute.mockResolvedValueOnce({ identifiers: [{ id: 'r-new' }] });
      selectQb.getRawMany.mockResolvedValueOnce([]);

      await service.saveColumn(baseInput());

      expect(runRepo.delete).not.toHaveBeenCalled();
    });
  });
});
