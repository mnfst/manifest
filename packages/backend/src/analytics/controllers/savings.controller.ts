import { Controller, Get, Put, Query, Body } from '@nestjs/common';
import { SavingsQueryDto } from '../../common/dto/savings-query.dto';
import { UpdateBaselineDto } from '../../common/dto/update-baseline.dto';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.instance';
import { TenantCacheService } from '../../common/services/tenant-cache.service';
import { ResolveAgentService } from '../../routing/routing-core/resolve-agent.service';
import { SavingsQueryService } from '../services/savings-query.service';

@Controller('api/v1/savings')
export class SavingsController {
  constructor(
    private readonly savingsQuery: SavingsQueryService,
    private readonly tenantCache: TenantCacheService,
    private readonly resolveAgent: ResolveAgentService,
  ) {}

  @Get()
  async getSavings(@Query() query: SavingsQueryDto, @CurrentUser() user: AuthUser) {
    const tenantId = (await this.tenantCache.resolve(user.id)) ?? undefined;
    return this.savingsQuery.getSavings(query.range, user.id, query.agent_name, tenantId);
  }

  @Put('baseline')
  async updateBaseline(@Body() body: UpdateBaselineDto, @CurrentUser() user: AuthUser) {
    const agent = await this.resolveAgent.resolve(user.id, body.agent_name);
    await this.savingsQuery.updateBaseline(agent.id, body.model_id);

    const tenantId = (await this.tenantCache.resolve(user.id)) ?? undefined;
    if (tenantId) {
      this.resolveAgent.invalidate(tenantId, body.agent_name);
    }

    return this.savingsQuery.getSavings('30d', user.id, body.agent_name, tenantId);
  }

  @Get('baseline-candidates')
  async getBaselineCandidates(
    @Query('agent_name') agentName: string,
    @CurrentUser() user: AuthUser,
  ) {
    const agent = await this.resolveAgent.resolve(user.id, agentName);
    return this.savingsQuery.getBaselineCandidates(agent.id, agent.savings_baseline_model);
  }
}
