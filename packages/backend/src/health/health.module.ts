import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { VersionCheckService } from './version-check.service';

@Module({
  controllers: [HealthController],
  providers: [VersionCheckService],
})
export class HealthModule {}
