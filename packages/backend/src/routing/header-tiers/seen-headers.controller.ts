import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { AuthUser } from '../../auth/auth.instance';
import { SeenHeadersService } from './seen-headers.service';

@Controller('api/v1/routing')
export class SeenHeadersController {
  constructor(private readonly seenHeaders: SeenHeadersService) {}

  @Get(':agentName/seen-headers')
  async list(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Query('scope') scope?: string,
  ) {
    // `scope=all` returns headers across all of the user's agents so the user
    // can reuse a known key even before any traffic flows through this agent.
    const agentFilter = scope === 'all' ? undefined : agentName;
    return this.seenHeaders.getSeenHeaders(user.id, agentFilter);
  }
}
