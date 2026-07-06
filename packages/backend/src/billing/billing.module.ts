import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../entities/tenant.entity';
import { BillingController } from './billing.controller';
import { PlanService } from './plan.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  controllers: [BillingController],
  providers: [PlanService],
  exports: [PlanService],
})
export class BillingModule {}
