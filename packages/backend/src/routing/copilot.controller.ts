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
      const { provider: record } = await this.providerService.upsertProvider(
        agent.id,
        user.id,
        'copilot',
        result.token,
        'subscription',
      );
      try {
        await this.discoveryService.discoverModels(record);
        await this.providerService.recalculateTiers(agent.id);
      } catch {
        // Discovery failure is non-fatal
      }
    }
    return { status: result.status };
  }
}
