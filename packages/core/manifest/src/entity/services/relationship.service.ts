import { faker } from '@faker-js/faker'
import { EntityManifest, RelationshipManifest } from '@repo/types'
import { Injectable } from '@nestjs/common'
import { ManifestService } from '../../manifest/services/manifest.service'
import { EntitySchemaRelationOptions } from 'typeorm'

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

  /**
   * Converts belongsTo relationships to TypeORM EntitySchemaRelationOptions of many-to-one relations.
   *
   * @param belongsToRelationships The belongsTo relationships to convert.
   *
   * @returns The converted EntitySchemaRelationOptions.
   *
   */
  getEntitySchemaBelongsToRelationOptions(
    belongsToRelationships: RelationshipManifest[]
  ): { [key: string]: EntitySchemaRelationOptions } {
    return belongsToRelationships.reduce(
      (
        acc: { [key: string]: EntitySchemaRelationOptions },
        belongsToRelationShip: RelationshipManifest
      ) => {
        acc[belongsToRelationShip.name] = {
          target: belongsToRelationShip.entity,
          type: 'many-to-one',
          eager: !!belongsToRelationShip.eager
        }

        return acc
      },
      {}
    )
  }

  /**
   * Converts hasMany relationships to TypeORM EntitySchemaRelationOptions of one-to-many relations.
   * @param hasManyRelationships  The hasMany relationships to convert.
   * @param centralEntityName The name of the entity that has the hasMany relationships.
   *
   * @returns The converted EntitySchemaRelationOptions.
   */
  getEntitySchemaHasManyRelationOptions(
    hasManyRelationships: RelationshipManifest[],
    centralEntityName: string
  ): { [key: string]: EntitySchemaRelationOptions } {
    return hasManyRelationships.reduce(
      (
        acc: { [key: string]: EntitySchemaRelationOptions },
        hasManyRelationShip: RelationshipManifest
      ) => {
        acc[hasManyRelationShip.name] = {
          target: hasManyRelationShip.entity,
          type: 'many-to-many',
          eager: !!hasManyRelationShip.eager,
          joinTable: {
            name: `${centralEntityName}_${hasManyRelationShip.name}`
          }
        }
        return acc
      },
      {}
    )
  }
}
