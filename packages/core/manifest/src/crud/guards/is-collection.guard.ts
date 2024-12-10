import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { EntityManifest } from '@repo/types'
import { ManifestService } from '../../manifest/services/manifest.service'

@Injectable()
export class IsCollectionGuard implements CanActivate {
  constructor(private readonly manifestService: ManifestService) {}

  canActivate(context: ExecutionContext): boolean {
    const entityManifest: EntityManifest =
      this.manifestService.getEntityManifest({
        slug: context.getArgs()[0].params.entity
      })

    return !entityManifest.single
  }
}
