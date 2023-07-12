import { Injectable } from '@angular/core'
import { ActivatedRouteSnapshot, Router } from '@angular/router'
import { Observable } from 'rxjs'

import { constants } from '../constants'
import { FlashMessageService } from '../services/flash-message.service'

@Injectable({
  providedIn: 'root'
})
export class AuthGuard {
  constructor(
    private router: Router,
    private flashMessageService: FlashMessageService
  ) {}
  canActivate(
    next: ActivatedRouteSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    if (localStorage.getItem(constants.tokenName)) {
      return true
    }

    this.router.navigate(['/', 'auth', 'login'])

    this.flashMessageService.info(
      'You need to be logged in to access this page.'
    )
    return false
  }
}
