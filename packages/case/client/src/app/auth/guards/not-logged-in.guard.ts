import { Injectable } from '@angular/core'
import { Router } from '@angular/router'

import { constants } from '../../constants'

@Injectable({
  providedIn: 'root'
})
export class NotLoggedInGuard {
  constructor(private router: Router) {}
  canActivate(): boolean {
    if (!localStorage.getItem(constants.tokenName)) {
      return true
    }

    this.router.navigate(['/'])

    return false
  }
}
