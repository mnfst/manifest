import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.instance';
import { CustomProviderService } from './custom-provider.service';
import { ProviderService } from '../routing-core/provider.service';
import { ResolveAgentService } from '../routing-core/resolve-agent.service';
import {
  CreateCustomProviderDto,
  ProbeCustomProviderDto,
  UpdateCustomProviderDto,
} from '../dto/custom-provider.dto';
import { AgentNameParamDto } from '../dto/routing.dto';

@Controller('api/v1/routing')
export class CustomProviderController {
  constructor(
    private readonly customProviderService: CustomProviderService,
    private readonly providerService: ProviderService,
    private readonly resolveAgentService: ResolveAgentService,
  ) {}

  @Get(':agentName/custom-providers')
  async list(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    const [providers, userProviders] = await Promise.all([
      this.customProviderService.list(agent.id),
      this.providerService.getProviders(agent.id),
    ]);
    if (providers.length === 0) return [];

    return providers.map((cp) => {
      const provKey = CustomProviderService.providerKey(cp.id);
      const up = userProviders.find((u) => u.provider === provKey);
      return {
        id: cp.id,
        name: cp.name,
        base_url: cp.base_url,
        api_kind: cp.api_kind,
        has_api_key: !!up?.api_key_encrypted,
        models: cp.models,
        created_at: cp.created_at,
      };
    });
  }

  @Post(':agentName/custom-providers/probe')
  async probe(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Body() body: ProbeCustomProviderDto,
  ) {
    // Resolve for authz — user must own the agent before the server probes
    // anything on their behalf.
    await this.resolveAgentService.resolve(user.id, agentName);
    const models = await this.customProviderService.probeModels(
      body.base_url,
      body.apiKey,
      body.api_kind,
    );
    return { models };
  }

  @Post(':agentName/custom-providers')
  async create(
    @CurrentUser() user: AuthUser,
    @Param() params: AgentNameParamDto,
    @Body() body: CreateCustomProviderDto,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    const cp = await this.customProviderService.create(agent.id, user.id, body);
    const provKey = CustomProviderService.providerKey(cp.id);
    const up = (await this.providerService.getProviders(agent.id)).find(
      (u) => u.provider === provKey,
    );

    return {
      id: cp.id,
      name: cp.name,
      base_url: cp.base_url,
      api_kind: cp.api_kind,
      has_api_key: !!up?.api_key_encrypted,
      models: cp.models,
      created_at: cp.created_at,
    };
  }

  @Put(':agentName/custom-providers/:id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('id') id: string,
    @Body() body: UpdateCustomProviderDto,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    const cp = await this.customProviderService.update(agent.id, id, user.id, body);
    const provKey = CustomProviderService.providerKey(cp.id);
    const up = (await this.providerService.getProviders(agent.id)).find(
      (u) => u.provider === provKey,
    );

    return {
      id: cp.id,
      name: cp.name,
      base_url: cp.base_url,
      api_kind: cp.api_kind,
      has_api_key: !!up?.api_key_encrypted,
      models: cp.models,
      created_at: cp.created_at,
    };
  }

  @Delete(':agentName/custom-providers/:id')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('agentName') agentName: string,
    @Param('id') id: string,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, agentName);
    await this.customProviderService.remove(agent.id, id);
    return { ok: true };
  }
}
