import { Body, Controller, Get, Param, Patch, Post, Res } from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import type { PlaygroundHistoryRunDetail, PlaygroundHistoryRunSummary } from 'manifest-shared';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.instance';
import { PlaygroundService } from './playground.service';
import { PlaygroundHistoryService } from './playground-history.service';
import { PlaygroundAgentService } from './playground-agent.service';
import { RunPlaygroundDto } from './dto/run-playground.dto';
import { RunIdParamDto, SetBestColumnDto } from './dto/history.dto';

@Controller('api/v1/playground')
export class PlaygroundController {
  constructor(
    private readonly playgroundService: PlaygroundService,
    private readonly historyService: PlaygroundHistoryService,
    private readonly playgroundAgent: PlaygroundAgentService,
  ) {}

  // Resolves (creating on first use) the reserved per-tenant Playground agent and
  // returns its name. The frontend calls this on load, then uses the name to
  // fetch the Playground's available models / providers — guaranteeing the agent
  // exists before those by-name lookups run.
  @Get('agent')
  async getAgent(@CurrentUser() user: AuthUser): Promise<{ name: string }> {
    const agent = await this.playgroundAgent.resolve(user.id);
    return { name: agent.name };
  }

  @Post('run')
  async run(
    @CurrentUser() user: AuthUser,
    @Body() body: RunPlaygroundDto,
    @Res() res: ExpressResponse,
  ): Promise<void> {
    await this.playgroundService.runStream(user.id, body, res);
  }

  @Get('runs')
  async listRuns(@CurrentUser() user: AuthUser): Promise<PlaygroundHistoryRunSummary[]> {
    const agent = await this.playgroundAgent.resolve(user.id);
    return this.historyService.listRuns(user.id, agent.id);
  }

  @Get('runs/:runId')
  async getRun(
    @CurrentUser() user: AuthUser,
    @Param() params: RunIdParamDto,
  ): Promise<PlaygroundHistoryRunDetail> {
    const agent = await this.playgroundAgent.resolve(user.id);
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
