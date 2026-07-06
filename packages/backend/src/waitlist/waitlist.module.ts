import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../entities/tenant.entity';
import { WaitlistClaim } from '../entities/waitlist-claim.entity';
import { WaitlistController } from './waitlist.controller';
import { WaitlistSyncService } from './waitlist-sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, WaitlistClaim])],
  controllers: [WaitlistController],
  providers: [WaitlistSyncService],
})
export class WaitlistModule {}
