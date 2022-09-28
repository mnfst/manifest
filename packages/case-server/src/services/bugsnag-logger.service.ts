import Bugsnag from '@bugsnag/js'
import { Injectable, LoggerService } from '@nestjs/common'

@Injectable()
export class BugsnagLoggerService implements LoggerService {
  async log() {}
  async warn() {}

  async error(message: string, trace: string) {
    Bugsnag.notify({ name: 'Error', message: `${message} : ${trace}` })
  }
}
