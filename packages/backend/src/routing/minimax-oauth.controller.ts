import { Controller, Get, HttpException, HttpStatus, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { isMinimaxRegion, MinimaxOauthService } from './minimax-oauth.service';
import { ResolveAgentService } from './resolve-agent.service';

@Controller('api/v1/oauth/minimax')
export class MinimaxOauthController {
  constructor(
    private readonly oauthService: MinimaxOauthService,
    private readonly resolveAgent: ResolveAgentService,
  ) {}

  @Post('start')
  async start(
    @Query('agentName') agentName: string,
    @Query('region') region: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!agentName) {
      throw new HttpException('agentName query parameter is required', HttpStatus.BAD_REQUEST);
    }
    if (region && !isMinimaxRegion(region)) {
      throw new HttpException(
        'region query parameter must be one of: global, cn',
        HttpStatus.BAD_REQUEST,
      );
    }

    const agent = await this.resolveAgent.resolve(user.id, agentName);
    const selectedRegion = region && isMinimaxRegion(region) ? region : 'global';
    try {
      return await this.oauthService.startAuthorization(agent.id, user.id, selectedRegion);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start MiniMax OAuth';
      throw new HttpException(message, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  @Get('poll')
  async poll(@Query('flowId') flowId: string, @CurrentUser() user: AuthUser) {
    if (!flowId) {
      throw new HttpException('flowId query parameter is required', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.oauthService.pollAuthorization(flowId, user.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to poll MiniMax OAuth';
      throw new HttpException(message, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
