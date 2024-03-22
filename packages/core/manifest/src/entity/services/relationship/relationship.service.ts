import { EntityManifest } from '@casejs/types/src/manifests/entity-manifest.interface'
import { RelationshipManifest } from '@casejs/types/src/manifests/relationship-manifest.type'
import { faker } from '@faker-js/faker'
import { Injectable } from '@nestjs/common'
import { ManifestService } from '../../../manifest/services/manifest/manifest.service'

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
