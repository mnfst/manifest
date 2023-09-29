import { Module } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { AppConfigController } from './app-config.controller';

/**
 * AppConfigModule is a module that provides the application configuration.
 * @module AppConfigModule
 */
@Module({
  providers: [AppConfigService],
  controllers: [AppConfigController]
})
export class AppConfigModule {}
