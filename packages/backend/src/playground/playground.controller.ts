import { Body, Controller, Get, Param, Patch, Post, Res } from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import type { PlaygroundHistoryRunDetail, PlaygroundHistoryRunSummary } from 'manifest-shared';
import { TenantCtx, TenantContext } from '../common/decorators/tenant-context.decorator';
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
  async getAgent(@TenantCtx() ctx: TenantContext): Promise<{ name: string }> {
    const agent = await this.playgroundAgent.resolve(ctx);
    return { name: agent.name };
  }

  @Post('run')
  async run(
    @TenantCtx() ctx: TenantContext,
    @Body() body: RunPlaygroundDto,
    @Res() res: ExpressResponse,
  ): Promise<void> {
    await this.playgroundService.runStream(ctx, body, res);
  }

  @Get('runs')
  async listRuns(@TenantCtx() ctx: TenantContext): Promise<PlaygroundHistoryRunSummary[]> {
    const agent = await this.playgroundAgent.resolve(ctx);
    return this.historyService.listRuns(agent.tenant_id, agent.id);
  }

  @Get('runs/:runId')
  async getRun(
    @TenantCtx() ctx: TenantContext,
    @Param() params: RunIdParamDto,
  ): Promise<PlaygroundHistoryRunDetail> {
    const agent = await this.playgroundAgent.resolve(ctx);
    return this.historyService.getRun(agent.tenant_id, params.runId, agent.id);
  }

  @Patch('runs/:runId/star')
  async toggleStar(
    @TenantCtx() ctx: TenantContext,
    @Param() params: RunIdParamDto,
  ): Promise<{ starred: boolean }> {
    const starred = await this.historyService.toggleStar(ctx.tenantId, params.runId);
    return { starred };
  }

  @Patch('runs/:runId/best')
  async setBest(
    @TenantCtx() ctx: TenantContext,
    @Param() params: RunIdParamDto,
    @Body() body: SetBestColumnDto,
  ): Promise<{ bestColumnId: string | null }> {
    const bestColumnId = await this.historyService.setBestColumn(
      ctx.tenantId,
      params.runId,
      body.columnId,
    );
    return { bestColumnId };
  }
}
