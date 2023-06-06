import { Controller, Get } from '@nestjs/common'
import { AppRulesService } from './app-rules.service'

@Controller('app-rules')
export class AppRulesController {
  constructor(private readonly appRulesService: AppRulesService) {}

  @Get('settings')
  async getAppSettings() {
    return {
      settings: this.appRulesService.getAppSettings(),
      entities: await this.appRulesService.getAppEntities()
    }
  }
}
