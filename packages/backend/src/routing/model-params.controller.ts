import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import {
  getProviderParamValue,
  pickProviderCompatibleParams,
  providerParamValueIsValid,
  type AuthType,
  type ProviderParamSpec,
  type RequestParamDefaults,
} from 'manifest-shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { AgentModelParamsService } from './routing-core/agent-model-params.service';
import { ProviderParamSpecService } from './routing-core/provider-param-spec.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import { AgentNameParamDto } from './dto/routing.dto';
import {
  DeleteModelParamsBodyDto,
  ModelParamSpecsQueryDto,
  SetModelParamsBodyDto,
} from './dto/model-params.dto';

@Controller('api/v1/routing')
export class ModelParamsController {
  constructor(
    private readonly modelParamsService: AgentModelParamsService,
    private readonly providerParamSpecs: ProviderParamSpecService,
    private readonly resolveAgentService: ResolveAgentService,
  ) {}

  /**
   * Specs for a single route, fetched on demand when the user opens a model's
   * parameter dialog. The Routing page used to download the entire catalog on
   * boot just to answer "does this model have configurable params?" for every
   * row; serving one model keeps that payload flat as the catalog grows.
   * Provider/auth/model travel as query params because model names contain
   * slashes (e.g. `anthropic/claude-…`).
   */
  @Get(':agentName/model-param-specs/by-model')
  async specsByModel(
    @CurrentUser() user: AuthUser,
    @Param() params: AgentNameParamDto,
    @Query() query: ModelParamSpecsQueryDto,
  ): Promise<readonly ProviderParamSpec[]> {
    await this.resolveAgentService.resolve(user.id, params.agentName);
    return this.providerParamSpecs.getSpecs(query.provider, query.authType, query.model);
  }

  /**
   * Identities (no params/descriptions) of every model that has configurable
   * specs. The Routing page loads this once on boot so it can show the params
   * affordance only on rows that actually have something to configure, without
   * pulling the full catalog.
   */
  @Get(':agentName/model-param-specs/index')
  async specsIndex(
    @CurrentUser() user: AuthUser,
    @Param() params: AgentNameParamDto,
  ): Promise<Array<{ provider: string; authType: AuthType; model: string }>> {
    await this.resolveAgentService.resolve(user.id, params.agentName);
    return this.providerParamSpecs.listModelIds();
  }

  /**
   * Full list for the agent. The frontend calls this once on Routing page
   * boot so every model-row affordance can answer "what's configured for
   * this route?" from one signal without per-row fetches.
   */
  @Get(':agentName/model-params')
  async list(@CurrentUser() user: AuthUser, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    const rows = await this.modelParamsService.list(agent.id);
    return rows.map((r) => ({
      provider: r.provider,
      authType: r.auth_type,
      model: r.model_name,
      scope: r.scope_key,
      params: r.params,
    }));
  }

  /**
   * Upsert one route's params. Body shape carries the full route identity
   * because model names can contain slashes (e.g. `anthropic/claude-3.5-…`)
   * and putting them in the URL path requires encoding gymnastics no client
   * remembers to do.
   *
   * Provider/key compatibility is enforced here, not in the DTO: the DTO
   * validates only the shape of each known key, while this method checks
   * the (provider, key) compatibility so an OpenAI route doesn't get a
   * `thinking` payload it would silently drop at proxy time.
   */
  @Put(':agentName/model-params')
  async set(
    @CurrentUser() user: AuthUser,
    @Param() params: AgentNameParamDto,
    @Body() body: SetModelParamsBodyDto,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    const sanitized = await this.assertCompatibleParams(
      body.provider,
      body.authType,
      body.model,
      body.params,
    );
    const saved = await this.modelParamsService.set(
      agent.id,
      user.id,
      body.scope,
      body.provider,
      body.authType,
      body.model,
      sanitized,
    );
    return {
      provider: saved.provider,
      authType: saved.auth_type,
      model: saved.model_name,
      scope: saved.scope_key,
      params: saved.params,
    };
  }

  /**
   * Drop one route's params entirely. Idempotent — deleting a route with
   * no row returns 204-equivalent (empty success) so the frontend can
   * "reset to provider default" without checking existence first.
   */
  @Delete(':agentName/model-params')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param() params: AgentNameParamDto,
    @Body() body: DeleteModelParamsBodyDto,
  ) {
    const agent = await this.resolveAgentService.resolve(user.id, params.agentName);
    await this.modelParamsService.delete(
      agent.id,
      body.scope,
      body.provider,
      body.authType,
      body.model,
    );
    return { ok: true };
  }

  /**
   * Provider/key compatibility gate, driven by the single
   * MPS provider parameter catalog. Returns the
   * params trimmed to the keys the provider actually consumes — a partially
   * incompatible payload still saves the compatible part rather than
   * throwing, matching the proxy's lenient merge behavior.
   *
   * Throws when the payload is empty (no keys at all) or when no key is
   * compatible with the provider — those are user errors the UI should
   * surface, not silently swallow.
   *
   * Adding a new provider knob is one MPS entry;
   * this method does not need to change.
   */
  private async assertCompatibleParams(
    provider: string,
    authType: AuthType,
    model: string,
    params: RequestParamDefaults,
  ): Promise<RequestParamDefaults> {
    const keys = Object.keys(params).filter(
      (k) => (params as Record<string, unknown>)[k] !== undefined,
    );
    if (keys.length === 0) {
      throw new BadRequestException('params must contain at least one configurable field');
    }
    const specs = await this.providerParamSpecs.getSpecs(provider, authType, model);
    const out = pickProviderCompatibleParams(params, specs);
    if (Object.keys(out).length === 0) {
      throw new BadRequestException(
        `Provider "${provider}" does not consume any of the supplied params`,
      );
    }
    for (const spec of specs) {
      const value = getProviderParamValue(out, spec.path);
      if (value !== undefined && !providerParamValueIsValid(spec, value)) {
        throw new BadRequestException(`Invalid value for param "${spec.path}"`);
      }
    }
    return out;
  }
}
