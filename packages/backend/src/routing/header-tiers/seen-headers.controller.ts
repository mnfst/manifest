import { Controller, Get, Param, Query } from '@nestjs/common';
import { TenantCtx, TenantContext } from '../../common/decorators/tenant-context.decorator';
import { SeenHeadersService } from './seen-headers.service';

@Controller('api/v1/routing')
export class SeenHeadersController {
  constructor(private readonly seenHeaders: SeenHeadersService) {}

  @Get(':agentName/seen-headers')
  async list(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Query('scope') scope?: string,
  ) {
    if (!ctx.tenantId) return [];
    // `scope=all` returns headers across all of the tenant's agents so the user
    // can reuse a known key even before any traffic flows through this agent.
    const agentFilter = scope === 'all' ? undefined : agentName;
    return this.seenHeaders.getSeenHeaders(ctx.tenantId, agentFilter);
  }
}
