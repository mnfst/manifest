import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { AppConfig } from '../../../shared/interfaces/app-config.interface'

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  getAppConfig(): Promise<AppConfig> {
    const configFilePath: string = `${this.configService.get(
      'distRoot'
    )}/server/src/_contribution-root/app-config.js`

    return import(configFilePath).then((res: { appConfig: AppConfig }) => {
      return res.appConfig
    })
  }
}
