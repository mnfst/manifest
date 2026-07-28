import { Controller, Get } from '@nestjs/common';
import { TenantCtx, TenantContext } from '../common/decorators/tenant-context.decorator';
import {
  SubscriptionUsageService,
  type SubscriptionUsageSummary,
} from './subscription-usage.service';

@Controller('api/v1/providers/subscription-usage')
export class SubscriptionUsageController {
  constructor(private readonly subscriptionUsage: SubscriptionUsageService) {}

  @Get()
  async getUsage(
    @TenantCtx() ctx: TenantContext,
  ): Promise<{ providers: SubscriptionUsageSummary[] }> {
    const providers = await this.subscriptionUsage.getUsage(ctx.tenantId);
    return { providers };
  }
}
