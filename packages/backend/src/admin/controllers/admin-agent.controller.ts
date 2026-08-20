import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { TenantCtx, TenantContext } from '../../common/decorators/tenant-context.decorator';
import { AdminAiGuard } from '../guards/admin-ai.guard';
import { AgentLifecycleService } from '../../analytics/services/agent-lifecycle.service';
import { ApiKeyGeneratorService } from '../../otlp/services/api-key.service';
import { AgentDuplicationService } from '../../analytics/services/agent-duplication.service';
import { ProviderService } from '../../routing/routing-core/provider.service';
import { TimeseriesQueriesService } from '../../analytics/services/timeseries-queries.service';
import { slugify } from '../../common/utils/slugify';
import { PLAYGROUND_AGENT_SLUG } from '../../common/constants/playground.constants';
import { CreateAgentDto } from '../../common/dto/create-agent.dto';
import { RenameAgentDto } from '../../common/dto/rename-agent.dto';
import { DuplicateAgentDto } from '../../common/dto/duplicate-agent.dto';

/**
 * Agent CRUD over the existing services, mounted under the admin surface.
 * Reuses AgentLifecycleService / ApiKeyGeneratorService / AgentDuplicationService
 * / ProviderService / TimeseriesQueriesService — no logic duplicated. The
 * dashboard's AgentsController is the user-facing twin; this is the AI-admin
 * twin, gated by AdminAiGuard.
 *
 * No handler returns a stored provider/harness secret. Agent ingest keys are
 * only returned at creation/rotation/duplicate time (same as the dashboard).
 */
@Controller('api/v1/admin/agents')
@UseGuards(AdminAiGuard)
export class AdminAgentController {
  constructor(
    private readonly lifecycle: AgentLifecycleService,
    private readonly apiKeyGenerator: ApiKeyGeneratorService,
    private readonly duplication: AgentDuplicationService,
    private readonly providerService: ProviderService,
    private readonly timeseries: TimeseriesQueriesService,
  ) {}

  @Get()
  async list(@TenantCtx() ctx: TenantContext, @Query('includePlayground') includePlayground?: string) {
    const agents = await this.timeseries.getAgentList(ctx.tenantId, includePlayground === 'true');
    return { agents };
  }

  @Post()
  async create(@TenantCtx() ctx: TenantContext, @Body() body: CreateAgentDto) {
    const slug = slugify(body.name);
    if (!slug) throw new BadRequestException('Agent name produces an empty slug');
    if (slug === PLAYGROUND_AGENT_SLUG) {
      throw new BadRequestException('"Playground" is a reserved agent name');
    }
    const result = await this.apiKeyGenerator.onboardAgent({
      tenantId: ctx.tenantId,
      ownerUserId: ctx.userId,
      agentName: slug,
      displayName: body.name.trim(),
      agentCategory: body.agent_category,
      agentPlatform: body.agent_platform,
      autofixEnabled: body.autofix_enabled,
      recordMessages: body.record_messages,
    });
    // Providers are tenant-global + ON by default (mirrors dashboard create).
    await this.providerService.enableAllProvidersForAgent(result.agentId, result.tenantId);
    return {
      agent: {
        id: result.agentId,
        name: slug,
        display_name: body.name.trim(),
        agent_category: body.agent_category ?? null,
        agent_platform: body.agent_platform ?? null,
      },
      apiKey: result.apiKey,
    };
  }

  @Get(':agentName')
  async get(@TenantCtx() ctx: TenantContext, @Param('agentName') agentName: string) {
    const info = await this.lifecycle.findAgentInfo(ctx.tenantId, agentName);
    if (!info) return { agent: null };
    return { agent: info };
  }

  @Get(':agentName/key')
  async getKey(@TenantCtx() ctx: TenantContext, @Param('agentName') agentName: string) {
    const info = await this.lifecycle.findAgentInfo(ctx.tenantId, agentName);
    if (!info || !ctx.tenantId) return { keyPrefix: undefined };
    const keyData = await this.apiKeyGenerator.getKeyForAgent(ctx.tenantId, agentName);
    return { keyPrefix: keyData.keyPrefix, ...(keyData.fullKey ? { apiKey: keyData.fullKey } : {}) };
  }

  @Post(':agentName/rotate-key')
  async rotateKey(@TenantCtx() ctx: TenantContext, @Param('agentName') agentName: string) {
    const info = await this.lifecycle.findAgentInfo(ctx.tenantId, agentName);
    if (!info || !ctx.tenantId) return { apiKey: undefined };
    const result = await this.apiKeyGenerator.rotateKey(ctx.tenantId, agentName);
    return { apiKey: result.apiKey };
  }

  @Patch(':agentName')
  async update(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') agentName: string,
    @Body() body: RenameAgentDto,
  ) {
    const result: Record<string, unknown> = {};
    if (body.name) {
      const slug = slugify(body.name);
      if (!slug) throw new BadRequestException('Agent name produces an empty slug');
      if (slug === PLAYGROUND_AGENT_SLUG) {
        throw new BadRequestException('"Playground" is a reserved agent name');
      }
      const displayName = body.name.trim();
      await this.lifecycle.renameAgent(ctx.tenantId, agentName, slug, displayName);
      result['renamed'] = true;
      result['name'] = slug;
      result['display_name'] = displayName;
    }
    if (body.agent_category !== undefined || body.agent_platform !== undefined) {
      await this.lifecycle.updateAgentType(
        ctx.tenantId,
        body.name ? slugify(body.name) : agentName,
        { agent_category: body.agent_category, agent_platform: body.agent_platform },
      );
      if (body.agent_category !== undefined) result['agent_category'] = body.agent_category;
      if (body.agent_platform !== undefined) result['agent_platform'] = body.agent_platform;
    }
    return result;
  }

  @Post(':agentName/duplicate')
  async duplicate(
    @TenantCtx() ctx: TenantContext,
    @Param('agentName') sourceName: string,
    @Body() body: DuplicateAgentDto,
  ) {
    const slug = slugify(body.name);
    if (!slug) throw new BadRequestException('Agent name produces an empty slug');
    if (slug === PLAYGROUND_AGENT_SLUG) {
      throw new BadRequestException('"Playground" is a reserved agent name');
    }
    const displayName = body.name.trim();
    const result = await this.duplication.duplicate(ctx.tenantId, sourceName, {
      name: slug,
      displayName,
    });
    return {
      agent: { id: result.agentId, name: result.agentName, display_name: result.displayName },
      apiKey: result.apiKey,
      copied: result.copied,
    };
  }

  @Delete(':agentName')
  async remove(@TenantCtx() ctx: TenantContext, @Param('agentName') agentName: string) {
    const info = await this.lifecycle.findAgentInfo(ctx.tenantId, agentName);
    if (!info) throw new NotFoundException(`Agent "${agentName}" not found`);
    await this.lifecycle.deleteAgent(ctx.tenantId, agentName);
    return { deleted: true };
  }
}
