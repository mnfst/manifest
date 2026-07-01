import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { TenantCtx, TenantContext } from '../../common/decorators/tenant-context.decorator';
import { CustomProviderService } from './custom-provider.service';
import { ProviderService } from '../routing-core/provider.service';
import { ResolveAgentService } from '../routing-core/resolve-agent.service';
import {
  CreateCustomProviderDto,
  ProbeCustomProviderDto,
  UpdateCustomProviderDto,
  AddCustomProviderKeyDto,
  RenameCustomProviderKeyDto,
  ReorderCustomProviderKeysDto,
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
  async list(@TenantCtx() ctx: TenantContext, @Param() params: AgentNameParamDto) {
    // Resolve for authz — the tenant must own the agent. Custom providers are
    // tenant-global, so the listing itself is scoped to the tenant, not the agent.
    // allowPlayground: true — the Playground page reads custom providers for the
    // reserved Playground agent; all mutation endpoints remain blocked.
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, params.agentName, {
      allowPlayground: true,
    });
    const [providers, tenantProviders] = await Promise.all([
      this.customProviderService.list(agent.tenant_id),
      this.providerService.getProviders(agent.tenant_id),
    ]);
    if (providers.length === 0) return [];

    return providers.map((cp) => {
      const provKey = CustomProviderService.providerKey(cp.id);
      const matchingProviders = tenantProviders.filter((u) => u.provider === provKey);
      const primaryKey = matchingProviders.find((u) => u.label === 'Default') ?? matchingProviders[0];
      return {
        id: cp.id,
        name: cp.name,
        base_url: cp.base_url,
        api_kind: cp.api_kind,
        has_api_key: !!primaryKey?.api_key_encrypted,
        keys: matchingProviders
          .filter((u) => u.is_active)
          .sort((a, b) => a.priority - b.priority)
          .map((u) => ({
            label: u.label,
            key_prefix: u.key_prefix,
            priority: u.priority,
            is_active: u.is_active,
            region: u.region,
          })),
        models: cp.models,
        created_at: cp.created_at,
      };
    });
  }

  @Post(':agentName/custom-providers/probe')
  async probe(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Body() body: ProbeCustomProviderDto,
  ) {
    // Resolve for authz — the tenant must own the agent before the server
    // probes anything on its behalf.
    await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    const models = await this.customProviderService.probeModels(
      body.base_url,
      body.apiKey,
      body.api_kind,
      body.provider_name,
    );
    return { models };
  }

  @Post(':agentName/custom-providers')
  async create(
    @TenantCtx() ctx: TenantContext,
    @Param() params: AgentNameParamDto,
    @Body() body: CreateCustomProviderDto,
  ) {
    // allowPlayground: true — creating a custom provider from the Playground page is
    // additive (tenant-global resource); the playground agent is a valid owner context.
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, params.agentName, {
      allowPlayground: true,
    });
    const cp = await this.customProviderService.create(agent.tenant_id, body, ctx.userId);
    const provKey = CustomProviderService.providerKey(cp.id);
    const up = (await this.providerService.getProviders(agent.tenant_id)).find(
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
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Param('id') id: string,
    @Body() body: UpdateCustomProviderDto,
  ) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    const cp = await this.customProviderService.update(id, agent.tenant_id, body, ctx.userId);
    const provKey = CustomProviderService.providerKey(cp.id);
    const up = (await this.providerService.getProviders(agent.tenant_id)).find(
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
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Param('id') id: string,
  ) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    await this.customProviderService.remove(agent.tenant_id, id, ctx.userId);
    return { ok: true };
  }

  @Post(':agentName/custom-providers/:id/keys')
  async addKey(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Param('id') id: string,
    @Body() body: AddCustomProviderKeyDto,
  ) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    const cp = await this.customProviderService.getById(id, agent.tenant_id);
    if (!cp) {
      throw new NotFoundException('Custom provider not found');
    }
    const provKey = CustomProviderService.providerKey(id);
    await this.providerService.upsertProvider(
      null,
      agent.tenant_id,
      provKey,
      body.apiKey,
      'api_key',
      undefined,
      body.label,
      ctx.userId,
    );
    return { ok: true };
  }

  @Delete(':agentName/custom-providers/:id/keys/:label')
  async removeKey(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Param('id') id: string,
    @Param('label') label: string,
  ) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    const provKey = CustomProviderService.providerKey(id);
    await this.providerService.removeProvider(
      null,
      agent.tenant_id,
      provKey,
      'api_key',
      label,
    );
    return { ok: true };
  }

  @Put(':agentName/custom-providers/:id/keys/:label')
  async renameKey(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Param('id') id: string,
    @Param('label') label: string,
    @Body() body: RenameCustomProviderKeyDto,
  ) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    const provKey = CustomProviderService.providerKey(id);
    await this.providerService.renameKey(
      null as any,
      agent.tenant_id,
      provKey,
      'api_key',
      label,
      body.newLabel,
    );
    return { ok: true };
  }

  @Post(':agentName/custom-providers/:id/keys/reorder')
  async reorderKeys(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Param('id') id: string,
    @Body() body: ReorderCustomProviderKeysDto,
  ) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, agentName);
    const provKey = CustomProviderService.providerKey(id);
    await this.providerService.reorderKeys(
      null as any,
      agent.tenant_id,
      provKey,
      'api_key',
      body.orderedLabels,
    );
    return { ok: true };
  }
}
