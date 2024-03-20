import { faker } from '@faker-js/faker'
import { Injectable } from '@nestjs/common'
import { ManifestService } from '../../../manifest/services/manifest/manifest.service'
import { EntityManifest } from '../../../manifest/typescript/manifest-types'
import { DetailedRelationshipManifest } from '../../../manifest/typescript/other/detailed-relationship-manifest.type'

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
  getSeedValue(relationshipManifest: DetailedRelationshipManifest): number {
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
