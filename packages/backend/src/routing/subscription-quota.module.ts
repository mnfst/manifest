import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantProvider } from '../entities/tenant-provider.entity';
import { OAuthModule } from './oauth/oauth.module';
import { SubscriptionQuotaService } from './subscription-quota.service';

/**
 * Owns the subscription-quota poller. A dedicated module (instead of
 * registering the service directly in RoutingModule) lets ResolveModule
 * import it without creating a RoutingModule <-> ResolveModule import cycle.
 */
@Module({
  imports: [TypeOrmModule.forFeature([TenantProvider]), OAuthModule],
  providers: [SubscriptionQuotaService],
  exports: [SubscriptionQuotaService],
})
export class SubscriptionQuotaModule {}
