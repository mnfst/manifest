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
      nodeEnv === 'contribution' ? 'http://localhost:1111' : `${baseUrl}`

    console.log('')
    console.log(
      chalk.green(
        '┌─────────────────────────────────────────────────────────────┐'
      )
    )
    console.log(
      chalk.green('│                   ') +
        chalk.green.bold('MANIFEST BACKEND STARTED') +
        chalk.green('                  │')
    )
    console.log(
      chalk.green(
        '└─────────────────────────────────────────────────────────────┘'
      )
    )
    console.log('')
    console.log(
      chalk.green('🖥️  ') +
        chalk.bold('Admin Panel: ') +
        chalk.cyan.underline(adminUrl)
    )

    if (this.configService.get('showOpenApiDocs')) {
      console.log(
        chalk.green('📚 ') +
          chalk.bold('API Documentation: ') +
          chalk.cyan.underline(`${baseUrl}/${API_PATH}`)
      )
    }

    console.log('')
    console.log(
      chalk.yellow('🦚 ') + chalk.dim('Ready to create and ship fast!')
    )
    console.log('')
  }
}
