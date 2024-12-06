import { faker } from '@faker-js/faker'
import { EntityManifest, RelationshipManifest } from '@repo/types'
import { Injectable } from '@nestjs/common'
import { ManifestService } from '../../manifest/services/manifest.service'

@Injectable()
export class RelationshipService {
  constructor(private manifestService: ManifestService) {}

  /**
   * Get the seed value for a relationship based on the relationship seed count.
   *
   * @param relationshipManifest The relationship manifest in its detailed form.
   *
   * @returns The seed value (id).
   *
   **/
  getSeedValue(relationshipManifest: RelationshipManifest): number {
    const relatedEntity: EntityManifest =
      this.manifestService.getEntityManifest({
        className: relationshipManifest.entity
      })

    return faker.number.int({
      min: 1,
      max: relatedEntity.seedCount
    })
  }
}
