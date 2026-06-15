import { Controller, Get, HttpException, HttpStatus, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.instance';
import { KiroOauthService } from './kiro-oauth.service';
import { KiroAuthorizationOptionsError, type KiroAuthorizationOptions } from './kiro-oidc';
import { ResolveAgentService } from '../routing-core/resolve-agent.service';
import { ProviderService } from '../routing-core/provider.service';
import { optionalTrimmedStringQuery } from './query-params';

@Controller('api/v1/oauth/kiro')
export class KiroOauthController {
  constructor(
    private readonly oauthService: KiroOauthService,
    private readonly resolveAgent: ResolveAgentService,
    private readonly providerService: ProviderService,
  ) {}

  @Post('start')
  async start(
    @Query('agentName') agentName: string,
    @CurrentUser() user: AuthUser,
    @Query('startUrl') startUrl?: string | string[],
    @Query('region') region?: string | string[],
  ) {
    if (!agentName) {
      throw new HttpException('agentName query parameter is required', HttpStatus.BAD_REQUEST);
    }
    const options: KiroAuthorizationOptions = {};
    const trimmedStartUrl = optionalTrimmedStringQuery(startUrl, 'startUrl');
    const trimmedRegion = optionalTrimmedStringQuery(region, 'region');
    if (trimmedStartUrl !== undefined) {
      options.startUrl = trimmedStartUrl;
    }
    if (trimmedRegion !== undefined) {
      options.region = trimmedRegion;
    }
    const agent = await this.resolveAgent.resolve(user.id, agentName);
    try {
      if (options.startUrl !== undefined || options.region !== undefined) {
        return await this.oauthService.startAuthorization(agent.id, user.id, options);
      }
      return await this.oauthService.startAuthorization(agent.id, user.id);
    } catch (err) {
      if (err instanceof KiroAuthorizationOptionsError) {
        throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
      }
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
    @Query('agentName') agentName: string,
    @Query('label') label: string | string[] | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!agentName) {
      throw new HttpException('agentName query parameter is required', HttpStatus.BAD_REQUEST);
    }
    const keyLabel = optionalTrimmedStringQuery(label, 'label');
    const agent = await this.resolveAgent.resolve(user.id, agentName);
    const { notifications } = await this.providerService.removeProvider(
      agent.id,
      'kiro',
      'subscription',
      keyLabel,
    );
    return { ok: true, notifications };
  }
}
