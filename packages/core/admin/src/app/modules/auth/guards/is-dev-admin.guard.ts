import { Injectable } from '@angular/core'
import { Router } from '@angular/router'
import { Admin } from '../../../typescript/interfaces/admin.interface'
import { AuthService } from '../auth.service'
import { Observable } from 'rxjs'
import { map, take } from 'rxjs/operators'
import { FlashMessageService } from '../../shared/services/flash-message.service'

@Injectable({
  providedIn: 'root'
})
export class IsDevAdminGuard {
  constructor(
    private authService: AuthService,
    private router: Router,
    private flashMessageService: FlashMessageService
  ) {}

  canActivate(): Observable<boolean> {
    return this.authService.currentUser$.pipe(
      take(1),
      map((currentUser: Admin | null) => {
        if (currentUser && currentUser.hasDeveloperPanelAccess) {
          return true
        }
        this.router.navigate(['/'])
        this.flashMessageService.info(
          'You do not have the access to this page.'
        )
        return false
      })
    )
  }
}
