import { Module } from '@nestjs/common'

import { AuthService } from '../auth/auth.service'
import { AppConfigController } from './app-config.controller'
import { AppConfigService } from './app-config.service'

@Module({
  controllers: [AppConfigController],
  providers: [AppConfigService, AuthService]
})
export class AppConfigModule {}
