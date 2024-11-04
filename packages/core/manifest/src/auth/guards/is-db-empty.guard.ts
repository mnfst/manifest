import { CanActivate, Injectable } from '@nestjs/common'
import { ManifestService } from '../../manifest/services/manifest.service'
import { AppManifest, EntityManifest } from '@repo/types'
import { EntityService } from '../../entity/services/entity.service'
import { ADMIN_ENTITY_MANIFEST } from '../../constants'

@Injectable()
export class IsDbEmptyGuard implements CanActivate {
  constructor(
    private readonly manifestService: ManifestService,
    private readonly entityService: EntityService
  ) {}

  /**
   * Check if the database is empty (no items in any entity, even admin).
   *
   * @returns True if the database is empty, false otherwise.
   * */
  async canActivate(): Promise<boolean> {
    const appManifest: AppManifest = this.manifestService.getAppManifest()

    const entities = [
      ...Object.values(appManifest.entities),
      ADMIN_ENTITY_MANIFEST
    ]
    let totalItems = 0

    await Promise.all(
      Object.values(entities).map(async (entityManifest: EntityManifest) => {
        return this.entityService
          .getEntityRepository({
            entitySlug: entityManifest.slug
          })
          .createQueryBuilder('entity')
          .getCount()
      })
    ).then((counts: number[]) => {
      totalItems = counts.reduce((acc, count) => acc + count, 0)
    })

    return totalItems === 0
  }
}
