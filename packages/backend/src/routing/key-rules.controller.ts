import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import type { KeyRotationRule } from 'manifest-shared';
import { TenantCtx, TenantContext } from '../common/decorators/tenant-context.decorator';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import {
  KeyRotationRuleService,
  toKeyRotationRule,
} from './routing-core/key-rotation-rule.service';
import { AgentNameParamDto, PutKeyRulesDto } from './dto/routing.dto';

/**
 * Per-agent key rotation rules: which provider API-key labels to try (in
 * order) when a model is attempted. PUT is a full replace for the agent —
 * upsert/delete diff keyed by the unique (agent_id, model) index.
 */
@Controller('api/v1/routing')
export class KeyRulesController {
  constructor(
    private readonly keyRotationRuleService: KeyRotationRuleService,
    private readonly resolveAgentService: ResolveAgentService,
  ) {}

  @Get(':agentName/key-rules')
  async getRules(@TenantCtx() ctx: TenantContext, @Param() params: AgentNameParamDto) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, params.agentName);
    const rules = await this.keyRotationRuleService.list(agent.id);
    return { rules: rules.map(toKeyRotationRule) };
  }

  @Put(':agentName/key-rules')
  async setRules(
    @TenantCtx() ctx: TenantContext,
    @Param() params: AgentNameParamDto,
    @Body() body: PutKeyRulesDto,
  ) {
    const agent = await this.resolveAgentService.resolve(ctx.tenantId, params.agentName);
    const payload: Array<Omit<KeyRotationRule, 'id'>> = body.rules.map((r) => ({
      agentId: agent.id,
      model: r.model ?? null,
      provider: r.provider,
      scope: r.scope ?? 'model',
      keyOrder: r.keyOrder,
    }));
    const saved = await this.keyRotationRuleService.replace(agent.id, agent.tenant_id, payload);
    return { rules: saved.map(toKeyRotationRule) };
  }
}
