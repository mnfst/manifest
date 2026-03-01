import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { VersionCheckService } from './version-check.service';
import { ProviderHealthService } from './provider-health.service';
import { ModelPricing } from '../entities/model-pricing.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ModelPricing])],
  controllers: [HealthController],
  providers: [VersionCheckService, ProviderHealthService],
  exports: [ProviderHealthService],
})
export class HealthModule { }
