import { Injectable } from '@angular/core'

import { Subject } from 'rxjs'

@Injectable({
  providedIn: 'root'
})
export class FlashMessageService {
  flashMessageTimeOut = 5000

  public flashMessage: Subject<{
    message: string
    className: string
  } | null> = new Subject()

  success(message: string) {
    this.flashMessage.next({ message, className: 'notification is-success' })
    this.clear()
  }

  error(message: string) {
    this.flashMessage.next({ message, className: 'notification is-danger' })
    this.clear()
  }

  warning(message: string) {
    this.flashMessage.next({ message, className: 'notification is-warning' })
    this.clear()
  }

  info(message: string) {
    this.flashMessage.next({ message, className: 'notification is-info' })
    this.clear()
  }

  private clear() {
    setTimeout(() => {
      this.flashMessage.next(null)
    }, this.flashMessageTimeOut)
  }
}
