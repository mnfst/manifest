import { Injectable } from '@nestjs/common'
import { join } from 'path'

import { AppSettings } from '../../../shared/interfaces/app-settings.interface'

@Injectable()
export class AppRulesService {
  getAppSettings(): Promise<AppSettings> {
    const devMode: boolean = process.argv[2] === 'dev'

    const appSettingsPath = devMode
      ? join(__dirname, '../dev-app-settings.js')
      : join(process.cwd(), 'app-settings.ts')

    return import(appSettingsPath).then((res: { appSettings: AppSettings }) => {
      return res.appSettings
    })
  }
}
