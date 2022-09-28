import { Inject, Injectable } from '@angular/core'
import { Subject } from 'rxjs'

import { CaseConfig } from '../interfaces/case-config.interface'

@Injectable({
  providedIn: 'root'
})
export class FlashMessageService {
  public flashMessage: Subject<{
    message: string
    className: string
  }> = new Subject()

  timeout: number
  defaultTimeout = 6000

  constructor(@Inject('CASE_CONFIG_TOKEN') config: CaseConfig) {
    this.timeout = config.flashMessageTimeout || this.defaultTimeout
  }

  success(message: string, sticky = false): void {
    this.flashMessage.next({ message, className: 'notification is-success' })
    setTimeout(
      () => {
        this.flashMessage.next(null)
      },
      sticky ? 9999999 : this.timeout
    )
  }

  error(message: string, sticky = false): void {
    this.flashMessage.next({ message, className: 'notification is-danger' })
    setTimeout(
      () => {
        this.flashMessage.next(null)
      },
      sticky ? 9999999 : this.timeout
    )
  }

  info(message: string, sticky = false): void {
    this.flashMessage.next({ message, className: 'notification is-info' })
    setTimeout(
      () => {
        this.flashMessage.next(null)
      },
      sticky ? 9999999 : this.timeout
    )
  }
}
