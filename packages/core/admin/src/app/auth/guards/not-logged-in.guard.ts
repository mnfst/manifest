import { Injectable } from '@angular/core'
import { Router } from '@angular/router'
import { TOKEN_KEY } from '../../../constants'

@Injectable({
  providedIn: 'root'
})
export class NotLoggedInGuard {
  constructor(private router: Router) {}
  canActivate(): boolean {
    if (!localStorage.getItem(TOKEN_KEY)) {
      return true
    }

    this.router.navigate(['/'])

    return false
  }
}
