import { Controller, Get } from '@nestjs/common'

import { AppConfig } from '../../../shared/interfaces/app-config.interface'
import { AppConfigService } from './app-config.service'

@Controller('config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  getAppConfig(): AppConfig {
    return this.appConfigService.getAppConfig()
  }
}
