import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../entities/tenant.entity';
import { AutofixWaitlistSignup } from '../entities/autofix-waitlist-signup.entity';
import { WaitlistController } from './waitlist.controller';
import { WaitlistPhoneHomeService } from './waitlist-phone-home.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, AutofixWaitlistSignup])],
  controllers: [WaitlistController],
  providers: [WaitlistPhoneHomeService],
})
export class WaitlistModule {}
