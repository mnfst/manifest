import { Controller, Get, HttpException, HttpStatus, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { MinimaxOauthService } from './minimax-oauth.service';
import { ResolveAgentService } from './resolve-agent.service';

@Controller('api/v1/oauth/minimax')
export class MinimaxOauthController {
  constructor(
    private readonly oauthService: MinimaxOauthService,
    private readonly resolveAgent: ResolveAgentService,
  ) {}

  @Post('start')
  async start(@Query('agentName') agentName: string, @CurrentUser() user: AuthUser) {
    if (!agentName) {
      throw new HttpException('agentName query parameter is required', HttpStatus.BAD_REQUEST);
    }

    const agent = await this.resolveAgent.resolve(user.id, agentName);
    return this.oauthService.startAuthorization(agent.id, user.id);
  }

  @Get('poll')
  async poll(@Query('flowId') flowId: string, @CurrentUser() user: AuthUser) {
    if (!flowId) {
      throw new HttpException('flowId query parameter is required', HttpStatus.BAD_REQUEST);
    }
    return this.oauthService.pollAuthorization(flowId, user.id);
  }
}
