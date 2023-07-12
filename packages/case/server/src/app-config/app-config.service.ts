import { Injectable } from '@nestjs/common'
import { join } from 'path'

import { AppConfig } from '../../../shared/interfaces/app-config.interface'

@Injectable()
export class AppConfigService {
  getAppConfig(): Promise<AppConfig> {
    const devMode: boolean = process.argv[2] === 'dev'

    const appSettingsPath = devMode
      ? join(__dirname, '../dev-app-config.js')
      : join(process.cwd(), 'app-config.ts')

    return import(appSettingsPath).then((res: { appConfig: AppConfig }) => {
      return res.appConfig
    })
  }
}
