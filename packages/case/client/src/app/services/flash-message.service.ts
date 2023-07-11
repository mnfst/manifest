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
  }> = new Subject()

  success(message: string, sticky = false) {
    this.flashMessage.next({ message, className: 'notification is-success' })
    setTimeout(
      () => {
        this.flashMessage.next(null)
      },
      sticky ? 9999999 : this.flashMessageTimeOut
    )
  }

  error(message: string, sticky = false) {
    this.flashMessage.next({ message, className: 'notification is-danger' })
    setTimeout(
      () => {
        this.flashMessage.next(null)
      },
      sticky ? 9999999 : this.flashMessageTimeOut
    )
  }

  warning(message: string, sticky = false) {
    this.flashMessage.next({ message, className: 'notification is-warning' })
    setTimeout(
      () => {
        this.flashMessage.next(null)
      },
      sticky ? 9999999 : this.flashMessageTimeOut
    )
  }

  info(message: string, sticky = false) {
    this.flashMessage.next({ message, className: 'notification is-info' })
    setTimeout(
      () => {
        this.flashMessage.next(null)
      },
      sticky ? 9999999 : this.flashMessageTimeOut
    )
  }
}
