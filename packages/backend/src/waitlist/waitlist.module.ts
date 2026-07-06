import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../entities/tenant.entity';
import { WaitlistController } from './waitlist.controller';
import { AutofixModule } from '../routing/autofix/autofix.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), AutofixModule],
  controllers: [WaitlistController],
})
export class WaitlistModule {}
