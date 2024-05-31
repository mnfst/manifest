import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import chalk from 'chalk'

@Injectable()
export class LoggerService {
  constructor(private configService: ConfigService) {}

  /**
   *
   * Displays message on app initialization.
   *
   */
  initMessage(): void {
    const port: number = this.configService.get('port')

    console.log()

    console.log(
      chalk.blue(
        '🎉 Manifest successfully started at ',
        chalk.underline.blue(`http://localhost:${port}`)
      )
    )

    console.log()
  }
}
