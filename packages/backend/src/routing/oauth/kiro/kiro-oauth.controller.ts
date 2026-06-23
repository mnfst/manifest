import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';
import { TenantCtx, TenantContext } from '../../../common/decorators/tenant-context.decorator';
import { KiroOauthService } from './kiro-oauth.service';
import { KiroAuthorizationOptionsError, type KiroAuthorizationOptions } from './kiro-oidc';
import { ResolveAgentService } from '../../routing-core/resolve-agent.service';
import { ProviderService } from '../../routing-core/provider.service';
import { optionalTrimmedStringQuery } from '../core/query-params';

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
    @TenantCtx() ctx: TenantContext,
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
    const agent = await this.resolveAgent.resolve(ctx.tenantId, agentName);
    try {
      return await this.oauthService.startAuthorization(
        agent.id,
        agent.tenant_id,
        ctx.userId,
        options,
      );
    } catch (err) {
      if (err instanceof KiroAuthorizationOptionsError) {
        throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
      }
      const message = err instanceof Error ? err.message : 'Failed to start Kiro login';
      throw new HttpException(message, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  @Get('poll')
  async poll(@Query('flowId') flowId: string, @TenantCtx() ctx: TenantContext) {
    if (!flowId) {
      throw new HttpException('flowId query parameter is required', HttpStatus.BAD_REQUEST);
    }
    if (!ctx.tenantId) {
      throw new NotFoundException('Tenant not found');
    }
    try {
      return await this.oauthService.pollAuthorization(flowId, ctx.tenantId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to poll Kiro login';
      throw new HttpException(message, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  @Post('revoke')
  async revoke(
    @Query('agentName') agentName: string,
    @Query('label') label: string | string[] | undefined,
    @TenantCtx() ctx: TenantContext,
  ) {
    if (!agentName) {
      throw new HttpException('agentName query parameter is required', HttpStatus.BAD_REQUEST);
    }
    const keyLabel = optionalTrimmedStringQuery(label, 'label');
    const agent = await this.resolveAgent.resolve(ctx.tenantId, agentName);
    const { notifications } = await this.providerService.removeProvider(
      agent.id,
      agent.tenant_id,
      'kiro',
      'subscription',
      keyLabel,
    );
    return { ok: true, notifications };
  }
}
