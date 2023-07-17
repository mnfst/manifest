import { Injectable } from '@nestjs/common'
import { join } from 'path'

import { AppConfig } from '../../../shared/interfaces/app-config.interface'

@Injectable()
export class AppConfigService {
  getAppConfig(): Promise<AppConfig> {
    const contributionMode: boolean = process.argv[2] === 'contribution'

    const appSettingsPath = contributionMode
      ? join(__dirname, '../../../_contribution-root/app-config.js')
      : join(process.cwd(), 'app-config.ts')

    return import(appSettingsPath).then((res: { appConfig: AppConfig }) => {
      return res.appConfig
    })
  }
}
