import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { AppConfig } from '../../../shared/interfaces/app-config.interface'

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  getAppConfig(): Promise<AppConfig> {
    return import(this.configService.get('appConfigFilePath')).then(
      (res: { appConfig: AppConfig }) => {
        return res.appConfig
      }
    )
  }
}
