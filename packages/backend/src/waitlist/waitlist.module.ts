import { Module } from '@nestjs/common';
import { WaitlistController } from './waitlist.controller';

@Module({
  controllers: [WaitlistController],
})
export class WaitlistModule {}
