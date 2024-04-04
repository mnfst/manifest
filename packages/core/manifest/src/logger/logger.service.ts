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
    const nodeEnv: string = this.configService.get('nodeEnv')

    console.log('Admin panel', chalk.green(`http://localhost:${port}`))
    console.log('REST API', chalk.green(`http://localhost:${port}/api`))
    console.log('NODE ENV', chalk.green(nodeEnv))

    console.log()

    if (nodeEnv === 'production') {
      console.log(
        chalk.blue(
          `🎉 Manifest successfully started on production mode on port ${port}`
        )
      )
    } else {
      console.log(
        chalk.blue(
          '🎉 Manifest successfully started! See your admin panel: ',
          chalk.underline.blue(`http://localhost:${port}`)
        )
      )
    }
    console.log()
  }
}
