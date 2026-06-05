import { Controller, Get, HttpException, HttpStatus, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.instance';
import { isMinimaxRegion, MinimaxOauthService } from './minimax-oauth.service';
import { ResolveAgentService } from '../routing-core/resolve-agent.service';
import { ProviderService } from '../routing-core/provider.service';
import { optionalTrimmedStringQuery } from './query-params';
import { resolveOAuthConnectionScope } from './oauth-scope';

@Controller('api/v1/oauth/minimax')
export class MinimaxOauthController {
  constructor(
    private readonly oauthService: MinimaxOauthService,
    private readonly resolveAgent: ResolveAgentService,
    private readonly providerService: ProviderService,
  ) {}

  @Post('start')
  async start(
    @Query('agentName') agentName: string | string[] | undefined,
    @Query('region') region: string | undefined,
    @CurrentUser() user: AuthUser,
    @Query('scope') scopeValue?: string | string[],
  ) {
    if (region && !isMinimaxRegion(region)) {
      throw new HttpException(
        'region query parameter must be one of: global, cn',
        HttpStatus.BAD_REQUEST,
      );
    }

    const scope = await resolveOAuthConnectionScope(this.resolveAgent, user, agentName, scopeValue);
    const selectedRegion = region && isMinimaxRegion(region) ? region : 'global';
    try {
      return await this.oauthService.startAuthorization(
        scope.type === 'agent' ? scope.agentId : scope,
        user.id,
        selectedRegion,
      );
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

  @Post('revoke')
  async revoke(
    @Query('agentName') agentName: string | string[] | undefined,
    @Query('label') label: string | string[] | undefined,
    @CurrentUser() user: AuthUser,
    @Query('scope') scopeValue?: string | string[],
  ) {
    const keyLabel = optionalTrimmedStringQuery(label, 'label');
    const scope = await resolveOAuthConnectionScope(this.resolveAgent, user, agentName, scopeValue);
    const { notifications } =
      scope.type === 'agent'
        ? await this.providerService.removeProvider(
            scope.agentId,
            'minimax',
            'subscription',
            keyLabel,
          )
        : await this.providerService.removeProviderForConnection(
            scope,
            'minimax',
            'subscription',
            keyLabel,
          );
    return { ok: true, notifications };
  }
}
