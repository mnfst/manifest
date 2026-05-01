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

function buildRepos(): { runRepo: RepoMock; columnRepo: RepoMock; qb: jest.Mock } {
  const qb = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
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
  return { runRepo, columnRepo, qb };
}

function buildService(): {
  service: BenchmarkHistoryService;
  runRepo: RepoMock;
  columnRepo: RepoMock;
  qb: jest.Mock;
} {
  const { runRepo, columnRepo, qb } = buildRepos();
  const service = new BenchmarkHistoryService(
    runRepo as unknown as Repository<BenchmarkRun>,
    columnRepo as unknown as Repository<BenchmarkColumn>,
  );
  return { service, runRepo, columnRepo, qb };
}

const AGENT = { id: 'agent-1', tenant_id: 'tenant-1', name: 'demo' };

describe('BenchmarkHistoryService', () => {
  describe('saveColumn', () => {
    it('creates the run on first column and inserts the column', async () => {
      const { service, runRepo, columnRepo } = buildService();
      runRepo.findOne.mockResolvedValue(null);
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
      expect(runRepo.insert).toHaveBeenCalledTimes(1);
      expect(runRepo.insert.mock.calls[0][0]).toMatchObject({
        user_id: 'user-1',
        agent_id: 'agent-1',
        prompt: 'hello world',
      });
      expect(columnRepo.insert).toHaveBeenCalledTimes(1);
      expect(columnRepo.insert.mock.calls[0][0]).toMatchObject({
        model: 'openai/gpt-4o-mini',
        status: 'success',
        content: 'hi there',
        input_tokens: 5,
        output_tokens: 2,
      });
    });

    it('reuses an existing run when runId is provided and does not create a duplicate', async () => {
      const { service, runRepo, columnRepo } = buildService();
      runRepo.findOne.mockResolvedValue({ id: 'run-42' } as BenchmarkRun);
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
      expect(runRepo.insert).not.toHaveBeenCalled();
      expect(columnRepo.insert).toHaveBeenCalledTimes(1);
      expect(columnRepo.insert.mock.calls[0][0]).toMatchObject({
        benchmark_run_id: 'run-42',
        status: 'error',
        error_message: 'boom',
        position: 1,
      });
    });

    it('truncates very long prompts before insert', async () => {
      const { service, runRepo } = buildService();
      runRepo.findOne.mockResolvedValue(null);
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
      const inserted = runRepo.insert.mock.calls[0][0] as { prompt: string };
      expect(inserted.prompt.length).toBe(10_000);
    });

    it('does not throw when persistence fails — history is best-effort', async () => {
      const { service, runRepo } = buildService();
      runRepo.findOne.mockRejectedValue(new Error('db down'));
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
  });

  describe('pruneOldRuns', () => {
    it('deletes runs older than MAX_RUNS_PER_AGENT for this user+agent', async () => {
      const { service, runRepo, qb } = buildService();
      runRepo.findOne.mockResolvedValue(null);
      qb().getRawMany.mockResolvedValue([{ id: 'old-1' }, { id: 'old-2' }]);
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
      // Ensure the OFFSET uses the cap
      expect(qb().offset).toHaveBeenCalledWith(MAX_RUNS_PER_AGENT);
    });
  });
});
