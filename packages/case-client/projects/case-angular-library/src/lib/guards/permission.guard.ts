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
        `Vous n'avez pas les droit d'accès à ce contenu. Veuillez contacter votre administrateur.`
      )

      return false
    }

    return true
  }
}
