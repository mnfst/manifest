import { Controller, Get, UseGuards } from '@nestjs/common'

import { AppSettings } from '../../../shared/interfaces/app-settings.interface'
import { EntityDescription } from '../../../shared/interfaces/entity-description.interface'
import { AuthGuard } from '../auth/auth.guard'
import { AppRulesService } from './app-rules.service'

@Controller('app-rules')
// TODO: The app settings should be open whereas the entities should be protected.
// @UseGuards(AuthGuard)
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
