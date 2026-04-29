import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {
  BenchmarkHistoryRunDetail,
  BenchmarkHistoryRunSummary,
  BenchmarkRunResult,
} from 'manifest-shared';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.instance';
import { BenchmarkService } from './benchmark.service';
import { BenchmarkHistoryService } from './benchmark-history.service';
import { ResolveAgentService } from '../routing/routing-core/resolve-agent.service';
import { RunBenchmarkDto } from './dto/run-benchmark.dto';
import { ListHistoryQueryDto, RunIdParamDto } from './dto/history.dto';

@Controller('api/v1/benchmark')
export class BenchmarkController {
  constructor(
    private readonly benchmarkService: BenchmarkService,
    private readonly historyService: BenchmarkHistoryService,
    private readonly resolveAgent: ResolveAgentService,
  ) {}

  /**
   * Tighter throttle than the global default (100/60s). Each click in the UI
   * fans out up to MAX_COLUMNS=6 requests; the per-user concurrency cap in
   * `BenchmarkService.run()` already bounds *parallelism*, but the throttle
   * caps *churn* (e.g. a script repeatedly clicking Run).
   */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('run')
  async run(
    @CurrentUser() user: AuthUser,
    @Body() body: RunBenchmarkDto,
  ): Promise<BenchmarkRunResult> {
    return this.benchmarkService.run(user.id, body);
  }

  @Get('runs')
  async listRuns(
    @CurrentUser() user: AuthUser,
    @Query() query: ListHistoryQueryDto,
  ): Promise<BenchmarkHistoryRunSummary[]> {
    const agent = await this.resolveAgent.resolve(user.id, query.agentName);
    return this.historyService.listRuns(user.id, agent.id);
  }

  @Get('runs/:runId')
  async getRun(
    @CurrentUser() user: AuthUser,
    @Param() params: RunIdParamDto,
  ): Promise<BenchmarkHistoryRunDetail> {
    return this.historyService.getRun(user.id, params.runId);
  }
}
