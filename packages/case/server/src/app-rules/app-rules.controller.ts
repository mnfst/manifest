import { Controller, Get } from '@nestjs/common'

import { AppSettings } from '../../../shared/interfaces/app-settings.interface'
import { EntityDescription } from '../../../shared/interfaces/entity-description.interface'
import { AppRulesService } from './app-rules.service'

@Controller('app-rules')
export class AppRulesController {
  constructor(private readonly appRulesService: AppRulesService) {}

  @Get('settings')
  async getAppSettings(): Promise<{
    entities: EntityDescription[]
    settings: AppSettings
  }> {
    return {
      settings: await this.appRulesService.getAppSettings(),
      entities: this.appRulesService.getAppEntities()
    }
  }
}
