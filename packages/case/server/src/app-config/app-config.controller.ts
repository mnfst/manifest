import { Controller, Get } from '@nestjs/common'

import { AppConfig } from '../../../shared/interfaces/app-config.interface'
import { AppConfigService } from './app-config.service'

/**
 * AppConfigController is a controller that handles operations related to the application configuration.
 * @class AppConfigController
 */
@Controller('config')
export class AppConfigController {
  /**
   * Constructs an instance of AppConfigController.
   * @param appConfigService - The service to access the application configuration.
   */
  constructor(private readonly appConfigService: AppConfigService) { }

  /**
   * Retrieves the application configuration.
   * @returns A promise that resolves to the application configuration.
   */
  @Get()
  async getAppConfig(): Promise<AppConfig> {
    return this.appConfigService.getAppConfig()
  }
}
