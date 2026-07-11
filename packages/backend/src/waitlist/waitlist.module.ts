import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../entities/tenant.entity';
import { WaitlistClaim } from '../entities/waitlist-claim.entity';
import { WaitlistController } from './waitlist.controller';
import { WaitlistSyncService } from './waitlist-sync.service';
import { AutofixModule } from '../routing/autofix/autofix.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, WaitlistClaim]), AutofixModule],
  controllers: [WaitlistController],
  providers: [WaitlistSyncService],
})
export class WaitlistModule {}
