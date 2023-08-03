import { Module } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { AppConfigController } from './app-config.controller';

@Module({
  providers: [AppConfigService],
  controllers: [AppConfigController]
})
export class AppConfigModule {}
