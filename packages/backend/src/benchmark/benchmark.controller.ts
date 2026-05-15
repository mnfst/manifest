import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
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
    @Query() query: ListHistoryQueryDto,
  ): Promise<BenchmarkHistoryRunDetail> {
    const agent = await this.resolveAgent.resolve(user.id, query.agentName);
    return this.historyService.getRun(user.id, params.runId, agent.id);
  }

  @Patch('runs/:runId/star')
  async toggleStar(
    @CurrentUser() user: AuthUser,
    @Param() params: RunIdParamDto,
  ): Promise<{ starred: boolean }> {
    const starred = await this.historyService.toggleStar(user.id, params.runId);
    return { starred };
  }
}
