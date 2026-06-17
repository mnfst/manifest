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
import { isMinimaxRegion, MinimaxOauthService } from './minimax-oauth.service';
import { ResolveAgentService } from '../../routing-core/resolve-agent.service';
import { ProviderService } from '../../routing-core/provider.service';
import { optionalTrimmedStringQuery } from '../core/query-params';

@Controller('api/v1/oauth/minimax')
export class MinimaxOauthController {
  constructor(
    private readonly oauthService: MinimaxOauthService,
    private readonly resolveAgent: ResolveAgentService,
    private readonly providerService: ProviderService,
  ) {}

  @Post('start')
  async start(
    @Query('agentName') agentName: string,
    @Query('region') region: string | undefined,
    @TenantCtx() ctx: TenantContext,
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

    const agent = await this.resolveAgent.resolve(ctx.tenantId, agentName);
    const selectedRegion = region && isMinimaxRegion(region) ? region : 'global';
    try {
      return await this.oauthService.startAuthorization(
        agent.id,
        agent.tenant_id,
        selectedRegion,
        ctx.userId,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start MiniMax OAuth';
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
      const message = err instanceof Error ? err.message : 'Failed to poll MiniMax OAuth';
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
      'minimax',
      'subscription',
      keyLabel,
    );
    return { ok: true, notifications };
  }
}
