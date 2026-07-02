import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../entities/agent.entity';
import { Tenant } from '../entities/tenant.entity';
import { BillingController } from './billing.controller';
import { PlanService } from './plan.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, Agent])],
  controllers: [BillingController],
  providers: [PlanService],
  exports: [PlanService],
})
export class BillingModule {}
