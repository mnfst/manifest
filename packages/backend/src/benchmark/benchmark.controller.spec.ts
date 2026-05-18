import { Test, type TestingModule } from '@nestjs/testing';
import { BenchmarkController } from './benchmark.controller';
import { BenchmarkService } from './benchmark.service';
import { BenchmarkHistoryService } from './benchmark-history.service';
import { ResolveAgentService } from '../routing/routing-core/resolve-agent.service';
import type { AuthUser } from '../auth/auth.instance';
import type { RunBenchmarkDto } from './dto/run-benchmark.dto';

const USER: AuthUser = {
  id: 'user-1',
  name: 'tester',
  email: 't@example.com',
} as unknown as AuthUser;

const AGENT = { id: 'agent-1', tenant_id: 'tenant-1', name: 'demo' };

describe('BenchmarkController', () => {
  let controller: BenchmarkController;
  let benchmarkRun: jest.Mock;
  let listRuns: jest.Mock;
  let getRun: jest.Mock;
  let resolveAgent: jest.Mock;

  beforeEach(async () => {
    benchmarkRun = jest.fn();
    listRuns = jest.fn();
    getRun = jest.fn();
    resolveAgent = jest.fn().mockResolvedValue(AGENT);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BenchmarkController],
      providers: [
        { provide: BenchmarkService, useValue: { run: benchmarkRun } },
        {
          provide: BenchmarkHistoryService,
          useValue: { listRuns, getRun },
        },
        { provide: ResolveAgentService, useValue: { resolve: resolveAgent } },
      ],
    }).compile();

    controller = module.get(BenchmarkController);
  });

  describe('POST /benchmark/run', () => {
    it('delegates to BenchmarkService.run with the user id and dto', async () => {
      const dto = {
        agentName: 'demo',
        model: 'openai/gpt-4o-mini',
        provider: 'openai',
        messages: [{ role: 'user', content: 'hi' }],
      } as unknown as RunBenchmarkDto;
      const result = {
        content: 'hi',
        metrics: { cost: 0.001, inputTokens: 1, outputTokens: 1, durationMs: 10 },
        headers: {},
      };
      benchmarkRun.mockResolvedValue(result);

      const out = await controller.run(USER, dto);

      expect(benchmarkRun).toHaveBeenCalledWith('user-1', dto);
      expect(out).toBe(result);
    });
  });

  describe('GET /benchmark/runs', () => {
    it('resolves the agent first then forwards user+agent to listRuns', async () => {
      listRuns.mockResolvedValue([
        { id: 'r1', prompt: 'p', createdAt: 'now', modelCount: 1, models: ['m'] },
      ]);

      const out = await controller.listRuns(USER, { agentName: 'demo' });

      expect(resolveAgent).toHaveBeenCalledWith('user-1', 'demo');
      expect(listRuns).toHaveBeenCalledWith('user-1', 'agent-1');
      expect(out).toHaveLength(1);
    });
  });

  describe('GET /benchmark/runs/:runId', () => {
    it('passes the resolved agentId through to the history lookup', async () => {
      getRun.mockResolvedValue({
        id: 'r1',
        prompt: 'p',
        createdAt: 'now',
        modelCount: 0,
        models: [],
        columns: [],
      });

      const out = await controller.getRun(USER, { runId: 'r1' }, { agentName: 'demo' });

      expect(resolveAgent).toHaveBeenCalledWith('user-1', 'demo');
      // The agent ownership check requires the third argument to be the
      // resolved agent's id — matches the post-3b4ae6f08 change.
      expect(getRun).toHaveBeenCalledWith('user-1', 'r1', 'agent-1');
      expect(out.id).toBe('r1');
    });

    it('propagates errors from the history service', async () => {
      const err = new Error('not found');
      getRun.mockRejectedValue(err);
      await expect(controller.getRun(USER, { runId: 'r1' }, { agentName: 'demo' })).rejects.toBe(
        err,
      );
    });
  });
});
