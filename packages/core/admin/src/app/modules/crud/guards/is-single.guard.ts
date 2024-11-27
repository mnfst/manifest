import { Injectable } from '@angular/core'
import { ActivatedRouteSnapshot, Router } from '@angular/router'
import { ManifestService } from '../../shared/services/manifest.service'
import { EntityManifest } from '@repo/types'
import { FlashMessageService } from '../../shared/services/flash-message.service'

@Injectable({
  providedIn: 'root'
})
export class IsSingleGuard {
  constructor(
    private manifestService: ManifestService,
    private flashMessageService: FlashMessageService,
    private router: Router
  ) {}

  async canActivate(context: ActivatedRouteSnapshot): Promise<boolean> {
    const entityManifest: EntityManifest =
      await this.manifestService.getEntityManifest({
        slug: context.params['entitySlug']
      })

    if (!entityManifest.single) {
      this.flashMessageService.error(
        'Error: This entity is not a single entity'
      )
      this.router.navigate(['/'])
      return false
    }

    return true
  }
}
