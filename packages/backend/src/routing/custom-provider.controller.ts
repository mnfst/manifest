import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { Agent } from '../entities/agent.entity';
import { Tenant } from '../entities/tenant.entity';
import { UserProvider } from '../entities/user-provider.entity';
import { CustomProviderService } from './custom-provider.service';
import { resolveAgent } from './resolve-agent.util';
import { CreateCustomProviderDto, UpdateCustomProviderDto } from './dto/custom-provider.dto';
import { AgentNameParamDto } from './dto/routing.dto';

@Controller('api/v1/routing')
export class CustomProviderController {
  constructor(
    private readonly customProviderService: CustomProviderService,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(UserProvider)
    private readonly providerRepo: Repository<UserProvider>,
  ) {}

  private resolveAgent(userId: string, agentName: string): Promise<Agent> {
    return resolveAgent(this.tenantRepo, this.agentRepo, userId, agentName);
  }

  @Get(':agentName/custom-providers')
  async list(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgent(user.id, params.agentName);
    const providers = await this.customProviderService.list(agent.id);
    const userProviders = await this.providerRepo.find({ where: { agent_id: agent.id } });

    return providers.map((cp) => {
      const provKey = CustomProviderService.providerKey(cp.id);
      const up = userProviders.find((u) => u.provider === provKey);
      return {
        id: cp.id,
        name: cp.name,
        base_url: cp.base_url,
        has_api_key: !!up?.api_key_encrypted,
        models: cp.models,
        created_at: cp.created_at,
      };
    });
  }

  @Post(':agentName/custom-providers')
  async create(
    @CurrentUser() user: AuthUser,
    @Param() params: AgentNameParamDto,
    @Body() body: CreateCustomProviderDto,
  ) {
    const agent = await this.resolveAgent(user.id, params.agentName);
    const cp = await this.customProviderService.create(agent.id, user.id, body);
    const provKey = CustomProviderService.providerKey(cp.id);
    const up = await this.providerRepo.findOne({
      where: { agent_id: agent.id, provider: provKey },
    });

    return {
      id: cp.id,
      name: cp.name,
      base_url: cp.base_url,
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
    const agent = await this.resolveAgent(user.id, agentName);
    const cp = await this.customProviderService.update(agent.id, id, user.id, body);
    const provKey = CustomProviderService.providerKey(cp.id);
    const up = await this.providerRepo.findOne({
      where: { agent_id: agent.id, provider: provKey },
    });

    return {
      id: cp.id,
      name: cp.name,
      base_url: cp.base_url,
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
    const agent = await this.resolveAgent(user.id, agentName);
    await this.customProviderService.remove(agent.id, id);
    return { ok: true };
  }
}
