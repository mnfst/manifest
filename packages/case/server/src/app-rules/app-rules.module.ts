import { Module } from '@nestjs/common'

import { AuthService } from '../auth/auth.service'
import { AppRulesController } from './app-rules.controller'
import { AppRulesService } from './app-rules.service'

@Module({
  controllers: [AppRulesController],
  providers: [AppRulesService, AuthService]
})
export class AppRulesModule {}
