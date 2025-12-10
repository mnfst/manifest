import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { EntityManifest } from '@repo/types'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'

@Injectable()
export class IsSingleGuard implements CanActivate {
  constructor(private readonly entityManifestService: EntityManifestService) {}

  canActivate(context: ExecutionContext): boolean {
    const entityManifest: EntityManifest =
      this.entityManifestService.getEntityManifest({
        slug: context.getArgs()[0].params.entity
      })

    return entityManifest.single
  }
}
