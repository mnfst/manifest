import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { TenantCtx, TenantContext } from '../../common/decorators/tenant-context.decorator';
import { AdminAiGuard } from '../guards/admin-ai.guard';
import { AgentLifecycleService } from '../../analytics/services/agent-lifecycle.service';
import { ApiKeyGeneratorService } from '../../otlp/services/api-key.service';
import { AgentDuplicationService } from '../../analytics/services/agent-duplication.service';
import { ProviderService } from '../../routing/routing-core/provider.service';
import { TimeseriesQueriesService } from '../../analytics/services/timeseries-queries.service';
import { IngestEventBusService } from '../../common/services/ingest-event-bus.service';
import { agentListCacheKey } from '../../common/constants/cache.constants';
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
 * only returned at creation/rotation/duplicate time (same as the dashboard) —
 * there is deliberately no readback route for the raw ingest key.
 */
@Controller('api/v1/admin/agents')
@UseGuards(AdminAiGuard)
export class AdminAgentController {
  private readonly logger = new Logger(AdminAgentController.name);

  constructor(
    private readonly lifecycle: AgentLifecycleService,
    private readonly apiKeyGenerator: ApiKeyGeneratorService,
    private readonly duplication: AgentDuplicationService,
    private readonly providerService: ProviderService,
    private readonly timeseries: TimeseriesQueriesService,
    private readonly eventBus: IngestEventBusService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // Same two canonical agent-list cache entries the dashboard invalidates after
  // a mutation; without this an admin-driven create/rename/delete leaves the
  // workspace list stale for the dashboard TTL.
  private async invalidateAgentListCache(tenantId: string | null): Promise<void> {
    if (!tenantId) return;
    await Promise.all([
      this.cacheManager.del(agentListCacheKey(tenantId, false)),
      this.cacheManager.del(agentListCacheKey(tenantId, true)),
    ]);
  }

  private emitAgentEvent(tenantId: string | null, userId: string | null): void {
    if (tenantId) this.eventBus.emit(tenantId, 'agent', userId);
  }

  @Get()
  async list(
    @TenantCtx() ctx: TenantContext,
    @Query('includePlayground') includePlayground?: string,
  ) {
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
    let result;
    try {
      result = await this.apiKeyGenerator.onboardAgent({
        tenantId: ctx.tenantId,
        ownerUserId: ctx.userId,
        agentName: slug,
        displayName: body.name.trim(),
        agentCategory: body.agent_category,
        agentPlatform: body.agent_platform,
        autofixEnabled: body.autofix_enabled,
        recordMessages: body.record_messages,
      });
    } catch (error) {
      // Mirror the dashboard create path: surface duplicate slugs as 409, not
      // a raw unique-constraint 500.
      if (error instanceof QueryFailedError && /unique|duplicate/i.test(error.message)) {
        throw new ConflictException(`Agent "${slug}" already exists`);
      }
      throw error;
    }
    // Providers are tenant-global + ON by default (mirrors dashboard create).
    // This runs outside the onboarding transaction; on failure compensate by
    // removing the just-created agent instead of leaving a routable agent with
    // zero enabled providers.
    try {
      await this.providerService.enableAllProvidersForAgent(result.agentId, result.tenantId);
    } catch (error) {
      this.logger.error(
        `Failed to enable providers for new admin-created agent "${slug}" (${result.agentId}); rolling back agent creation`,
        error instanceof Error ? error.stack : String(error),
      );
      try {
        await this.lifecycle.deleteAgent(result.tenantId, slug);
      } catch (cleanupError) {
        this.logger.error(
          `Compensating cleanup failed for admin-created agent "${slug}" (${result.agentId}); it may be left without providers`,
          cleanupError instanceof Error ? cleanupError.stack : String(cleanupError),
        );
      }
      await this.invalidateAgentListCache(result.tenantId);
      throw error;
    }
    await this.invalidateAgentListCache(result.tenantId);
    this.emitAgentEvent(result.tenantId, ctx.userId);
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
    if (!info) throw new NotFoundException(`Agent "${agentName}" not found`);
    return { agent: info };
  }

  /**
   * Prefix-only readback. The raw ingest key stays a one-time response at
   * create/rotate/duplicate — use rotate-key to re-mint. (The dashboard's
   * GET key handler can decrypt and return the full key; this admin twin
   * intentionally does not.)
   */
  @Get(':agentName/key')
  async getKey(@TenantCtx() ctx: TenantContext, @Param('agentName') agentName: string) {
    const info = await this.lifecycle.findAgentInfo(ctx.tenantId, agentName);
    if (!info || !ctx.tenantId) throw new NotFoundException(`Agent "${agentName}" not found`);
    const keyData = await this.apiKeyGenerator.getKeyForAgent(ctx.tenantId, agentName);
    return { keyPrefix: keyData.keyPrefix };
  }

  @Post(':agentName/rotate-key')
  async rotateKey(@TenantCtx() ctx: TenantContext, @Param('agentName') agentName: string) {
    const info = await this.lifecycle.findAgentInfo(ctx.tenantId, agentName);
    if (!info || !ctx.tenantId) throw new NotFoundException(`Agent "${agentName}" not found`);
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
      try {
        await this.lifecycle.renameAgent(ctx.tenantId, agentName, slug, displayName);
      } catch (error) {
        if (error instanceof QueryFailedError && /unique|duplicate/i.test(error.message)) {
          throw new ConflictException(`Agent "${slug}" already exists`);
        }
        throw error;
      }
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
    await this.invalidateAgentListCache(ctx.tenantId);
    this.emitAgentEvent(ctx.tenantId, ctx.userId);
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
    let result;
    try {
      result = await this.duplication.duplicate(ctx.tenantId, sourceName, {
        name: slug,
        displayName,
      });
    } catch (error) {
      if (error instanceof QueryFailedError && /unique|duplicate/i.test(error.message)) {
        throw new ConflictException(`Agent "${slug}" already exists`);
      }
      throw error;
    }
    await this.invalidateAgentListCache(ctx.tenantId);
    this.emitAgentEvent(ctx.tenantId, ctx.userId);
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
    await this.invalidateAgentListCache(ctx.tenantId);
    this.emitAgentEvent(ctx.tenantId, ctx.userId);
    return { deleted: true };
  }
}
