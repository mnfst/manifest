import { Controller, Get } from '@nestjs/common'
import { AppRulesService } from './app-rules.service'
import { EntityDescription } from '../../../shared/interfaces/entity-description.interface'
import { AppSettings } from '../../../shared/interfaces/app-settings.interface'

@Controller('app-rules')
export class AppRulesController {
  constructor(private readonly appRulesService: AppRulesService) {}

  @Get('settings')
  async getAppSettings(): Promise<{
    entities: EntityDescription[]
    settings: AppSettings
  }> {
    return {
      settings: this.appRulesService.getAppSettings(),
      entities: this.appRulesService.getAppEntities()
    }
  }
}
