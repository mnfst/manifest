import { Module } from '@nestjs/common'

import { AppRulesController } from './app-rules.controller'
import { AppRulesService } from './app-rules.service'

@Module({
  controllers: [AppRulesController],
  providers: [AppRulesService]
})
export class AppRulesModule {}
