import { Injectable } from '@angular/core'
import { ActivatedRouteSnapshot, Router } from '@angular/router'
import { Admin } from '../../../typescript/interfaces/admin.interface'
import { AuthService } from '../auth.service'
import { Observable } from 'rxjs'
import { map, take, filter } from 'rxjs/operators'
import { FlashMessageService } from '../../shared/services/flash-message.service'
import { AdminAccess } from '@repo/types'

@Injectable({
  providedIn: 'root'
})
export class AdminAccessGuard {
  constructor(
    private authService: AuthService,
    private router: Router,
    private flashMessageService: FlashMessageService
  ) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    const requiredAccess = route.data['requiredAccess'] as AdminAccess

    return this.authService.currentUser$.pipe(
      filter((currentUser: Admin | null) => currentUser !== null),
      take(1),
      map((currentUser: Admin) => {
        if (currentUser[requiredAccess]) {
          return true
        }
        this.router.navigate(['/'])
        this.flashMessageService.error(
          'You do not have the access to this page.'
        )
        return false
      })
    )
  }
}
