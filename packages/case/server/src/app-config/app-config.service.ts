import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { AppConfig } from '../../../shared/interfaces/app-config.interface'

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  getAppConfig(): AppConfig {
    const nodeEnv: string = this.configService.get('nodeEnv')

    return {
      production: nodeEnv === 'production'
    }
  }
}
