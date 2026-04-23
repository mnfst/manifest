import { BenchmarkController } from './benchmark.controller';
import type { BenchmarkService } from './benchmark.service';
import type { BenchmarkHistoryService } from './benchmark-history.service';
import type { ResolveAgentService } from '../routing/routing-core/resolve-agent.service';
import type { RunBenchmarkDto } from './dto/run-benchmark.dto';

const USER = { id: 'user-1', name: 'u', email: 'u@test' } as never;

function build() {
  const benchmarkService = { run: jest.fn() };
  const historyService = { listRuns: jest.fn(), getRun: jest.fn() };
  const resolveAgent = { resolve: jest.fn() };
  const controller = new BenchmarkController(
    benchmarkService as unknown as BenchmarkService,
    historyService as unknown as BenchmarkHistoryService,
    resolveAgent as unknown as ResolveAgentService,
  );
  return { controller, benchmarkService, historyService, resolveAgent };
}

describe('BenchmarkController', () => {
  describe('run', () => {
    it('delegates to BenchmarkService.run with the current user and DTO body', async () => {
      const { controller, benchmarkService } = build();
      const result = {
        content: 'hi',
        metrics: { cost: 0, inputTokens: 1, outputTokens: 1, durationMs: 1 },
        headers: {},
      };
      benchmarkService.run.mockResolvedValue(result);
      const dto = {
        agentName: 'demo',
        model: 'm',
        provider: 'openai',
        messages: [{ role: 'user', content: 'hi' }],
      } as RunBenchmarkDto;
      await expect(controller.run(USER, dto)).resolves.toBe(result);
      expect(benchmarkService.run).toHaveBeenCalledWith('user-1', dto);
    });
  });

  describe('listRuns', () => {
    it('resolves the agent then delegates to BenchmarkHistoryService.listRuns', async () => {
      const { controller, historyService, resolveAgent } = build();
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-1', name: 'demo' });
      historyService.listRuns.mockResolvedValue([]);
      await controller.listRuns(USER, { agentName: 'demo' });
      expect(resolveAgent.resolve).toHaveBeenCalledWith('user-1', 'demo');
      expect(historyService.listRuns).toHaveBeenCalledWith('user-1', 'agent-1');
    });
  });

  describe('getRun', () => {
    it('delegates to BenchmarkHistoryService.getRun with the user and runId', async () => {
      const { controller, historyService } = build();
      const detail = {
        id: 'r1',
        prompt: 'p',
        createdAt: '',
        modelCount: 0,
        models: [],
        columns: [],
      };
      historyService.getRun.mockResolvedValue(detail);
      const result = await controller.getRun(USER, { runId: 'r1' });
      expect(historyService.getRun).toHaveBeenCalledWith('user-1', 'r1');
      expect(result).toBe(detail);
    });
  });
});
