import { Injectable } from '@angular/core'
import { Router } from '@angular/router'
import { TOKEN_KEY } from '../../../constants'
import { FlashMessageService } from '../../modules/shared/services/flash-message.service'

@Injectable({
  providedIn: 'root'
})
export class AuthGuard {
  constructor(
    private router: Router,
    private flashMessageService: FlashMessageService
  ) {}
  canActivate(): boolean {
    if (localStorage.getItem(TOKEN_KEY)) {
      return true
    }

    this.router.navigate(['/', 'auth', 'login'])

    this.flashMessageService.info(
      'You need to be logged in to access this page.'
    )
    return false
  }
}
