import { Controller, Get, HttpException, HttpStatus, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.instance';
import { KiroOauthService } from './kiro-oauth.service';
import { ResolveAgentService } from '../routing-core/resolve-agent.service';
import { ProviderService } from '../routing-core/provider.service';
import { optionalTrimmedStringQuery } from './query-params';
import { resolveOAuthConnectionScope } from './oauth-scope';

@Controller('api/v1/oauth/kiro')
export class KiroOauthController {
  constructor(
    private readonly oauthService: KiroOauthService,
    private readonly resolveAgent: ResolveAgentService,
    private readonly providerService: ProviderService,
  ) {}

  @Post('start')
  async start(
    @Query('agentName') agentName: string | string[] | undefined,
    @CurrentUser() user: AuthUser,
    @Query('scope') scopeValue?: string | string[],
  ) {
    const scope = await resolveOAuthConnectionScope(this.resolveAgent, user, agentName, scopeValue);
    try {
      return await this.oauthService.startAuthorization(
        scope.type === 'agent' ? scope.agentId : scope,
        user.id,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start Kiro login';
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
      const message = err instanceof Error ? err.message : 'Failed to poll Kiro login';
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
        ? await this.providerService.removeProvider(scope.agentId, 'kiro', 'subscription', keyLabel)
        : await this.providerService.removeProviderForConnection(
            scope,
            'kiro',
            'subscription',
            keyLabel,
          );
    return { ok: true, notifications };
  }
}
