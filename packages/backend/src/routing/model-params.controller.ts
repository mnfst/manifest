import { BadRequestException, Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { pickProviderCompatibleParams, type RequestParamDefaults } from 'manifest-shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { AgentModelParamsService } from './routing-core/agent-model-params.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import { AgentNameParamDto } from './dto/routing.dto';
import { DeleteModelParamsBodyDto, SetModelParamsBodyDto } from './dto/model-params.dto';

@Controller('api/v1/routing')
export class ModelParamsController {
  constructor(
    private readonly modelParamsService: AgentModelParamsService,
    private readonly resolveAgentService: ResolveAgentService,
  ) {}

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
    const sanitized = this.assertCompatibleParams(body.provider, body.params);
    const saved = await this.modelParamsService.set(
      agent.id,
      user.id,
      body.provider,
      body.authType,
      body.model,
      sanitized,
    );
    return {
      provider: saved.provider,
      authType: saved.auth_type,
      model: saved.model_name,
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
    await this.modelParamsService.delete(agent.id, body.provider, body.authType, body.model);
    return { ok: true };
  }

  /**
   * Provider/key compatibility gate, driven by the single
   * `PROVIDER_PARAM_SPECS` registry in `manifest-shared`. Returns the
   * params trimmed to the keys the provider actually consumes — a partially
   * incompatible payload still saves the compatible part rather than
   * throwing, matching the proxy's lenient merge behavior.
   *
   * Throws when the payload is empty (no keys at all) or when no key is
   * compatible with the provider — those are user errors the UI should
   * surface, not silently swallow.
   *
   * Adding a new provider knob is one entry in `PROVIDER_PARAM_SPECS`;
   * this method does not need to change.
   */
  private assertCompatibleParams(
    provider: string,
    params: RequestParamDefaults,
  ): RequestParamDefaults {
    const keys = Object.keys(params).filter(
      (k) => (params as Record<string, unknown>)[k] !== undefined,
    );
    if (keys.length === 0) {
      throw new BadRequestException('params must contain at least one configurable field');
    }
    const out = pickProviderCompatibleParams(provider, params);
    if (Object.keys(out).length === 0) {
      throw new BadRequestException(
        `Provider "${provider}" does not consume any of the supplied params`,
      );
    }
    return out;
  }
}
