import { Injectable } from '@angular/core'
import { ActivatedRouteSnapshot } from '@angular/router'

import { AuthService } from '../services/auth.service'
import { FlashMessageService } from '../services/flash-message.service'

@Injectable({
  providedIn: 'root'
})
export class PermissionGuard {
  constructor(
    private authService: AuthService,
    private flashMessageService: FlashMessageService
  ) {}

  async canActivate(
    activatedRouteSnapshot: ActivatedRouteSnapshot
  ): Promise<boolean> {
    const permission: string = activatedRouteSnapshot.data.permission
    const userPermissions: string[] = await this.authService.getPermissions()

    if (permission && !userPermissions.includes(permission)) {
      this.flashMessageService.error(
        `You don't have the permission to access this page. Please contact your administrator.`
      )

      return false
    }

    return true
  }
}
