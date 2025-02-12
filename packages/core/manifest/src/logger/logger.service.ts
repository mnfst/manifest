import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import chalk from 'chalk'
import { API_PATH } from '../constants'

@Injectable()
export class LoggerService {
  constructor(private configService: ConfigService) {}

  /**
   *
   * Displays message on app initialization.
   *
   */
  initMessage(): void {
    const baseUrl: string = this.configService.get('baseUrl')
    const nodeEnv: string = this.configService.get('nodeEnv')

    // On contribution mode, we use the watch mode of the admin panel.
    const adminUrl =
      nodeEnv === 'contribution' ? 'http://localhost:4200' : `${baseUrl}`

    console.log()

    console.log(chalk.blue('Manifest backend successfully started! '))
    console.log()

    console.log(chalk.blue('🖥️  Admin Panel: ', chalk.underline.blue(adminUrl)))

    if (this.configService.get('showOpenApiDocs')) {
      console.log(
        chalk.blue(
          '📚 API Doc: ',
          chalk.underline.blue(`${baseUrl}/${API_PATH}`)
        )
      )
    }

    console.log()
  }
}
