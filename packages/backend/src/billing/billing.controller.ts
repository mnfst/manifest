import { Controller, Get } from '@nestjs/common';
import { TenantCtx, TenantContext } from '../common/decorators/tenant-context.decorator';
import { PlanService } from './plan.service';

@Controller('api/v1')
export class BillingController {
  constructor(private readonly planService: PlanService) {}

  @Get('billing/status')
  async status(@TenantCtx() ctx: TenantContext) {
    return this.planService.getBillingStatus(ctx);
  }
}
