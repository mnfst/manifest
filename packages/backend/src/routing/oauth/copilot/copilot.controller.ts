import { Body, Controller, Param, Post } from '@nestjs/common';
import { TenantCtx, TenantContext } from '../../../common/decorators/tenant-context.decorator';
import { ProviderService } from '../../routing-core/provider.service';
import { ResolveAgentService } from '../../routing-core/resolve-agent.service';
import { CopilotDeviceAuthService } from './copilot-device-auth.service';
import { ModelDiscoveryService } from '../../../model-discovery/model-discovery.service';
import { AgentNameParamDto, CopilotPollDto } from '../../dto/routing.dto';

@Controller('api/v1/routing')
export class CopilotController {
  constructor(
    private readonly providerService: ProviderService,
    private readonly resolveAgentService: ResolveAgentService,
    private readonly copilotAuth: CopilotDeviceAuthService,
    private readonly discoveryService: ModelDiscoveryService,
  ) {}

  @Post(':agentName/copilot/device-code')
  async copilotDeviceCode(@TenantCtx() ctx: TenantContext, @Param() params: AgentNameParamDto) {
    await this.resolveAgentService.resolve(ctx.tenantId, params.agentName);
    return this.copilotAuth.requestDeviceCode();
  }

  @Post(':agentName/copilot/poll-token')
  async copilotPollToken(
    @TenantCtx() ctx: TenantContext,
    @Param() params: AgentNameParamDto,
    @Body() body: CopilotPollDto,
  ) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, params.agentName);
    const result = await this.copilotAuth.pollForToken(body.deviceCode);
    if (result.status === 'complete' && result.token) {
      const label = await this.providerService.nextOAuthLabel(agent.tenant_id, 'copilot');
      const { provider: record } = await this.providerService.upsertProvider(
        agent.id,
        agent.tenant_id,
        'copilot',
        result.token,
        'subscription',
        undefined,
        label,
        ctx.userId,
      );
      try {
        await this.discoveryService.discoverModels(record);
      } catch {
        // Discovery failure is non-fatal
      }
    }
    return { status: result.status };
  }
}
