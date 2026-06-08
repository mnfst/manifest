import { Body, Controller, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { ProviderService } from './routing-core/provider.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import { CopilotDeviceAuthService } from './oauth/copilot-device-auth.service';
import { ModelDiscoveryService } from '../model-discovery/model-discovery.service';
import { AgentNameParamDto, CopilotPollDto } from './dto/routing.dto';

@Controller('api/v1/routing')
export class CopilotController {
  constructor(
    private readonly providerService: ProviderService,
    private readonly resolveAgentService: ResolveAgentService,
    private readonly copilotAuth: CopilotDeviceAuthService,
    private readonly discoveryService: ModelDiscoveryService,
  ) {}

  @Post(':agentName/copilot/device-code')
  async copilotDeviceCode(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    await this.resolveAgentService.resolve(user.id, params.agentName);
    return this.copilotAuth.requestDeviceCode();
  }

  @Post(':agentName/copilot/poll-token')
  async copilotPollToken(
    @CurrentUser() user: AuthUser,
    @Param() params: AgentNameParamDto,
    @Body() body: CopilotPollDto,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    const result = await this.copilotAuth.pollForToken(body.deviceCode);
    if (result.status === 'complete' && result.token) {
      const label = await this.providerService.nextOAuthLabel(user.id, 'copilot');
      const { provider: record, isNew } = await this.providerService.upsertProvider(
        agent.id,
        user.id,
        'copilot',
        result.token,
        'subscription',
        undefined,
        label,
      );
      try {
        await this.discoveryService.discoverModels(record);
        // A NEW provider is global + ON for every owned agent, so recalc every
        // sibling against the post-discovery model set; a reconnect only touches
        // the connecting agent (preserving per-agent disables).
        if (isNew) {
          await this.providerService.recalculateTiersForUser(user.id);
        } else {
          await this.providerService.recalculateTiers(agent.id, user.id);
        }
      } catch {
        // Discovery failure is non-fatal
      }
    }
    return { status: result.status };
  }
}
