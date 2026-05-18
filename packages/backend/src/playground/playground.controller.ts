import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import type { PlaygroundHistoryRunDetail, PlaygroundHistoryRunSummary } from 'manifest-shared';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.instance';
import { PlaygroundService } from './playground.service';
import { PlaygroundHistoryService } from './playground-history.service';
import { ResolveAgentService } from '../routing/routing-core/resolve-agent.service';
import { RunPlaygroundDto } from './dto/run-playground.dto';
import { ListHistoryQueryDto, RunIdParamDto, SetBestColumnDto } from './dto/history.dto';

@Controller('api/v1/playground')
export class PlaygroundController {
  constructor(
    private readonly playgroundService: PlaygroundService,
    private readonly historyService: PlaygroundHistoryService,
    private readonly resolveAgent: ResolveAgentService,
  ) {}

  @Post('run')
  async run(
    @CurrentUser() user: AuthUser,
    @Body() body: RunPlaygroundDto,
    @Res() res: ExpressResponse,
  ): Promise<void> {
    await this.playgroundService.runStream(user.id, body, res);
  }

  @Get('runs')
  async listRuns(
    @CurrentUser() user: AuthUser,
    @Query() query: ListHistoryQueryDto,
  ): Promise<PlaygroundHistoryRunSummary[]> {
    const agent = await this.resolveAgent.resolve(user.id, query.agentName);
    return this.historyService.listRuns(user.id, agent.id);
  }

  @Get('runs/:runId')
  async getRun(
    @CurrentUser() user: AuthUser,
    @Param() params: RunIdParamDto,
    @Query() query: ListHistoryQueryDto,
  ): Promise<PlaygroundHistoryRunDetail> {
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

  @Patch('runs/:runId/best')
  async setBest(
    @CurrentUser() user: AuthUser,
    @Param() params: RunIdParamDto,
    @Body() body: SetBestColumnDto,
  ): Promise<{ bestColumnId: string | null }> {
    const bestColumnId = await this.historyService.setBestColumn(
      user.id,
      params.runId,
      body.columnId,
    );
    return { bestColumnId };
  }
}
