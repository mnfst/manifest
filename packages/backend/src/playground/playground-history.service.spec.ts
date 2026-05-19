import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { PlaygroundHistoryService, MAX_RUNS_PER_AGENT } from './playground-history.service';
import type { PlaygroundRun } from '../entities/playground-run.entity';
import type { PlaygroundColumn } from '../entities/playground-column.entity';

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

interface UpdateQbMock {
  update: jest.Mock;
  set: jest.Mock;
  where: jest.Mock;
  returning: jest.Mock;
  execute: jest.Mock;
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
  updateQb: UpdateQbMock;
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
  const updateQb: UpdateQbMock = {
    // TypeORM evaluates function-valued SET expressions (e.g.
    // `{ starred: () => 'NOT starred' }`) when building SQL. Invoke them here
    // so the inline expression callback is actually exercised, matching the
    // real QueryBuilder behaviour.
    update: jest.fn().mockReturnThis(),
    set: jest.fn((values: Record<string, unknown>) => {
      for (const v of Object.values(values)) {
        if (typeof v === 'function') (v as () => unknown)();
      }
      return updateQb;
    }),
    where: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1, raw: [{ starred: true }] }),
  };

  // The service uses three distinct query builders (insert via ensureRun,
  // select via pruneOldRuns, update via toggleStar/setBestColumn). A unified
  // proxy supporting every call pattern lets each consumer pick the chain it
  // needs. `where`/`execute` are shared method names, so dispatch by the
  // entry method: `.update()` switches the proxy onto the update chain.
  const qb = jest.fn().mockImplementation(() => {
    let mode: 'default' | 'update' = 'default';
    const proxy: Record<string, jest.Mock> = {
      // insert chain
      insert: insertQb.insert,
      into: insertQb.into,
      values: insertQb.values,
      orIgnore: insertQb.orIgnore,
      // select chain
      select: selectQb.select,
      andWhere: selectQb.andWhere,
      orderBy: selectQb.orderBy,
      offset: selectQb.offset,
      getRawMany: selectQb.getRawMany,
      // update chain entrypoint flips the dispatch mode
      update: jest.fn(() => {
        mode = 'update';
        return proxy;
      }),
      set: updateQb.set,
      returning: updateQb.returning,
      // shared method names — route by current mode
      where: jest.fn((...args: unknown[]) => {
        (mode === 'update' ? updateQb.where : selectQb.where)(...args);
        return proxy;
      }),
      execute: jest.fn((...args: unknown[]) =>
        mode === 'update' ? updateQb.execute(...args) : insertQb.execute(...args),
      ),
    };
    return proxy;
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
  return { runRepo, columnRepo, insertQb, selectQb, updateQb };
}

function buildService(): {
  service: PlaygroundHistoryService;
  runRepo: RepoMock;
  columnRepo: RepoMock;
  insertQb: InsertQbMock;
  selectQb: SelectQbMock;
  updateQb: UpdateQbMock;
} {
  const { runRepo, columnRepo, insertQb, selectQb, updateQb } = buildRepos();
  const service = new PlaygroundHistoryService(
    runRepo as unknown as Repository<PlaygroundRun>,
    columnRepo as unknown as Repository<PlaygroundColumn>,
  );
  return { service, runRepo, columnRepo, insertQb, selectQb, updateQb };
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

describe('PlaygroundHistoryService', () => {
  describe('saveColumn', () => {
    it('creates the run on first column and inserts the column', async () => {
      const { service, columnRepo, insertQb } = buildService();

      await service.saveColumn(baseInput());

      // ensureRun() insert-chain was driven
      expect(insertQb.insert).toHaveBeenCalledTimes(1);
      expect(insertQb.into).toHaveBeenCalledWith('playground_runs');
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
        playground_run_id: 'run-42',
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

    it('returns the generated columnId on the happy path', async () => {
      const { service } = buildService();
      const columnId = await service.saveColumn(baseInput());
      expect(columnId).toEqual(expect.any(String));
      expect((columnId as string).length).toBeGreaterThan(0);
    });

    it('still returns the generated columnId when ensureRun fails — history is best-effort', async () => {
      const { service, insertQb } = buildService();
      insertQb.execute.mockRejectedValueOnce(new Error('db down'));
      await expect(service.saveColumn(baseInput())).resolves.toEqual(expect.any(String));
    });

    it('returns null when the column insert fails — no fabricated, unpersisted id', async () => {
      const { service, columnRepo } = buildService();
      columnRepo.insert.mockRejectedValueOnce(new Error('column insert blew up'));
      const columnId = await service.saveColumn(baseInput());
      expect(columnId).toBeNull();
    });

    it('returns null when the column insert fails with a non-Error', async () => {
      const { service, columnRepo } = buildService();
      columnRepo.insert.mockRejectedValueOnce('string-failure');
      await expect(service.saveColumn(baseInput())).resolves.toBeNull();
    });

    it('swallows ensureRun non-Error rejections', async () => {
      const { service, insertQb } = buildService();
      insertQb.execute.mockRejectedValueOnce('weird-non-error');
      await expect(service.saveColumn(baseInput())).resolves.toEqual(expect.any(String));
    });

    it('treats a missing identifiers array as "row already existed"', async () => {
      const { service, columnRepo, insertQb } = buildService();
      // execute resolves with no `identifiers` key at all.
      insertQb.execute.mockResolvedValueOnce({});
      await service.saveColumn(baseInput());
      expect(columnRepo.insert).toHaveBeenCalledTimes(1);
    });

    it('swallows prune failures so the user-visible request still succeeds', async () => {
      const { service, runRepo, insertQb, selectQb } = buildService();
      // Winner: prune is attempted.
      insertQb.execute.mockResolvedValueOnce({ identifiers: [{ id: 'r1' }] });
      // SELECT returns surplus rows.
      selectQb.getRawMany.mockResolvedValueOnce([{ id: 'old-1' }]);
      // Delete throws.
      runRepo.delete.mockRejectedValueOnce(new Error('delete failed'));

      await expect(service.saveColumn(baseInput())).resolves.toEqual(expect.any(String));
      expect(runRepo.delete).toHaveBeenCalled();
    });

    it('swallows non-Error prune failures', async () => {
      const { service, runRepo, insertQb, selectQb } = buildService();
      insertQb.execute.mockResolvedValueOnce({ identifiers: [{ id: 'r1' }] });
      selectQb.getRawMany.mockResolvedValueOnce([{ id: 'old-1' }]);
      runRepo.delete.mockRejectedValueOnce('delete-string-failure');
      await expect(service.saveColumn(baseInput())).resolves.toEqual(expect.any(String));
    });
  });

  describe('listRuns', () => {
    it('returns summaries with model names from joined columns', async () => {
      const { service, runRepo, columnRepo } = buildService();
      runRepo.find.mockResolvedValue([
        {
          id: 'r1',
          prompt: 'first',
          created_at: '2026-01-02T00:00:00Z',
          starred: true,
          best_column_id: 'c-best',
        },
        {
          id: 'r2',
          prompt: 'second',
          created_at: '2026-01-01T00:00:00Z',
          starred: false,
          best_column_id: null,
        },
      ]);
      columnRepo.find.mockResolvedValue([
        { playground_run_id: 'r1', model: 'gpt-4o', display_name: 'GPT-4o', position: 0 },
        { playground_run_id: 'r1', model: 'claude', display_name: 'Claude Sonnet', position: 1 },
        { playground_run_id: 'r2', model: 'gpt-4o-mini', display_name: null, position: 0 },
      ]);
      const result = await service.listRuns('user-1', 'agent-1');
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'r1',
        prompt: 'first',
        modelCount: 2,
        models: ['GPT-4o', 'Claude Sonnet'],
        starred: true,
        bestColumnId: 'c-best',
      });
      expect(result[1]).toMatchObject({
        id: 'r2',
        modelCount: 1,
        models: ['gpt-4o-mini'],
        starred: false,
        bestColumnId: null,
      });
    });

    it('coerces an undefined best_column_id to null in the summary', async () => {
      const { service, runRepo, columnRepo } = buildService();
      runRepo.find.mockResolvedValue([
        { id: 'r1', prompt: 'p', created_at: '2026-01-01T00:00:00Z' },
      ]);
      columnRepo.find.mockResolvedValue([]);
      const result = await service.listRuns('u', 'a');
      expect(result[0]?.bestColumnId).toBeNull();
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
        starred: true,
        best_column_id: 'c1',
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
      expect(detail.starred).toBe(true);
      expect(detail.bestColumnId).toBe('c1');
    });

    it('coerces an undefined best_column_id to null in the detail', async () => {
      const { service, runRepo, columnRepo } = buildService();
      runRepo.findOne.mockResolvedValue({
        id: 'r1',
        prompt: 'p',
        created_at: '2026-01-01T00:00:00Z',
      });
      columnRepo.find.mockResolvedValue([]);
      const detail = await service.getRun('user-1', 'r1');
      expect(detail.bestColumnId).toBeNull();
    });

    it('null-coalesces auth_type and a null cost on an otherwise-metric success column', async () => {
      const { service, runRepo, columnRepo } = buildService();
      runRepo.findOne.mockResolvedValue({
        id: 'r1',
        prompt: 'p',
        created_at: '2026-01-01T00:00:00Z',
        starred: false,
        best_column_id: null,
      });
      columnRepo.find.mockResolvedValue([
        {
          id: 'c1',
          model: 'm',
          provider: 'p',
          // auth_type null → exercises the `?? null` fallback (line 199).
          auth_type: null,
          display_name: null,
          status: 'success',
          content: 'ok',
          headers: null,
          error_message: null,
          // tokens present so hasMetrics is true, but cost_usd is null →
          // exercises the `cost_usd != null ? ... : null` false branch (209).
          input_tokens: 4,
          output_tokens: 2,
          cost_usd: null,
          duration_ms: 50,
          position: 0,
        },
      ]);
      const detail = await service.getRun('user-1', 'r1');
      expect(detail.columns[0]?.authType).toBeNull();
      expect(detail.columns[0]?.metrics).toEqual({
        inputTokens: 4,
        outputTokens: 2,
        cost: null,
        durationMs: 50,
      });
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

  describe('toggleStar', () => {
    it('flips starred via an atomic user-scoped update and returns the new value', async () => {
      const { service, updateQb } = buildService();
      updateQb.execute.mockResolvedValueOnce({ affected: 1, raw: [{ starred: false }] });

      const starred = await service.toggleStar('user-1', 'run-1');

      expect(starred).toBe(false);
      expect(updateQb.where).toHaveBeenCalledWith('id = :runId AND user_id = :userId', {
        runId: 'run-1',
        userId: 'user-1',
      });
      expect(updateQb.returning).toHaveBeenCalledWith('starred');
    });

    it('throws NotFoundException when no row was updated', async () => {
      const { service, updateQb } = buildService();
      updateQb.execute.mockResolvedValueOnce({ affected: 0, raw: [] });
      await expect(service.toggleStar('user-1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('setBestColumn', () => {
    it('sets the best column after verifying it belongs to the run', async () => {
      const { service, columnRepo, updateQb } = buildService();
      columnRepo.findOne.mockResolvedValue({ id: 'col-1' });
      updateQb.execute.mockResolvedValueOnce({ affected: 1, raw: [{ best_column_id: 'col-1' }] });

      const best = await service.setBestColumn('user-1', 'run-1', 'col-1');

      expect(best).toBe('col-1');
      expect(columnRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'col-1', playground_run_id: 'run-1' },
        select: ['id'],
      });
      expect(updateQb.set).toHaveBeenCalledWith({ best_column_id: 'col-1' });
      expect(updateQb.where).toHaveBeenCalledWith('id = :runId AND user_id = :userId', {
        runId: 'run-1',
        userId: 'user-1',
      });
      expect(updateQb.returning).toHaveBeenCalledWith('best_column_id');
    });

    it('clears the pick (columnId null) without a column ownership lookup', async () => {
      const { service, columnRepo, updateQb } = buildService();
      updateQb.execute.mockResolvedValueOnce({ affected: 1, raw: [{ best_column_id: null }] });

      const best = await service.setBestColumn('user-1', 'run-1', null);

      expect(best).toBeNull();
      expect(columnRepo.findOne).not.toHaveBeenCalled();
      expect(updateQb.set).toHaveBeenCalledWith({ best_column_id: null });
    });

    it('throws NotFoundException when the column does not belong to the run', async () => {
      const { service, columnRepo } = buildService();
      columnRepo.findOne.mockResolvedValue(null);
      await expect(
        service.setBestColumn('user-1', 'run-1', 'cross-run-col'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when the run is missing / not owned by the user', async () => {
      const { service, columnRepo, updateQb } = buildService();
      columnRepo.findOne.mockResolvedValue({ id: 'col-1' });
      updateQb.execute.mockResolvedValueOnce({ affected: 0, raw: [] });
      await expect(service.setBestColumn('user-1', 'run-1', 'col-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('coerces an undefined returned best_column_id to null', async () => {
      const { service, updateQb } = buildService();
      updateQb.execute.mockResolvedValueOnce({ affected: 1, raw: [{}] });
      const best = await service.setBestColumn('user-1', 'run-1', null);
      expect(best).toBeNull();
    });
  });
});
