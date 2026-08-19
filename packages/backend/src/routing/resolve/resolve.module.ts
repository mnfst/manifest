import { Module, forwardRef } from '@nestjs/common';
import { OtlpModule } from '../../otlp/otlp.module';
import { RoutingCoreModule } from '../routing-core/routing-core.module';
import { ModelPricesModule } from '../../model-prices/model-prices.module';
import { ModelDiscoveryModule } from '../../model-discovery/model-discovery.module';
import { HeaderTiersModule } from '../header-tiers/header-tiers.module';
import { SubscriptionQuotaModule } from '../subscription-quota.module';
import { ResolveController } from './resolve.controller';
import { ResolveService } from './resolve.service';

@Module({
  imports: [
    OtlpModule,
    RoutingCoreModule,
    ModelPricesModule,
    ModelDiscoveryModule,
    forwardRef(() => HeaderTiersModule),
    SubscriptionQuotaModule,
  ],
  controllers: [ResolveController],
  providers: [ResolveService],
  exports: [ResolveService],
})
export class ResolveModule {}
