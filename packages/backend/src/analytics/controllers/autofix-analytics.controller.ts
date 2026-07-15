import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { RangeQueryDto } from '../../common/dto/range-query.dto';
import { AUTOFIX_TS_DIMENSIONS } from '../services/autofix-stats.service';
import { AutofixStatsService } from '../services/autofix-stats.service';
import { TenantCtx, TenantContext } from '../../common/decorators/tenant-context.decorator';
import { UserCacheInterceptor } from '../../common/interceptors/user-cache.interceptor';
import { DASHBOARD_CACHE_TTL_MS } from '../../common/constants/cache.constants';

class AutofixTimeseriesQueryDto extends RangeQueryDto {
  @IsOptional()
  @IsString()
  @IsIn([...AUTOFIX_TS_DIMENSIONS])
  by?: string;

  @IsOptional()
  @IsString()
  failed_only?: string;
}

@Controller('api/v1')
@UseInterceptors(UserCacheInterceptor)
@CacheTTL(DASHBOARD_CACHE_TTL_MS)
export class AutofixAnalyticsController {
  constructor(private readonly autofixStats: AutofixStatsService) {}

  @Get('autofix/status')
  async getStatus(@TenantCtx() ctx: TenantContext) {
    return this.autofixStats.getWorkspaceStatus(ctx.tenantId);
  }

  @Get('overview/autofix-stats')
  async getStats(@Query() query: RangeQueryDto, @TenantCtx() ctx: TenantContext) {
    return this.autofixStats.getStats({
      tenantId: ctx.tenantId,
      range: query.range,
      agentName: query.agent_name,
    });
  }

  @Get('overview/autofix-timeseries')
  async getTimeseries(@Query() query: AutofixTimeseriesQueryDto, @TenantCtx() ctx: TenantContext) {
    return this.autofixStats.getTimeseries({
      tenantId: ctx.tenantId,
      range: query.range,
      by: query.by,
      agentName: query.agent_name,
      failedOnly: query.failed_only === 'true',
    });
  }

  @Get('overview/autofix-per-agent')
  async getPerAgent(@Query() query: RangeQueryDto, @TenantCtx() ctx: TenantContext) {
    return this.autofixStats.getPerAgentStats({
      tenantId: ctx.tenantId,
      range: query.range,
    });
  }

  @Get('overview/autofix-per-provider')
  async getPerProvider(@Query() query: RangeQueryDto, @TenantCtx() ctx: TenantContext) {
    return this.autofixStats.getPerProviderStats({
      tenantId: ctx.tenantId,
      range: query.range,
      agentName: query.agent_name,
    });
  }
}
